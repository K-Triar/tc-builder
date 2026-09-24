// 画面下に短く出すお知らせ（「〇〇を消しました［元に戻す］」など）。同時に出すのは1つだけ。

import { create } from 'zustand';
import type { Project } from '../domain/model';
import { useProjectStore } from '../store/projectStore';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  action?: ToastAction;
}

interface ToastStore {
  toast: Toast | null;
  show(message: string, action?: ToastAction): void;
  hide(id?: number): void;
}

let seq = 0;

export const useToast = create<ToastStore>()((set, get) => ({
  toast: null,
  show: (message, action) => set({ toast: { id: ++seq, message, ...(action ? { action } : {}) } }),
  hide: (id) => {
    if (id === undefined || get().toast?.id === id) set({ toast: null });
  },
}));

/** 元に戻して、お知らせを出す（やり直しの操作つき） */
export function undoWithToast(): void {
  if (!useProjectStore.getState().undo()) {
    useToast.getState().show('元に戻せる変更はありません');
    return;
  }
  useToast.getState().show('元に戻しました', { label: 'やり直す', run: () => redoWithToast() });
}

export function redoWithToast(): void {
  if (!useProjectStore.getState().redo()) {
    useToast.getState().show('やり直せる変更はありません');
    return;
  }
  useToast.getState().show('やり直しました', { label: '元に戻す', run: () => undoWithToast() });
}

/** 消す操作。確認は出さずにすぐ消し、「元に戻す」つきのお知らせを出す */
export function removeWithUndo(message: string, recipe: (draft: Project) => void): void {
  useProjectStore.getState().update(recipe, { checkpoint: true });
  useToast.getState().show(message, { label: '元に戻す', run: () => undoWithToast() });
}
