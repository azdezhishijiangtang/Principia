import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BarChart3,
  CheckCircle2,
  FilePenLine,
  KeyRound,
  LogIn,
  MessageSquare,
  RotateCcw,
  Save,
  ShieldX,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { courses, courseCategories } from '@/data/courses';
import { topics } from '@/data/topics';
import { problems } from '@/data/problems';
import { formulaGroups } from '@/data/formulas';
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
  countPending,
  deleteFeedback,
  replyFeedback,
  setFeedbackStatus,
  useAllFeedback,
  type FeedbackStatus,
} from '@/lib/feedback';
import {
  applyTopicOverrides,
  countOverrides,
  loadOverrides,
  removeOverride,
  saveOverride,
} from '@/lib/contentOverrides';
import { countAccounts } from '@/lib/accountStore';
import { isDevUser, useAuth } from '@/lib/AuthContext';
import { InlineMathText } from '@/components/MathText';

const formatTime = (ts: number): string =>
  new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const statusStyle: Record<FeedbackStatus, string> = {
  pending: 'border-warning/40 bg-warning/10 text-warning',
  replied: 'border-success/40 bg-success/10 text-success',
  closed: 'border-border bg-secondary text-muted-foreground',
};

/* ─────────────────────────── 无权访问页 ─────────────────────────── */
const AccessDenied = ({ loggedIn }: { loggedIn: boolean }) => (
  <div className="container py-24">
    <div className="mx-auto max-w-md border border-border bg-card p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center bg-destructive/10 text-destructive">
        <ShieldX className="h-6 w-6" />
      </span>
      <h1 className="mt-4 font-serif text-2xl font-semibold">无权访问</h1>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        开发者模式仅对指定的开发者账号开放。
        {loggedIn
          ? '当前登录账号不是开发者账号，请退出后使用开发者手机号登录。'
          : '请先登录开发者账号后再访问。'}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        {!loggedIn && (
          <Button asChild className="w-full gap-2 bg-info text-info-foreground hover:bg-info/90">
            <Link to="/login">
              <LogIn className="h-4 w-4" />
              前往登录
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="w-full">
          <Link to="/">返回首页</Link>
        </Button>
      </div>
    </div>
  </div>
);

/* ─────────────────────────── 反馈管理 ─────────────────────────── */
const FeedbackAdmin = () => {
  const all = useAllFeedback();
  const [filter, setFilter] = useState<'all' | FeedbackStatus>('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const list = filter === 'all' ? all : all.filter((e) => e.status === filter);

  const submitReply = (id: string) => {
    if (!draft.trim()) {
      toast.error('回复内容不能为空');
      return;
    }
    replyFeedback(id, draft.trim());
    setDraft('');
    setActiveId(null);
    toast.success('回复已发送');
  };

  const filters: { key: 'all' | FeedbackStatus; label: string }[] = [
    { key: 'all', label: `全部 ${all.length}` },
    { key: 'pending', label: `待处理 ${all.filter((e) => e.status === 'pending').length}` },
    { key: 'replied', label: `已回复 ${all.filter((e) => e.status === 'replied').length}` },
    { key: 'closed', label: `已关闭 ${all.filter((e) => e.status === 'closed').length}` },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? 'default' : 'outline'}
            onClick={() => setFilter(f.key)}
            className={filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="mt-8 border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          暂无反馈
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {list.map((item) => (
            <div key={item.id} className="border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.userName} · {formatTime(item.createdAt)}
                    {item.contact ? ` · 联系：${item.contact}` : ''}
                    {item.pageUrl ? ` · ${item.pageUrl}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="border border-border bg-secondary px-1.5 py-0.5 text-xs">
                    {FEEDBACK_TYPE_LABELS[item.type]}
                  </span>
                  <span className={`border px-1.5 py-0.5 text-xs ${statusStyle[item.status]}`}>
                    {FEEDBACK_STATUS_LABELS[item.status]}
                  </span>
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                {item.content}
              </p>

              {item.replies.length > 0 && (
                <div className="mt-3 space-y-2 border-l-2 border-info/40 pl-3">
                  {item.replies.map((r) => (
                    <div key={r.id}>
                      <p className="text-xs font-medium text-info">
                        {r.by} · {formatTime(r.at)}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm">{r.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeId === item.id ? (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    placeholder="输入官方回复……"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1.5" onClick={() => submitReply(item.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      发送回复
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setActiveId(null)}>
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      setActiveId(item.id);
                      setDraft('');
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    回复
                  </Button>
                  {item.status !== 'closed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => {
                        setFeedbackStatus(item.id, 'closed');
                        toast.success('已关闭');
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      关闭
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => {
                      deleteFeedback(item.id);
                      toast.success('已删除');
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────── 内容编辑 ─────────────────────────── */
const ContentAdmin = () => {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const courseTopics = useMemo(
    () => topics.filter((t) => t.courseId === courseId),
    [courseId],
  );
  const [topicId, setTopicId] = useState(courseTopics[0]?.id ?? '');
  const [draft, setDraft] = useState({ title: '', summary: '', content: '' });

  useEffect(() => {
    setTopicId(topics.find((t) => t.courseId === courseId)?.id ?? '');
  }, [courseId]);

  const topic = topics.find((t) => t.id === topicId);

  useEffect(() => {
    if (topic) setDraft({ title: topic.title, summary: topic.summary, content: topic.content });
  }, [topicId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    !!topic &&
    (draft.title !== topic.title ||
      draft.summary !== topic.summary ||
      draft.content !== topic.content);

  const save = () => {
    if (!topic) return;
    if (!draft.title.trim() || !draft.content.trim()) {
      toast.error('标题与正文不能为空');
      return;
    }
    saveOverride(topic.id, draft);
    applyTopicOverrides(topics);
    toast.success('已保存，进入该专题即可看到更新');
  };

  const reset = () => {
    if (topic) setDraft({ title: topic.title, summary: topic.summary, content: topic.content });
  };

  const remove = () => {
    if (!topic) return;
    removeOverride(topic.id);
    toast.success('已撤销本地覆盖，刷新页面后恢复源码原文');
  };

  const overrideCount = countOverrides();
  const overridden = topic ? Boolean(loadOverrides()[topic.id]) : false;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">课程</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">知识点（{courseTopics.length} 个）</Label>
          <Select value={topicId} onValueChange={setTopicId}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="选择知识点" />
            </SelectTrigger>
            <SelectContent>
              {courseTopics.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <InlineMathText text={t.title} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="pb-2 text-xs text-muted-foreground">
          本地覆盖 {overrideCount} 个
          {overridden && <span className="ml-2 text-info">· 当前专题已被覆盖</span>}
        </span>
      </div>

      {topic && (
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label>标题</Label>
            <Input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>摘要</Label>
            <Textarea
              value={draft.summary}
              onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>讲解正文（Markdown + LaTeX）</Label>
              <span className="text-xs text-muted-foreground">
                {draft.content.length} 字符
              </span>
            </div>
            <Textarea
              value={draft.content}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
              rows={20}
              className="font-mono text-xs leading-relaxed"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button className="gap-1.5" onClick={save} disabled={!dirty}>
              <Save className="h-4 w-4" />
              保存覆盖
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={reset} disabled={!dirty}>
              <RotateCcw className="h-4 w-4" />
              还原编辑
            </Button>
            <Button
              variant="outline"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={remove}
              disabled={!overridden}
            >
              <Trash2 className="h-4 w-4" />
              撤销本地覆盖
            </Button>
            <Link
              to={`/topics/${topic.id}`}
              className="ml-auto text-sm text-info hover:underline"
            >
              查看该专题 →
            </Link>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            说明：覆盖保存在当前浏览器的 localStorage，仅本机可见。要让所有访客看到，
            需要把修改同步进源码后重新构建发布。
          </p>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────── 数据概览 ─────────────────────────── */
const StatsAdmin = () => {
  const all = useAllFeedback();
  const cards = [
    { label: '课程', value: courses.length },
    { label: '知识专题', value: topics.length },
    { label: '例题', value: problems.length },
    { label: '速查公式', value: formulaGroups.reduce((s, g) => s + g.formulas.length, 0) },
    { label: '反馈总数', value: all.length },
    { label: '待处理反馈', value: countPending(all) },
    { label: '手机号注册账户', value: countAccounts() },
    { label: '本地内容覆盖', value: countOverrides() },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="border border-border bg-card p-4">
            <p className="font-serif text-3xl font-semibold text-info">{c.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-8 font-serif text-lg font-semibold">各学科方向专题分布</h3>
      <div className="mt-3 space-y-2">
        {courseCategories.map((cat) => {
          const count = topics.filter((t) => cat.courseIds.includes(t.courseId)).length;
          const max = Math.max(
            ...courseCategories.map(
              (c) => topics.filter((t) => c.courseIds.includes(t.courseId)).length,
            ),
          );
          return (
            <div key={cat.id} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm">{cat.name}</span>
              <div className="h-2 flex-1 bg-secondary">
                <div
                  className="h-2 bg-info"
                  style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                {count} 专题
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─────────────────────────── 页面 ─────────────────────────── */
const DevMode = () => {
  const { user } = useAuth();

  // 开发者模式仅对指定开发者账号（DEV_PHONE）开放，其他账号一律拒绝
  if (!isDevUser(user)) return <AccessDenied loggedIn={Boolean(user)} />;

  return (
    <div className="container py-12 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-wide text-info">
            <KeyRound className="h-4 w-4" />
            开发者模式 · {user?.phone}
          </p>
          <h1 className="font-serif text-3xl font-semibold">站点管理台</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            回复用户反馈、更新知识点讲解、查看数据概览。
          </p>
        </div>
        <Button asChild variant="outline" className="gap-1.5">
          <Link to="/">
            <XCircle className="h-4 w-4" />
            退出开发者模式
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="feedback" className="mt-8">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="feedback" className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            反馈管理
          </TabsTrigger>
          <TabsTrigger value="content" className="gap-1.5">
            <FilePenLine className="h-4 w-4" />
            内容编辑
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5">
            <BarChart3 className="h-4 w-4" />
            数据概览
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feedback" className="mt-6">
          <FeedbackAdmin />
        </TabsContent>
        <TabsContent value="content" className="mt-6">
          <ContentAdmin />
        </TabsContent>
        <TabsContent value="stats" className="mt-6">
          <StatsAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DevMode;
