import { markDone, markTodo, workStatus, type WorkStatus } from '../../domain/progress';
import { now, useProjectStore } from '../../store/projectStore';
import { useDerived, useProject } from './useDerived';

/** 作業項目のチェック（R10）。内容が変わっていれば stale（要更新） */
export function useWork(id: string): { status: WorkStatus; exists: boolean; toggle: () => void } {
  const project = useProject();
  const { workItemById } = useDerived();
  const update = useProjectStore((s) => s.update);
  const item = workItemById.get(id);
  const status = item ? workStatus(project.progress, item) : 'todo';
  return {
    status,
    exists: item !== undefined,
    toggle: () => {
      if (!item) return;
      update((p) => {
        p.progress =
          status === 'done' ? markTodo(p.progress, id) : markDone(p.progress, item, now.current());
      });
    },
  };
}
