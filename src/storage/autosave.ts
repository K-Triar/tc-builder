// 開いているプロジェクトが変わるたびに、500ms まとめて IndexedDB へ保存する（R1.1）。
// 保存の状態（保存待ち・保存済み・失敗）を画面に出せるよう、小さなストアに記録する。

import { create } from 'zustand';
import type { Project } from '../domain/model';
import { useProjectStore } from '../store/projectStore';
import { createAutosaver, saveProject } from './db';

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'error';

export const useSaveStatus = create<{ status: SaveStatus }>()(() => ({ status: 'idle' }));

const setStatus = (status: SaveStatus) => useSaveStatus.setState({ status });

/** 自動保存を始める。戻り値で止める（止めるときに残りをすぐ保存する） */
export function startAutosave(
  save: (p: Project) => Promise<void> = saveProject,
  delay = 500,
): () => Promise<void> {
  const saver = createAutosaver(async (p) => {
    try {
      await save(p);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }, delay);
  const unsubscribe = useProjectStore.subscribe((state, prev) => {
    if (state.project && state.project !== prev.project) {
      setStatus('pending');
      saver.schedule(state.project);
    }
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
