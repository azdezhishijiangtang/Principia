/**
 * 答疑对话核心：流式对话 + 知识点上下文 + 文档知识库检索（RAG）+ 记忆沉淀。
 * Tutor 答疑台与全局悬浮"问 AI"组件共用本 hook，保证行为一致。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  readAiConfig,
  streamChat,
  type ChatMeta,
  describeAiError,
  MATH_TUTOR_SYSTEM_PROMPT,
  getModeGuidance,
  resolveThinkingMode,
  type ChatMessage,
} from '@/lib/ai';
import { addQaEntry, type QaSource } from '@/lib/qaHistory';
import { retrieveChunks } from '@/lib/docLibrary';
import { getTopic } from '@/data/topics';
import { getCourse } from '@/data/courses';
import type { Topic } from '@/types';

export interface TutorMessage {
  role: 'user' | 'assistant';
  content: string;
  /** 模型的思考过程（assistant 消息，来自 reasoning_content） */
  reasoning?: string;
  /** 回答引用的文档段落（assistant 消息） */
  sources?: QaSource[];
  /** 接入的模型名（assistant 消息） */
  model?: string;
  /** token 用量（assistant 消息） */
  usage?: { prompt: number; completion: number; total: number };
  /** 用户消息附带的图片（data URL） */
  images?: string[];
}

/** 待发送的图片附件 */
export interface ChatImage {
  id: string;
  name: string;
  dataUrl: string;
}

export type TutorStatus = 'idle' | 'searching' | 'generating';

export interface UseTutorChatOptions {
  /** 归属用户 id（或 'guest'） */
  userId: string;
  /** 知识点上下文 id（可选） */
  topicId?: string | null;
  /** 正在阅读的小节标题（可选，来自 TopicDetail 的"问 AI 这一节"） */
  section?: string | null;
  /** 是否启用文档检索，默认 true */
  useDocs?: boolean;
  /** 发送前回调（如聚焦输入框） */
  onBeforeSend?: () => void;
}

/** 快捷追问指令（UI 层展示用） */
export const QUICK_FOLLOWUPS = [
  { label: '用更简单的话解释', prompt: '上面的内容我没太看懂，请用更简单直白的话（配合生活例子）重新解释一遍。' },
  { label: '举个具体例子', prompt: '请针对上面的内容举一个具体的数值例子，完整演算一遍。' },
  { label: '分步骤教我', prompt: '请把这个问题的思路拆成有序的步骤，每一步说明为什么这么做，带我完整推一遍。' },
  { label: '我算错了吗', prompt: '这是我的演算过程，请帮我检查哪里出错了，并说明正确的做法。' },
  { label: '总结成要点', prompt: '请把上面的讲解总结成便于复习的要点清单（含关键公式）。' },
];

export const useTutorChat = (options: UseTutorChatOptions) => {
  const { userId, topicId = null, section = null, useDocs = true } = options;

  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<TutorStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  // ── 图片附件 / 会话用量 / 模型名 ──
  const [images, setImages] = useState<ChatImage[]>([]);
  const [sessionUsage, setSessionUsage] = useState({ prompt: 0, completion: 0, total: 0 });
  const [lastModel, setLastModel] = useState<string | undefined>(undefined);
  const addImages = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setImages((prev) => {
      const room = 4 - prev.length;
      return [
        ...prev,
        ...list.slice(0, Math.max(0, room)).map((f) => ({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: f.name,
          dataUrl: URL.createObjectURL(f),
        })),
      ];
    });
  }, []);
  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((im) => im.id !== id));
  }, []);
  const abortRef = useRef<AbortController | null>(null);

  const topic: Topic | undefined = useMemo(
    () => (topicId ? getTopic(topicId) : undefined),
    [topicId],
  );
  const course = useMemo(
    () => (topic ? getCourse(topic.courseId) : undefined),
    [topic],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      const cfg = readAiConfig();
      if (!cfg) {
        setError('请先配置 API Key：打开答疑台或设置面板填写任一 OpenAI 兼容服务商的密钥。');
        return;
      }

      options.onBeforeSend?.();

      // ── 组装系统上下文 ──
      // 思考模式：把「快速回答 / 深度思考」的作答要求写进系统提示词。
      // 这样即便接入的服务商不支持思考参数，两种模式的差异也一定可感知。
      // 深度思考时模型会先输出思考过程（reasoning_content），再给出正式解答。
      const modeGuidance = getModeGuidance(resolveThinkingMode(cfg));
      const systemPrompt = `${MATH_TUTOR_SYSTEM_PROMPT}\n\n${modeGuidance}`;
      const history: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
      ];
      if (topic) {
        history.push({
          role: 'system',
          content: `学生正在学习知识点「${topic.title}」（${course?.name ?? ''} · ${topic.chapter}）。本知识点提要：${topic.summary}\n讲解要点：${topic.keyPoints.join('；')}`,
        });
      }
      if (section) {
        history.push({
          role: 'system',
          content: `学生正在重点阅读「${topic?.title ?? '本知识点'}」中的「${section}」一节。如果问题涉及该节内容，请优先结合这一节展开讲解，并可提示学生回到该节复习。`,
        });
      }

      // ── 文档知识库检索 ──
      let sources: QaSource[] = [];
      if (useDocs) {
        setStatus('searching');
        try {
          const hits = await retrieveChunks(userId, trimmed, 4);
          if (hits.length > 0) {
            sources = hits.map((h) => ({
              docId: h.chunk.docId,
              docName: h.chunk.docName,
              snippet: h.chunk.text.slice(0, 140),
            }));
            const docContext = hits
              .map(
                (h, i) =>
                  `【资料 ${i + 1}】摘自学生上传的《${h.chunk.docName}》：\n${h.chunk.text}`,
              )
              .join('\n\n');
            history.push({
              role: 'system',
              content: `学生上传了学习资料。以下是与问题最相关的段落：\n\n${docContext}\n\n回答要求：优先依据上述资料作答并注明出处（如"根据《XX》…"）；资料未覆盖的内容用你的知识补充，并明确区分哪些来自资料、哪些是你的补充。若资料与问题无关，忽略资料直接回答。`,
            });
          }
        } catch {
          /* 检索失败不阻塞答疑 */
        }
      }

      history.push(...messages.map((m) => ({ role: m.role, content: m.content })));
      if (images.length > 0) {
        history.push({
          role: 'user',
          content: [
            { type: 'text', text: trimmed || '请看这些图片' },
            ...images.map((im) => ({ type: 'image_url', image_url: { url: im.dataUrl } })),
          ] as unknown as string,
        });
      } else {
        history.push({ role: 'user', content: trimmed });
      }

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: trimmed, images: images.length > 0 ? images.map((im) => im.dataUrl) : undefined },
        { role: 'assistant', content: '' },
      ]);
      setImages([]);
      setInput('');
      setError(null);
      setStreaming(true);
      setStatus('generating');

      const controller = new AbortController();
      abortRef.current = controller;
      let acc = '';
      let reasoningAcc = '';
      let modelName: string | undefined;
      try {
        for await (const chunk of streamChat(
          cfg,
          history,
          controller.signal,
          (meta: ChatMeta) => {
            if (meta.model) {
              modelName = meta.model;
              setLastModel(meta.model);
            }
            if (meta.usage) {
              setSessionUsage((u) => ({
                prompt: u.prompt + meta.usage!.prompt,
                completion: u.completion + meta.usage!.completion,
                total: u.total + meta.usage!.total,
              }));
              setMessages((prev) => [
                ...prev.slice(0, -1),
                {
                  role: 'assistant',
                  content: acc,
                  reasoning: reasoningAcc,
                  sources,
                  model: meta.model,
                  usage: meta.usage,
                },
              ]);
            }
          },
          (r: string) => {
            reasoningAcc += r;
          },
        )) {
          acc += chunk;
          const captured = acc;
          const capturedReasoning = reasoningAcc;
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: captured, reasoning: capturedReasoning, sources },
          ]);
        }
        // 收尾：确保思考过程与正文完整保留，且不覆盖已有的 usage / 模型信息
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return [
            ...prev.slice(0, -1),
            {
              role: 'assistant',
              content: acc,
              reasoning: reasoningAcc,
              sources,
              model: last?.model ?? modelName,
              usage: last?.usage,
            },
          ];
        });
        addQaEntry({
          userId,
          question: trimmed,
          answer: acc,
          courseId: topic?.courseId,
          topicId: topic?.id,
          topicTitle: topic?.title,
          sources: sources.length > 0 ? sources : undefined,
          model: modelName ?? lastModel,
        });
      } catch (err) {
        if (!acc && !reasoningAcc) {
          setMessages((prev) => prev.slice(0, -1));
        } else {
          // 已有部分输出：保留内容（含思考过程）并附错误说明
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: acc, reasoning: reasoningAcc },
          ]);
          setError(`${describeAiError(err)}（已保留已生成的部分回答）`);
        }
        if (!acc && !reasoningAcc) setError(describeAiError(err));
      } finally {
        setStreaming(false);
        setStatus('idle');
        abortRef.current = null;
      }
    },
    [streaming, messages, topic, course, userId, useDocs, options],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  /** 重新生成最后一轮回答 */
  const regenerate = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser || streaming) return;
    setMessages((prev) => prev.slice(0, -2));
    send(lastUser.content);
  }, [messages, streaming, send]);

  return {
    messages,
    input,
    setInput,
    streaming,
    status,
    error,
    setError,
    send,
    stop,
    clear,
    regenerate,
    topic,
    course,
    images,
    addImages,
    removeImage,
    sessionUsage,
    lastModel,
  };
};
