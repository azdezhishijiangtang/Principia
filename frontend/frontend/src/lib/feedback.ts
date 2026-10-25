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

const writeAll = (entries: FeedbackEntry[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* 存储失败时静默降级 */
  }
  emitChange();
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
): FeedbackEntry => {
  const entry: FeedbackEntry = {
    ...input,
    id: newId('fb'),
    createdAt: Date.now(),
    status: 'pending',
    replies: [],
  };
  writeAll([...readAll(), entry]);
  return entry;
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
export const replyFeedback = (id: string, content: string, by = '开发者'): void => {
  const list = readAll().map((e) =>
    e.id === id
      ? {
          ...e,
          status: 'replied' as FeedbackStatus,
          replies: [...e.replies, { id: newId('rp'), content, at: Date.now(), by }],
        }
      : e,
  );
  writeAll(list);
};

export const setFeedbackStatus = (id: string, status: FeedbackStatus): void => {
  writeAll(readAll().map((e) => (e.id === id ? { ...e, status } : e)));
};

export const deleteFeedback = (id: string): void => {
  writeAll(readAll().filter((e) => e.id !== id));
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
