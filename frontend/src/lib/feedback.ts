/**
 * 建议反馈：把用户提交的建议/问题/内容纠错保存到 localStorage，
 * 开发者模式（/dev）可查看并回复。每次写入后通过发布订阅通知 React 刷新。
 */
import { useMemo, useSyncExternalStore } from 'react';

export type FeedbackType = 'bug' | 'suggestion' | 'content' | 'other';
export type FeedbackStatus = 'pending' | 'replied' | 'closed';

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: '功能异常',
  suggestion: '改进建议',
  content: '内容纠错',
  other: '其他',
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  pending: '待处理',
  replied: '已回复',
  closed: '已关闭',
};

export interface FeedbackReply {
  id: string;
  content: string;
  at: number;
  /** 回复者（开发者模式固定为「开发者」） */
  by: string;
}

export interface FeedbackEntry {
  id: string;
  userId: string;
  userName: string;
  type: FeedbackType;
  title: string;
  content: string;
  /** 可选联系方式（邮箱/微信等） */
  contact?: string;
  /** 提交时所在页面路径 */
  pageUrl?: string;
  createdAt: number;
  status: FeedbackStatus;
  replies: FeedbackReply[];
  /** 上报标记：生成上报码的时间戳（上报侧本机使用；导入侧不设置） */
  reportedAt?: number;
}

const STORAGE_KEY = 'mathlens-feedback-v1';

const readAll = (): FeedbackEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FeedbackEntry[]) : [];
  } catch {
    return [];
  }
};

/** localStorage 写入结果：失败时 ok=false 并带中文原因，供调用方提示用户 */
export interface WriteResult {
  ok: boolean;
  error?: string;
}

const writeAll = (entries: FeedbackEntry[]): WriteResult => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    emitChange();
    return { ok: true };
  } catch {
    emitChange();
    return { ok: false, error: '存储空间不足，请清理旧数据' };
  }
};

const listeners = new Set<() => void>();
const emitChange = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) emitChange();
  });
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** 提交一条反馈 */
export const addFeedback = (
  input: Omit<FeedbackEntry, 'id' | 'createdAt' | 'status' | 'replies'>,
): WriteResult & { entry?: FeedbackEntry } => {
  const entry: FeedbackEntry = {
    ...input,
    id: newId('fb'),
    createdAt: Date.now(),
    status: 'pending',
    replies: [],
  };
  const res = writeAll([...readAll(), entry]);
  return res.ok ? { ok: true, entry } : res;
};

/** 全部反馈（最新在前） */
export const loadAllFeedback = (): FeedbackEntry[] =>
  readAll().sort((a, b) => b.createdAt - a.createdAt);

/** 某用户的反馈（最新在前） */
export const loadFeedbackByUser = (userId: string): FeedbackEntry[] =>
  readAll()
    .filter((e) => e.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);

/** 开发者回复 */
export const replyFeedback = (id: string, content: string, by = '开发者'): WriteResult => {
  const list = readAll().map((e) =>
    e.id === id
      ? {
          ...e,
          status: 'replied' as FeedbackStatus,
          replies: [...e.replies, { id: newId('rp'), content, at: Date.now(), by }],
        }
      : e,
  );
  return writeAll(list);
};

export const setFeedbackStatus = (id: string, status: FeedbackStatus): WriteResult => {
  return writeAll(readAll().map((e) => (e.id === id ? { ...e, status } : e)));
};

export const deleteFeedback = (id: string): WriteResult => {
  return writeAll(readAll().filter((e) => e.id !== id));
};

/** 订阅全部反馈 */
export const useAllFeedback = (): FeedbackEntry[] => {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(loadAllFeedback()),
    () => '[]',
  );
  return useMemo(() => JSON.parse(snapshot) as FeedbackEntry[], [snapshot]);
};

/** 订阅某用户的反馈 */
export const useUserFeedback = (userId: string): FeedbackEntry[] => {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(loadFeedbackByUser(userId)),
    () => '[]',
  );
  return useMemo(() => JSON.parse(snapshot) as FeedbackEntry[], [snapshot]);
};

/** 统计：未处理数量 */
export const countPending = (entries: FeedbackEntry[]): number =>
  entries.filter((e) => e.status === 'pending').length;

/* ─────────────────── 反馈上报：跨设备送达开发者（无服务器方案） ─────────────────── */
/**
 * 本站没有服务器：用户提交的反馈只存在他自己设备的浏览器里，开发者看不到。
 * 这里复用「账号同步码」的既有模式：
 *   用户侧：反馈对话框 → 生成「反馈上报码」→ 微信等聊天工具发给开发者；
 *   开发者侧：开发者模式（/dev）反馈管理 → 粘贴上报码导入 → 立即可见、可回复。
 * 上报码按条目 id 去重，重复导入安全；上报后本机打上 reportedAt 标记，避免重复搬运。
 */

/** UTF-8 安全的 base64（与 archiveSync.ts 同实现） */
const toB64 = (s: string): string => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
};

const fromB64 = (s: string): string => {
  const bin = atob(s.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

export interface FeedbackReportPayload {
  source: 'principia-feedback-report';
  version: 1;
  exportedAt: number;
  entries: FeedbackEntry[];
}

/** 生成反馈上报码：打包本机全部「未上报」反馈，并就地打上已上报标记 */
export const encodeFeedbackReport = (): { code: string; count: number } | { error: string } => {
  const all = readAll();
  const pending = all.filter((e) => !e.reportedAt);
  if (pending.length === 0) return { error: '没有待上报的反馈（都已打包过，新提交后可再次生成）' };
  const payload: FeedbackReportPayload = {
    source: 'principia-feedback-report',
    version: 1,
    exportedAt: Date.now(),
    entries: pending,
  };
  const marked = all.map((e) => (e.reportedAt ? e : { ...e, reportedAt: Date.now() }));
  const res = writeAll(marked);
  if (!res.ok) return { error: res.error ?? '保存失败' };
  return { code: toB64(JSON.stringify(payload)), count: pending.length };
};

/** 解析反馈上报码；给出可读的中文错误 */
export const decodeFeedbackReport = (
  code: string,
): { ok: true; entries: FeedbackEntry[] } | { ok: false; error: string } => {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: '请先粘贴反馈上报码' };
  let payload: FeedbackReportPayload;
  try {
    payload = JSON.parse(fromB64(trimmed)) as FeedbackReportPayload;
  } catch {
    return { ok: false, error: '上报码格式不正确：请确认完整复制、没有缺字符' };
  }
  if (!payload || payload.source !== 'principia-feedback-report' || !Array.isArray(payload.entries)) {
    return { ok: false, error: '这不是 Principia 的反馈上报码' };
  }
  const clean = payload.entries.filter(
    (e) => e && typeof e.id === 'string' && typeof e.title === 'string' && typeof e.content === 'string',
  );
  if (clean.length === 0) return { ok: false, error: '上报码里没有有效反馈' };
  return { ok: true, entries: clean };
};

/** 开发者导入：按 id 去重合并进本机反馈池，导入后反馈管理列表立即可见（订阅自动刷新） */
export const importFeedbackReport = (incoming: FeedbackEntry[]): { added: number } & WriteResult => {
  const existing = readAll();
  const ids = new Set(existing.map((e) => e.id));
  const fresh = incoming.filter((e) => !ids.has(e.id));
  const res = writeAll([...existing, ...fresh]);
  return res.ok ? { added: fresh.length, ok: true } : { added: 0, ok: false, error: res.error };
};

/** 本机待上报的反馈条数（供 UI 提示） */
export const countUnreported = (): number => readAll().filter((e) => !e.reportedAt).length;

/** 本机未上报的反馈（最新在前）——供 GitHub Issue / 邮件直发打包 */
export const loadUnreported = (): FeedbackEntry[] =>
  readAll()
    .filter((e) => !e.reportedAt)
    .sort((a, b) => b.createdAt - a.createdAt);

/** 全部标记为已上报：GitHub Issue / 邮件直发成功后调用，避免重复打包 */
export const markAllReported = (): WriteResult =>
  writeAll(readAll().map((e) => (e.reportedAt ? e : { ...e, reportedAt: Date.now() })));
