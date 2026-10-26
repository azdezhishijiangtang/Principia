import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookX,
  MessageCircleQuestion,
  BrainCircuit,
  Dumbbell,
  Trash2,
  Sparkles,
  Loader2,
  Lightbulb,
  Eye,
  EyeOff,
  ChevronRight,
  History,
  Clock,
  FileDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MathText, { InlineMathText } from '@/components/MathText';
import { addMistake } from '@/lib/mistakeBook';
import { toast } from 'sonner';
import { FadeIn } from '@/components/MotionPrimitives';
import CourseIcon from '@/components/CourseIcon';
import { useAuth } from '@/lib/AuthContext';
import { useSubject } from '@/lib/SubjectContext';
import {
  readAiConfig,
  readAiProfiles,
  getActiveProfile,
  readProfileConfig,
  streamChat,
  describeAiError,
  MATH_TUTOR_SYSTEM_PROMPT,
  AI_PROFILE_LABELS,
  type AiProfile,
  type ChatMessage,
} from '@/lib/ai';
import { isEn } from '@/i18n/lang';
import { localizeCourse } from '@/i18n/data';
import {
  useQaEntries,
  deleteQaEntry,
  clearQaHistory,
  computeQaStats,
} from '@/lib/qaHistory';
import {
  loadSummaries,
  saveSummary,
  deleteSummary,
  clearSummaries,
  subscribeSummaries,
  type StudySummary,
} from '@/lib/summaryArchive';
import {
  exportQaEntriesToDocx,
  exportSummariesToDocx,
  exportPracticeToDocx,
} from '@/lib/wordExport';
import { downloadBlob } from '@/lib/textImage';
import { getCourse, subjectCourses } from '@/data/courses';

const FREE_LABEL = '自由提问';

const formatDate = (ts: number) => {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 解析 AI 生成的练习题文本 */
interface GeneratedProblem {
  title: string;
  question: string;
  hint: string;
  solution: string;
}

const parseGeneratedProblems = (raw: string): GeneratedProblem[] => {
  const blocks = raw.split(/^#{2,3}\s*(?:题目|练习)\s*\d*\s*/m).filter((b) => b.trim());
  if (blocks.length === 0) return [];
  return blocks.map((block) => {
    const lines = block.split('\n');
    const title = (lines[0] ?? '').replace(/[#*]/g, '').trim() || '练习题';
    const hintIdx = lines.findIndex((l) => /^[（(]?提示/.test(l.trim()));
    const solIdx = lines.findIndex((l) => /^[（(]?解答/.test(l.trim()));
    const question =
      hintIdx > 0
        ? lines.slice(1, hintIdx).join('\n').trim()
        : lines.slice(1).join('\n').trim();
    const hint =
      hintIdx >= 0
        ? lines
            .slice(hintIdx, solIdx > hintIdx ? solIdx : undefined)
            .join('\n')
            .replace(/^[（(]?提示[：:]?/, '')
            .trim()
        : '';
    const solution =
      solIdx >= 0
        ? lines
            .slice(solIdx)
            .join('\n')
            .replace(/^[（(]?解答[：:]?/, '')
            .trim()
        : '';
    return { title, question, hint, solution };
  });
};

const Study = () => {
  const { user } = useAuth();
  const { subject } = useSubject();
  const subjectCourseList = subjectCourses(subject);
  const userId = user?.id ?? 'guest';
  const entries = useQaEntries(userId);
  const stats = useMemo(() => computeQaStats(entries), [entries]);

  // 记录筛选
  const [filter, setFilter] = useState<string>('all');
  const filteredEntries =
    filter === 'all'
      ? entries
      : entries.filter((e) => (e.courseId ?? 'free') === filter);

  // AI 总结
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  // 总结所用接口存档（选择模型）
  const [selectedProfile, setSelectedProfile] = useState<number>(() => {
    const ps = readAiProfiles();
    const isSet = (p: AiProfile | null) =>
      Boolean(p && p.baseUrl && p.apiKey && p.model);
    const active = getActiveProfile();
    if (isSet(ps[active])) return active;
    const first = ps.findIndex(isSet);
    return first >= 0 ? first : 0;
  });
  // 历史总结留存
  const [archive, setArchive] = useState<StudySummary[]>([]);
  useEffect(() => {
    const reload = () => setArchive(loadSummaries(userId));
    reload();
    return subscribeSummaries(reload);
  }, [userId]);
  // 已配置的存档列表（供下拉选择模型）
  const isSet = (p: AiProfile | null) =>
    Boolean(p && p.baseUrl && p.apiKey && p.model);
  const configuredProfiles = readAiProfiles()
    .map((p, i) => ({ index: i, profile: p }))
    .filter((x) => isSet(x.profile));
  const profileLabel = (p: AiProfile | null, i: number) =>
    p?.name ? `${p.name}（${p.model}）` : `${AI_PROFILE_LABELS[i]} · ${p?.model ?? '未配置'}`;

  // ══ 导出 Word（可编辑：正文为真文本，公式为 Word 原生公式对象）══
  const [wordExporting, setWordExporting] = useState(false);
  const exportWord = async () => {
    if (wordExporting || filteredEntries.length === 0) return;
    setWordExporting(true);
    try {
      const blob = await exportQaEntriesToDocx(filteredEntries);
      downloadBlob(blob, `Principia-答疑记录-${formatDate(Date.now())}.docx`);
      toast.success(`已导出 ${filteredEntries.length} 条记录为 Word（公式可编辑）`);
    } catch (err) {
      toast.error(`导出失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setWordExporting(false);
    }
  };

  // 导出 Word 对话框
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSel, setExportSel] = useState<Set<string>>(new Set());
  const [exportMode, setExportMode] = useState<'merge' | 'separate'>('merge');
  const [exporting, setExporting] = useState(false);
  const exportChosen = archive.filter((s) => exportSel.has(s.id));

  // 练习题生成
  const [practiceCourse, setPracticeCourse] = useState(
    () => subjectCourseList[0]?.id ?? 'calculus',
  );
  const [practiceCount, setPracticeCount] = useState('3');
  const [practiceLevel, setPracticeLevel] = useState('中等');
  const [practiceRaw, setPracticeRaw] = useState('');
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  // 学科切换时，练习课程重置为该学科课程列表的第一项，避免沿用旧学科课程
  useEffect(() => {
    setPracticeCourse(subjectCourseList[0]?.id ?? 'calculus');
  }, [subject]); // eslint-disable-line react-hooks/exhaustive-deps

  const practiceProblems = useMemo(
    () => parseGeneratedProblems(practiceRaw),
    [practiceRaw],
  );

  const runStream = async (
    messages: ChatMessage[],
    onChunk: (acc: string) => void,
    profileIndex?: number,
  ): Promise<string> => {
    const cfg =
      profileIndex !== undefined
        ? readProfileConfig(profileIndex)
        : readAiConfig();
    if (!cfg) {
      if (profileIndex !== undefined) {
        throw new Error(
          `「${AI_PROFILE_LABELS[profileIndex]}」尚未配置 API Key，请先在 AI 答疑页设置该存档。`,
        );
      }
      throw new Error('尚未配置 API Key，请先在 AI 答疑页完成密钥设置。');
    }
    let acc = '';
    for await (const chunk of streamChat(cfg, messages)) {
      acc += chunk;
      onChunk(acc);
    }
    return acc;
  };

  const generateSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    setSummary('');
    try {
      const recent = entries.slice(0, 50);
      const questionList = recent
        .map((e, i) => `${i + 1}. [${e.courseId ? getCourse(e.courseId)?.name ?? e.courseId : FREE_LABEL}] ${e.question}`)
        .join('\n');
      // 临时确定配置以记录所用模型
      const cfg = readProfileConfig(selectedProfile) ?? readAiConfig();
      if (!cfg) {
        throw new Error(
          `「${AI_PROFILE_LABELS[selectedProfile]}」尚未配置 API Key，请先在 AI 答疑页设置该存档。`,
        );
      }
      const summaryUser = isEn()
        ? `Here are the ${recent.length} questions I have asked the AI tutor on Principia:\n\n${questionList}\n\nAct as my study advisor and produce a summary including:\n1. **Question distribution**: summarize by course/topic what I mainly ask about;\n2. **Weak areas**: infer from the questions the topics I may not have mastered, with reasons;\n3. **Study suggestions**: give a concrete review roadmap (what to review first, then what to practice);\n4. **3 topics worth reviewing**: each with a one-sentence core reminder.`
        : `以下是我在 Principia 上向 AI 助教提出过的 ${recent.length} 个问题：\n\n${questionList}\n\n请作为我的学习顾问输出一份总结，包含：\n1. **问题分布**：按课程/知识点归纳我主要在问什么；\n2. **薄弱环节**：从问题反推我可能掌握不牢的知识点，说明理由；\n3. **学习建议**：给出一个具体的复习路线（先补什么、再练什么）；\n4. **值得复习的 3 个知识点**：各附一句核心提醒。`;
      const final = await runStream(
        [
          {
            role: 'system',
            content: MATH_TUTOR_SYSTEM_PROMPT(),
          },
          {
            role: 'user',
            content: summaryUser,
          },
        ],
        (acc) => setSummary(acc),
        selectedProfile,
      );
      // 留存：写入不同时间段的总结档案
      const record: StudySummary = {
        id: `sum-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        createdAt: Date.now(),
        model: cfg.model,
        profileIndex: selectedProfile,
        questionCount: recent.length,
        content: final,
      };
      saveSummary(record);
      setArchive(loadSummaries(userId));
      setSummary(''); // 已存入档案，避免重复展示
    } catch (err) {
      setSummaryError(describeAiError(err));
    } finally {
      setSummaryLoading(false);
    }
  };

  const generatePractice = async () => {
    setPracticeLoading(true);
    setPracticeError(null);
    setPracticeRaw('');
    setRevealed({});
    try {
      const course = localizeCourse(getCourse(practiceCourse)!);
      // 结合历史问题，让练习更有针对性
      const relatedQuestions = entries
        .filter((e) => e.courseId === practiceCourse)
        .slice(0, 10)
        .map((e) => e.question);
      const levelEn = practiceLevel === '基础' ? 'basic' : practiceLevel === '高阶' ? 'advanced' : 'intermediate';
      const relatedHintZh =
        relatedQuestions.length > 0
          ? `\n该学生历史上在该课程问过这些问题，请围绕这些薄弱点命题：\n${relatedQuestions.map((q) => `- ${q}`).join('\n')}`
          : '';
      const relatedHintEn =
        relatedQuestions.length > 0
          ? `\nThis student has previously asked these questions in this course; please design problems around these weak points:\n${relatedQuestions.map((q) => `- ${q}`).join('\n')}`
          : '';
      const practiceUser = isEn()
        ? `Please generate ${practiceCount} practice problems at ${levelEn} difficulty for "${course?.name ?? practiceCourse}".${relatedHintEn}\n\nOutput format (strictly follow): each problem starts with "### Problem N", followed by the statement (LaTeX with $ or $$), then a line "Hint:" with one key hint, then a line "Solution:" with the full step-by-step solution. Do not add anything else between problems.`
        : `请为我生成 ${practiceCount} 道「${course?.name ?? practiceCourse}」的${practiceLevel}难度练习题。${relatedHintZh}\n\n输出格式要求（严格遵守）：\n每道题以「### 题目 N」开头，随后是题干（LaTeX 公式用 $ 或 $$ 包裹），然后单独一行「提示：」给一条关键提示，再单独一行「解答：」给完整分步解答。题目之间不要加其他内容。`;
      await runStream(
        [
          { role: 'system', content: MATH_TUTOR_SYSTEM_PROMPT() },
          {
            role: 'user',
            content: practiceUser,
          },
        ],
        (acc) => setPracticeRaw(acc),
      );
    } catch (err) {
      setPracticeError(describeAiError(err));
    } finally {
      setPracticeLoading(false);
    }
  };

  // 打开导出对话框：默认合并、清空选择
  const openExportDialog = () => {
    setExportSel(new Set());
    setExportMode('merge');
    setExportOpen(true);
  };

  const toggleExport = (id: string) =>
    setExportSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // 确认导出：合并=1 个 Word；分开=每个各一个 Word
  const doExport = async () => {
    const chosen = exportChosen;
    if (chosen.length === 0) {
      toast.error('请先勾选要导出的总结');
      return;
    }
    setExporting(true);
    try {
      if (exportMode === 'merge') {
        const blob = await exportSummariesToDocx(chosen);
        downloadBlob(blob, `Principia-学习总结-合并${chosen.length}份.docx`);
        toast.success(`已导出 1 个合并 Word（含 ${chosen.length} 份总结）`);
      } else {
        for (let i = 0; i < chosen.length; i++) {
          const blob = await exportSummariesToDocx([chosen[i]]);
          downloadBlob(blob, `Principia-学习总结-${formatDate(chosen[i].createdAt)}.docx`);
          // 间隔一下，避免浏览器拦截连续下载
          if (i < chosen.length - 1) await new Promise((r) => setTimeout(r, 400));
        }
        toast.success(`已导出 ${chosen.length} 个 Word`);
      }
      setExportOpen(false);
    } catch (err) {
      toast.error(describeAiError(err));
    } finally {
      setExporting(false);
    }
  };

  // 专项练习 → Word 导出（真文本 + 可编辑公式）
  const [practiceExporting, setPracticeExporting] = useState(false);
  const exportPracticeWord = async () => {
    if (practiceProblems.length === 0 || practiceExporting) return;
    const course = getCourse(practiceCourse);
    setPracticeExporting(true);
    try {
      const blob = await exportPracticeToDocx({
        courseName: course?.name ?? practiceCourse,
        level: practiceLevel,
        problems: practiceProblems,
      });
      downloadBlob(
        blob,
        `Principia-专项练习-${course?.name ?? practiceCourse}-${formatDate(Date.now())}.docx`,
      );
      toast.success('已导出 Word');
    } catch (err) {
      toast.error(describeAiError(err));
    } finally {
      setPracticeExporting(false);
    }
  };

  const courseOfEntry = (courseId?: string) =>
    courseId ? getCourse(courseId) : undefined;

  return (
    <>
      <div className="container py-10 lg:py-14">
      {/* 页头 */}
      <FadeIn>
        <p className="text-sm font-semibold text-info tracking-wide mb-2">STUDY ARCHIVE</p>
        <h1 className="font-serif text-3xl font-semibold">学习档案</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl leading-relaxed">
          {user ? (
            <>
              当前账户：<span className="text-foreground font-medium">{user.name}</span>
              {user.email ? `（${user.email}）` : ''}。所有 AI 答疑记录按账户沉淀于此。
            </>
          ) : (
            <>
              当前为<span className="text-foreground font-medium">游客模式</span>，记录保存在本机浏览器。
              <Link to="/login" className="text-info hover:underline ml-1">登录后</Link>
              按账户隔离保存。
            </>
          )}
        </p>
      </FadeIn>

      {/* 统计卡片 */}
      <FadeIn delay={0.05}>
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border border-border bg-card p-5">
            <p className="font-serif text-3xl font-semibold text-info">{stats.total}</p>
            <p className="mt-1 text-sm text-muted-foreground">累计提问</p>
          </div>
          <div className="border border-border bg-card p-5">
            <p className="font-serif text-3xl font-semibold text-info">{stats.last7Days}</p>
            <p className="mt-1 text-sm text-muted-foreground">近 7 天提问</p>
          </div>
          <div className="border border-border bg-card p-5">
            <p className="font-serif text-3xl font-semibold text-info">
              {stats.byCourse.filter((c) => c.courseId !== 'free').length}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">涉及课程</p>
          </div>
          <div className="border border-border bg-card p-5">
            <p className="font-serif text-3xl font-semibold text-info">
              {stats.latestTs ? formatDate(stats.latestTs).slice(5, 10) : '—'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">最近活跃</p>
          </div>
        </div>
      </FadeIn>

      {/* 三个功能页签 */}
      <FadeIn delay={0.1}>
        <Tabs defaultValue="records" className="mt-10">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="records" className="gap-1.5">
              <MessageCircleQuestion className="h-4 w-4" />
              答疑记录
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-1.5">
              <BrainCircuit className="h-4 w-4" />
              AI 学习总结
            </TabsTrigger>
            <TabsTrigger value="practice" className="gap-1.5">
              <Dumbbell className="h-4 w-4" />
              专项练习生成
            </TabsTrigger>
          </TabsList>

          {/* ── 答疑记录 ── */}
          <TabsContent value="records" className="mt-6">
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="text-sm text-muted-foreground">筛选：</span>
              <button
                onClick={() => setFilter('all')}
                className={`text-xs px-2.5 py-1.5 border transition-colors duration-[var(--duration-fast)] ${
                  filter === 'all'
                    ? 'border-info bg-info/10 text-info'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                全部（{entries.length}）
              </button>
              {stats.byCourse.map((c) => {
                const course = courseOfEntry(c.courseId === 'free' ? undefined : c.courseId);
                return (
                  <button
                    key={c.courseId}
                    onClick={() => setFilter(c.courseId)}
                    className={`text-xs px-2.5 py-1.5 border transition-colors duration-[var(--duration-fast)] ${
                      filter === c.courseId
                        ? 'border-info bg-info/10 text-info'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {course?.name ?? FREE_LABEL}（{c.count}）
                  </button>
                );
              })}
              {entries.length > 0 && (
                <div className="ml-auto flex items-center gap-3">
                  <button
                    onClick={exportWord}
                    disabled={wordExporting || filteredEntries.length === 0}
                    className="flex items-center gap-1.5 text-xs text-info hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
                    title={filteredEntries.length === 0 ? '当前筛选下没有记录' : '导出为可编辑的 Word 文档（公式可在 Word 中编辑）'}
                  >
                    {wordExporting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileDown className="h-3.5 w-3.5" />
                    )}
                    {wordExporting
                      ? '正在导出…'
                      : `导出 Word（${filteredEntries.length} 条）`}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('确定清空全部答疑记录吗？此操作不可恢复。')) {
                        clearQaHistory(userId);
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors duration-[var(--duration-fast)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    清空记录
                  </button>
                </div>
              )}
            </div>

            {filteredEntries.length === 0 ? (
              <div className="border border-border bg-card py-16 text-center">
                <MessageCircleQuestion className="mx-auto h-10 w-10 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground">还没有答疑记录</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  去
                  <Link to="/tutor" className="text-info hover:underline mx-1">AI 答疑</Link>
                  问第一个问题吧，记录会自动出现在这里。
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEntries.map((e) => {
                  const course = courseOfEntry(e.courseId);
                  return (
                    <div key={e.id} className="border border-border bg-card">
                      <div className="flex items-center gap-2 border-b border-border px-5 py-3 text-xs text-muted-foreground">
                        {course && <CourseIcon name={course.icon} className="h-3.5 w-3.5 text-info" />}
                        <span className="font-medium text-info">{course?.name ?? FREE_LABEL}</span>
                        {e.topicTitle && (
                          <>
                            <span className="text-border">/</span>
                            <Link to={`/topics/${e.topicId}`} className="hover:text-foreground">
                              {e.topicTitle}
                            </Link>
                          </>
                        )}
                        <span className="ml-auto">{formatDate(e.ts)}</span>
                        {e.usage && (
                          <span
                            className="font-mono text-[10px] bg-secondary px-1.5 py-0.5"
                            title="本次回答 token 消耗：↑输入 ↓输出"
                          >
                            ↑{e.usage.prompt} ↓{e.usage.completion} · 共 {e.usage.total} tokens
                          </span>
                        )}
                        <button
                          onClick={() => deleteQaEntry(e.id)}
                          className="hover:text-destructive transition-colors duration-[var(--duration-fast)]"
                          aria-label="删除这条记录"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="p-5 space-y-4">
                        <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap"><InlineMathText escape text={e.question} /></p>
                        {/* 思考过程记录（可选） */}
                        {e.thinking && (
                          <details className="group">
                            <summary className="flex items-center gap-1.5 text-xs text-warning cursor-pointer select-none">
                              <BrainCircuit className="h-3.5 w-3.5" />
                              查看思考过程
                            </summary>
                            <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                              {e.thinking}
                            </div>
                          </details>
                        )}
                        <details className="group">
                          <summary className="flex items-center gap-1.5 text-xs text-info cursor-pointer select-none">
                            <Eye className="h-3.5 w-3.5" />
                            查看助教回答
                          </summary>
                          <div className="mt-3 border-t border-border pt-3">
                            <MathText escape content={e.answer} className="text-sm" />
                          </div>
                        </details>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── AI 学习总结 ── */}
          <TabsContent value="summary" className="mt-6 space-y-6">
            <div className="border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-serif text-xl font-semibold">AI 学习总结</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-xl">
                    把全部答疑记录交给 AI 分析：归纳问题分布、反推薄弱环节、
                    给出复习路线。记录越多，总结越准确。每次总结都会按时间留存，方便回看进步轨迹。
                  </p>
                </div>
                <Button
                  onClick={generateSummary}
                  disabled={summaryLoading || entries.length === 0 || configuredProfiles.length === 0}
                  className="bg-info text-info-foreground hover:bg-info/90 gap-1.5"
                >
                  {summaryLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {summaryLoading ? '生成中…' : '生成学习总结'}
                </Button>
              </div>

              {/* 选择生成所用的接口存档 / 模型 */}
              <div className="mt-5 max-w-md space-y-2">
                <label className="text-xs text-muted-foreground">生成所用模型（选择 API 存档）</label>
                <Select
                  value={String(selectedProfile)}
                  onValueChange={(v) => setSelectedProfile(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {configuredProfiles.map(({ index, profile }) => (
                      <SelectItem key={index} value={String(index)}>
                        {profileLabel(profile, index)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {configuredProfiles.length === 0 && (
                <p className="mt-4 text-sm text-muted-foreground">
                  还没有可用的 API 存档——请先到
                  <Link to="/tutor" className="text-info hover:underline mx-1">AI 答疑</Link>
                  配置接口与模型，再回来生成总结。
                </p>
              )}

              {entries.length === 0 && configuredProfiles.length > 0 && (
                <p className="mt-6 text-sm text-muted-foreground">
                  暂无记录可总结——先去
                  <Link to="/tutor" className="text-info hover:underline mx-1">AI 答疑</Link>
                  积累几个问题吧。
                </p>
              )}

              {summaryError && (
                <div className="mt-6 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {summaryError}
                </div>
              )}

              {summary && (
                <div className="mt-6 border-t border-border pt-6">
                  <MathText escape content={summary} className="text-sm" />
                  {summaryLoading && (
                    <span className="mt-2 inline-block text-xs text-info animate-pulse">正在输入…</span>
                  )}
                </div>
              )}
            </div>

            {/* 历史总结留存 */}
            <div className="border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-info" />
                  <h3 className="font-serif text-lg font-semibold">历史总结留存</h3>
                  <span className="text-xs text-muted-foreground">（共 {archive.length} 份 · 按时间倒序）</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {archive.length > 0 && (
                    <Button
                      onClick={openExportDialog}
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      title="把学习总结导出为可编辑的 Word 文档"
                    >
                      <FileDown className="h-4 w-4" />
                      导出 Word
                    </Button>
                  )}
                  {archive.length > 0 && (
                    <button
                      onClick={() => {
                        if (window.confirm('确定清空全部历史总结吗？此操作不可恢复。')) {
                          clearSummaries(userId);
                          setArchive(loadSummaries(userId));
                          // 同步重置导出勾选，避免残留已删除总结的 id 导致计数不符
                          setExportSel(new Set());
                        }
                      }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors duration-[var(--duration-fast)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      清空全部
                    </button>
                  )}
                </div>
              </div>

              {archive.length === 0 ? (
                <p className="mt-5 text-sm text-muted-foreground">
                  还没有留存任何总结。生成一份后，它会保存在这里，下次打开仍能查看。
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  {archive.map((s) => (
                    <div key={s.id} className="border border-border bg-background">
                      <div className="flex items-center gap-2 border-b border-border px-5 py-3 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 text-info" />
                        <span className="font-medium text-foreground">{formatDate(s.createdAt)}</span>
                        <span className="px-1.5 py-0.5 border border-border rounded text-[11px]">
                          {profileLabel(configuredProfiles.find((x) => x.index === s.profileIndex)?.profile ?? null, s.profileIndex)}
                        </span>
                        <span>模型 {s.model}</span>
                        <span>· 覆盖 {s.questionCount} 个问题</span>
                        <button
                          onClick={() => {
                            deleteSummary(s.id);
                            setArchive(loadSummaries(userId));
                          }}
                          className="ml-auto hover:text-destructive transition-colors duration-[var(--duration-fast)]"
                          aria-label="删除这份总结"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="p-5">
                        <MathText escape content={s.content} className="text-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── 专项练习生成 ── */}
          <TabsContent value="practice" className="mt-6">
            <div className="border border-border bg-card p-6">
              <h2 className="font-serif text-xl font-semibold">AI 专项练习生成</h2>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-xl">
                选择课程与难度，AI 结合你的答疑历史生成针对性练习题——先看提示独立思考，再对照完整解答。
              </p>

              <div className="mt-5 grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">课程</label>
                  <Select value={practiceCourse} onValueChange={setPracticeCourse}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {subjectCourseList.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">题目数量</label>
                  <Select value={practiceCount} onValueChange={setPracticeCount}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 道</SelectItem>
                      <SelectItem value="5">5 道</SelectItem>
                      <SelectItem value="8">8 道</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">难度</label>
                  <Select value={practiceLevel} onValueChange={setPracticeLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="基础">基础（概念直接应用）</SelectItem>
                      <SelectItem value="中等">中等（综合运用）</SelectItem>
                      <SelectItem value="提高">提高（竞赛/考研风格）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  onClick={generatePractice}
                  disabled={practiceLoading}
                  className="bg-info text-info-foreground hover:bg-info/90 gap-1.5"
                >
                  {practiceLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Dumbbell className="h-4 w-4" />
                  )}
                  {practiceLoading ? '生成中…' : '生成练习题'}
                </Button>
                <Button
                  variant="outline"
                  onClick={exportPracticeWord}
                  disabled={practiceProblems.length === 0 || practiceExporting}
                  className="gap-1.5"
                  title="把练习题（含提示与解答）导出为可编辑的 Word 文档"
                >
                  {practiceExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  {practiceExporting ? '导出中…' : '导出 Word'}
                </Button>
              </div>

              {practiceError && (
                <div className="mt-5 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {practiceError}
                </div>
              )}

              {practiceProblems.length > 0 && (
                <div className="mt-8 space-y-5">
                  {practiceProblems.map((p, i) => (
                    <div key={i} className="border border-border bg-background">
                      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                        <span className="flex h-6 w-6 items-center justify-center bg-info/10 text-info font-mono text-xs font-semibold">
                          {i + 1}
                        </span>
                        <h3 className="font-serif text-base font-semibold"><InlineMathText escape text={p.title} /></h3>
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto gap-1.5 text-xs"
                          onClick={() => {
                            const parts = [p.question];
                            if (p.hint) parts.push('【提示】' + p.hint);
                            if (p.solution) parts.push('【解答】' + p.solution);
                            const res = addMistake({
                              userId,
                              courseId: practiceCourse,
                              title: p.title,
                              content: parts.filter(Boolean).join('\n\n'),
                              source: 'ai',
                            });
                            if (res.ok) toast.success('已加入错题本');
                            else toast.error(res.error);
                          }}
                        >
                          <BookX className="h-3.5 w-3.5" />
                          加入错题本
                        </Button>
                      </div>
                      <div className="p-5 space-y-4">
                        <MathText escape content={p.question} className="text-sm" />
                        {p.hint && (
                          <div className="border border-warning/30 bg-warning/5 px-4 py-3">
                            <p className="flex items-center gap-1.5 text-xs font-medium text-warning mb-1.5">
                              <Lightbulb className="h-3.5 w-3.5" />
                              提示
                            </p>
                            <MathText escape content={p.hint} className="text-sm" />
                          </div>
                        )}
                        {p.solution && (
                          <div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setRevealed((r) => ({ ...r, [i]: !r[i] }))
                              }
                              className="gap-1.5"
                            >
                              {revealed[i] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                              {revealed[i] ? '隐藏解答' : '显示解答'}
                            </Button>
                            {revealed[i] && (
                              <div className="mt-3 border-t border-border pt-3">
                                <MathText escape content={p.solution} className="text-sm" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {practiceRaw && practiceProblems.length === 0 && !practiceLoading && (
                <div className="mt-8 border border-border bg-background p-5">
                  <p className="text-xs text-muted-foreground mb-3">AI 输出（未按标准格式解析，原文展示）：</p>
                  <MathText escape content={practiceRaw} className="text-sm" />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </FadeIn>

      {/* 底部引导 */}
      <FadeIn delay={0.15}>
        <div className="mt-10 border border-border bg-card px-6 py-5 flex flex-wrap items-center gap-4">
          <p className="text-sm text-muted-foreground flex-1 min-w-[200px]">
            答疑记录来自 AI 答疑页的每一次提问；换个角度复习，可以配合
            <Link to="/knowledge" className="text-info hover:underline mx-1">知识点检索</Link>
            定位薄弱章节。
          </p>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/knowledge">
              去检索知识点
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </FadeIn>
      </div>

      {/* ── 导出 Word 对话框 ── */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-info" />
              导出学习总结
            </DialogTitle>
            <DialogDescription>
              勾选要导出的总结，再选择「合并为一个 Word」或「分开导出多个 Word」。
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              共 {archive.length} 份 · 已选 {exportChosen.length} 份
            </span>
            <button
              onClick={() =>
                setExportSel(
                  exportChosen.length === archive.length
                    ? new Set()
                    : new Set(archive.map((s) => s.id)),
                )
              }
              className="text-xs text-info hover:underline"
            >
              {exportChosen.length === archive.length ? '取消全选' : '全选'}
            </button>
          </div>

          <div className="max-h-72 overflow-auto space-y-1 border border-border bg-background p-2">
            {archive.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={exportSel.has(s.id)}
                  onChange={() => toggleExport(s.id)}
                  style={{ accentColor: 'hsl(var(--info))' }}
                  className="h-4 w-4 cursor-pointer"
                />
                <span className="text-sm">{formatDate(s.createdAt)}</span>
                <span className="text-xs text-muted-foreground">模型 {s.model}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  覆盖 {s.questionCount} 个问题
                </span>
              </label>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={() => setExportMode('merge')}
              className={`text-left border p-3 transition-colors duration-[var(--duration-fast)] ${
                exportMode === 'merge'
                  ? 'border-info bg-info/10'
                  : 'border-border hover:border-info/50'
              }`}
            >
              <span className="text-sm font-medium">合并为一个 Word</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                所选总结合并成 1 个文件
              </span>
            </button>
            <button
              onClick={() => setExportMode('separate')}
              className={`text-left border p-3 transition-colors duration-[var(--duration-fast)] ${
                exportMode === 'separate'
                  ? 'border-info bg-info/10'
                  : 'border-border hover:border-info/50'
              }`}
            >
              <span className="text-sm font-medium">分开导出</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                每份各 1 个 Word，共 {exportChosen.length} 个文件
              </span>
            </button>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setExportOpen(false)}
              disabled={exporting}
            >
              取消
            </Button>
            <Button
              onClick={() => void doExport()}
              disabled={exporting || exportChosen.length === 0}
              className="bg-info text-info-foreground hover:bg-info/90 gap-1.5"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              {exporting
                ? '导出中…'
                : `确认导出${exportChosen.length ? `（${exportChosen.length} 份）` : ''}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
};

export default Study;
