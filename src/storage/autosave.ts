// 開いているプロジェクトが変わるたびに、500ms まとめて IndexedDB へ保存する（R1.1）。

import type { Project } from '../domain/model';
import { useProjectStore } from '../store/projectStore';
import { createAutosaver, saveProject } from './db';

/** 自動保存を始める。戻り値で止める（止めるときに残りをすぐ保存する） */
export function startAutosave(
  save: (p: Project) => Promise<void> = saveProject,
  delay = 500,
): () => Promise<void> {
  const saver = createAutosaver(save, delay);
  const unsubscribe = useProjectStore.subscribe((state, prev) => {
    if (state.project && state.project !== prev.project) saver.schedule(state.project);
  });
  const onHide = () => {
    if (document.visibilityState === 'hidden') void saver.flush();
  };
  document.addEventListener('visibilitychange', onHide);
  return async () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', onHide);
    await saver.flush();
  };
}
