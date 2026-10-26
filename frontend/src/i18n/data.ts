/**
 * 数据本地化：把单条知识库数据按当前语言合并英文覆盖字段。
 * 仅英文模式且存在对应覆盖时才替换；否则原样返回（中文）。
 */
import { useMemo } from 'react';
import type { Course, FormulaGroup, Problem, Topic } from '@/types';
import { isEn } from './lang';
import { useLocale } from './LocaleContext';
import { courseEn, formulaGroupEn, problemEn, topicEn } from './dataEn';

export function localizeCourse(c: Course): Course {
  if (!isEn()) return c;
  const e = courseEn[c.id];
  return e ? { ...c, ...e } : c;
}

export function localizeTopic(t: Topic): Topic {
  if (!isEn()) return t;
  const e = topicEn[t.id];
  return e ? { ...t, ...e } : t;
}

export function localizeProblem(p: Problem): Problem {
  if (!isEn()) return p;
  const e = problemEn[p.id];
  return e ? { ...p, ...e } : p;
}

export function localizeFormulaGroup(g: FormulaGroup): FormulaGroup {
  if (!isEn()) return g;
  const e = formulaGroupEn[g.id];
  return e ? { ...g, ...e } : g;
}

// ── 语言感知的数据访问 hooks（消费 LocaleContext，语言切换时自动重渲染）──
import { courses } from '@/data/courses';
import { topics } from '@/data/topics';
import { problems } from '@/data/problems';
import { formulaGroups } from '@/data/formulas';

export function useCourses(): Course[] {
  const { lang } = useLocale();
  return useMemo(() => courses.map(localizeCourse), [lang]);
}

export function useCourse(id: string | undefined): Course | undefined {
  const list = useCourses();
  return useMemo(() => list.find((c) => c.id === id), [list, id]);
}

export function useTopics(): Topic[] {
  const { lang } = useLocale();
  return useMemo(() => topics.map(localizeTopic), [lang]);
}

export function useTopic(id: string | undefined): Topic | undefined {
  const list = useTopics();
  return useMemo(() => list.find((t) => t.id === id), [list, id]);
}

export function useProblems(): Problem[] {
  const { lang } = useLocale();
  return useMemo(() => problems.map(localizeProblem), [lang]);
}

export function useProblem(id: string | undefined): Problem | undefined {
  const list = useProblems();
  return useMemo(() => list.find((p) => p.id === id), [list, id]);
}

export function useFormulaGroups(): FormulaGroup[] {
  const { lang } = useLocale();
  return useMemo(() => formulaGroups.map(localizeFormulaGroup), [lang]);
}
