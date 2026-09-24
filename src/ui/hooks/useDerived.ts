import { useMemo } from 'react';
import { derive, type Derived } from '../../domain/derive';
import type { Project } from '../../domain/model';
import { listWorkItems, summarizeProgress, type WorkItem } from '../../domain/progress';
import { useProjectStore } from '../../store/projectStore';
import { journey, type Journey } from '../journey';

/** 開いているプロジェクト（ProjectRoute の中でだけ使う） */
export function useProject(): Project {
  const project = useProjectStore((s) => s.project);
  if (!project) throw new Error('プロジェクトが開かれていません');
  return project;
}

export interface DerivedView {
  derived: Derived;
  workItems: WorkItem[];
  workItemById: Map<string, WorkItem>;
  progress: ReturnType<typeof summarizeProgress>;
}

/** 入力から出力をまとめて計算する（Project が変わったときだけ） */
export function useDerived(): DerivedView {
  const project = useProject();
  const base = useMemo(() => {
    const derived = derive(project);
    const workItems = listWorkItems(project, derived);
    return { derived, workItems, workItemById: new Map(workItems.map((i) => [i.id, i])) };
    // 進捗だけが変わったときは derive し直さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project.settings,
    project.orgs,
    project.lines,
    project.kinds,
    project.stations,
    project.services,
    project.overrides,
    project.selfOrgId,
  ]);
  const progress = useMemo(
    () => summarizeProgress(project.progress, base.workItems),
    [project.progress, base.workItems],
  );
  return { ...base, progress };
}

/** 路線ができるまでの道のり（どこまで済んだか・次にやること） */
export function useJourney(): Journey {
  const project = useProject();
  const { derived, workItems } = useDerived();
  return useMemo(() => journey(project, derived, workItems), [project, derived, workItems]);
}
