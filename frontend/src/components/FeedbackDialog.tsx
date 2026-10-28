import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Clock3, Github, Inbox, Mail, MessageSquarePlus, Send } from 'lucide-react';

/** 反馈直达通道配置：仓库（GitHub Issue 通道）与邮箱（留空则隐藏邮件按钮） */
const PRINCIPIA_REPO = 'azdezhishijiangtang/Principia';
const FEEDBACK_EMAIL = ''; // 例：'someone@example.com'——填上后反馈窗口会出现「邮件发送」按钮
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { useT } from '@/i18n/LocaleContext';
import { tpl } from '@/i18n/translate';
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
  addFeedback,
  encodeFeedbackReport,
  loadUnreported,
  markAllReported,
  useUserFeedback,
  type FeedbackStatus,
  type FeedbackType,
} from '@/lib/feedback';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusStyle: Record<FeedbackStatus, string> = {
  pending: 'border-warning/40 bg-warning/10 text-warning',
  replied: 'border-success/40 bg-success/10 text-success',
  closed: 'border-border bg-secondary text-muted-foreground',
};

const typeStyle: Record<FeedbackType, string> = {
  bug: 'border-destructive/40 bg-destructive/10 text-destructive',
  suggestion: 'border-info/40 bg-info/10 text-info',
  content: 'border-warning/40 bg-warning/10 text-warning',
  other: 'border-border bg-secondary text-muted-foreground',
};

const formatTime = (ts: number): string =>
  new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const FeedbackDialog = ({ open, onOpenChange }: FeedbackDialogProps) => {
  const t = useT();
  const { user } = useAuth();
  const userId = user?.id ?? 'guest';
  const mine = useUserFeedback(userId);

  const [tab, setTab] = useState('write');
  const [type, setType] = useState<FeedbackType>('suggestion');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');

  const submit = () => {
    if (!title.trim() || !content.trim()) {
      toast.error(t('请填写标题和详细描述'));
      return;
    }
    const res = addFeedback({
      userId,
      userName: user?.name ?? t('访客'),
      type,
      title: title.trim(),
      content: content.trim(),
      contact: contact.trim() || undefined,
      pageUrl: `${window.location.pathname}${window.location.search}`,
    });
    if (!res.ok) {
      toast.error(res.error ?? t('反馈提交失败'));
      return;
    }
    toast.success(t('反馈已提交，感谢你的建议！'));
    setTitle('');
    setContent('');
    setContact('');
    setType('suggestion');
    setTab('mine');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-info" />
            {t('建议反馈')}
          </DialogTitle>
          <DialogDescription>
            {t('发现内容错误、功能异常，或希望增加什么？告诉我们，开发者会在此回复你。')}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="write">{t('提交反馈')}</TabsTrigger>
            <TabsTrigger value="mine">
              {t('我的反馈')}
              {mine.length > 0 ? tpl('（{n}）', { n: mine.length }) : ''}
            </TabsTrigger>
          </TabsList>

          {/* ── 提交 ── */}
          <TabsContent value="write" className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fb-type">{t('反馈类型')}</Label>
                <Select value={type} onValueChange={(v) => setType(v as FeedbackType)}>
                  <SelectTrigger id="fb-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FEEDBACK_TYPE_LABELS) as FeedbackType[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {FEEDBACK_TYPE_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fb-contact">{t('联系方式（选填）')}</Label>
                <Input
                  id="fb-contact"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={t('邮箱 / 微信，方便进一步沟通')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-title">
                {t('标题')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('一句话概括你的反馈')}
                maxLength={80}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fb-content">
                {t('详细描述')} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="fb-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('请尽量描述清楚：出现在哪个页面、期望的效果、复现步骤等')}
                rows={6}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">{content.length}/2000</p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                {t('当前身份：')}
                {user?.name ?? t('访客（未登录）')}
              </p>
              <Button onClick={submit} className="gap-2">
                <Send className="h-4 w-4" />
                {t('提交反馈')}
              </Button>
            </div>
          </TabsContent>

          {/* ── 我的反馈 ── */}
          <TabsContent value="mine" className="mt-5">
            {/* 送达开发者：GitHub Issue 直达（主）/ 邮件（可选）/ 上报码（兜底） */}
            <div className="mb-4 border border-border bg-muted/30 p-4 space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Send className="h-4 w-4 text-info" />
                {t('把反馈直达开发者')}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    const items = loadUnreported();
                    if (items.length === 0) {
                      toast.info(t('没有待发送的反馈（都已送达过）'));
                      return;
                    }
                    const list = items
                      .map(
                        (e, i) =>
                          `${i + 1}. 【${FEEDBACK_TYPE_LABELS[e.type]}】${e.title}\n${e.content}${e.contact ? `\n   ${t('联系方式：')}${e.contact}` : ''}`,
                      )
                      .join('\n\n');
                    const title =
                      items.length === 1
                        ? `【${FEEDBACK_TYPE_LABELS[items[0].type]}】${items[0].title}`
                        : `【用户反馈】${items.length} 条打包（${items[0].userName}）`;
                    const body = `${list}\n\n——\n${t('来自：')}${items[0].userName} · ${items[0].pageUrl ?? '/'}\n（${t('此 Issue 由站内反馈窗口生成；Issue 公开可见，请勿填写敏感信息。')}）`;
                    window.open(
                      `https://github.com/${PRINCIPIA_REPO}/issues/new?title=${encodeURIComponent(title.slice(0, 120))}&body=${encodeURIComponent(body.slice(0, 4000))}`,
                      '_blank',
                    );
                    markAllReported();
                    toast.success(t('已打开 GitHub：登录后点 Submit new issue 即送达，开发者会立刻收到通知'));
                  }}
                >
                  <Github className="h-3.5 w-3.5" />
                  {t('GitHub 直达（推荐）')}
                </Button>
                {FEEDBACK_EMAIL && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      const items = loadUnreported();
                      if (items.length === 0) {
                        toast.info(t('没有待发送的反馈（都已送达过）'));
                        return;
                      }
                      const list = items
                        .map(
                          (e, i) =>
                            `${i + 1}. 【${FEEDBACK_TYPE_LABELS[e.type]}】${e.title}\n${e.content}${e.contact ? `\n   ${t('联系方式：')}${e.contact}` : ''}`,
                        )
                        .join('\n\n');
                      const subject =
                        items.length === 1
                          ? `【Principia 反馈】${items[0].title}`
                          : `【Principia 反馈】${items.length} 条打包（${items[0].userName}）`;
                      window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(list)}`;
                      markAllReported();
                      toast.success(t('已唤起邮件客户端：发送即送达'));
                    }}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    {t('邮件发送')}
                  </Button>
                )}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t('GitHub 通道会自动填好反馈内容，登录后一键提交，开发者即时收到通知（无需加微信）。')}
                {!mine.some((e) => !e.reportedAt) && mine.length > 0 ? t('当前没有待发送的反馈。') : ''}
                {t('没有 GitHub / 邮箱？')}
                <button
                  className="text-info hover:underline"
                  onClick={() => {
                    const r = encodeFeedbackReport();
                    if ('error' in r) {
                      toast.info(t(r.error));
                      return;
                    }
                    navigator.clipboard?.writeText(r.code).then(
                      () => toast.success(tpl('已复制 {n} 条反馈的上报码——粘贴发给开发者即可', { n: r.count })),
                      () => toast.error(t('复制失败：请手动复制生成的内容')),
                    );
                  }}
                >
                  {t('生成上报码发给开发者')}
                </button>
              </p>
            </div>
            {mine.length === 0 ? (
              <div className="border border-dashed border-border py-14 text-center">
                <Inbox className="mx-auto h-8 w-8 text-muted-foreground/60" />
                <p className="mt-3 text-sm text-muted-foreground">
                  {t('还没有提交过反馈，去「提交反馈」说说你的想法吧')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {mine.map((item) => (
                  <div key={item.id} className="border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium leading-snug">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatTime(item.createdAt)}
                          {item.pageUrl ? tpl(' · 来自 {url}', { url: item.pageUrl }) : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={`text-xs border px-1.5 py-0.5 ${typeStyle[item.type]}`}>
                          {FEEDBACK_TYPE_LABELS[item.type]}
                        </span>
                        <span
                          className={`text-xs border px-1.5 py-0.5 ${statusStyle[item.status]}`}
                        >
                          {FEEDBACK_STATUS_LABELS[item.status]}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {item.content}
                    </p>

                    {item.replies.length > 0 ? (
                      <div className="mt-3 space-y-2 border-l-2 border-info/40 pl-3">
                        {item.replies.map((r) => (
                          <div key={r.id}>
                            <p className="flex items-center gap-1.5 text-xs font-medium text-info">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {r.by}
                              {t('回复 · ')}
                              {formatTime(r.at)}
                            </p>
                            <p className="mt-1 text-sm whitespace-pre-wrap leading-relaxed">
                              {r.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" />
                        {t('已收到，等待开发者处理')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackDialog;
