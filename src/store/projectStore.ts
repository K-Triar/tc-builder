// 開いているプロジェクトのストア（Zustand + immer）。変更はすべて update を通し、updatedAt を進める。
// 元に戻す／やり直すための履歴（直前のプロジェクト）もここで持つ。履歴は保存しない。

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Project, ServiceEntry } from '../domain/model';
import * as ops from './projectOps';

/** 履歴に残す数 */
export const HISTORY_LIMIT = 50;
/** この時間内に続いた変更（文字の入力など）は、1回の「元に戻す」でまとめて戻す */
export const COALESCE_MS = 800;

export interface UpdateOptions {
  /** 必ず新しい履歴の区切りにする（消す・足す・並べ替えなど） */
  checkpoint?: boolean;
}

export interface ProjectStore {
  project: Project | null;
  past: Project[];
  future: Project[];
  open(project: Project): void;
  close(): void;
  /** 入力を変える。updatedAt を今の時刻にする */
  update(recipe: (draft: Project) => void, options?: UpdateOptions): void;
  /** 1つ前に戻す。戻せたら true */
  undo(): boolean;
  /** 戻したものをやり直す。できたら true */
  redo(): boolean;
  insertEntry(serviceId: string, index: number, entry: ServiceEntry): void;
  removeEntry(serviceId: string, index: number): void;
  moveEntry(serviceId: string, from: number, to: number): void;
  removeService(serviceId: string): void;
  removeServiceKind(serviceId: string, kindId: string): void;
  renumberPlatform(stationId: string, from: number, to: number): void;
}

export const now = { current: () => new Date() };

export const useProjectStore = create<ProjectStore>()(
  immer((set, get) => {
    // 直前の変更の時刻（まとめるかどうかの判断に使う）。区切りの直後はまとめない
    let lastAt = 0;
    let lastWasCheckpoint = true;

    const update = (recipe: (draft: Project) => void, options?: UpdateOptions) => {
      const before = get().project;
      if (!before) return;
      const t = now.current().getTime();
      const checkpoint = options?.checkpoint ?? false;
      const coalesce = !checkpoint && !lastWasCheckpoint && t - lastAt < COALESCE_MS;
      set((state) => {
        if (!state.project) return;
        recipe(state.project);
        state.project.updatedAt = new Date(t).toISOString();
        if (!coalesce) {
          state.past.push(before);
          if (state.past.length > HISTORY_LIMIT) state.past.shift();
        }
        state.future = [];
      });
      lastAt = t;
      lastWasCheckpoint = checkpoint;
    };

    /** 履歴から取り出した版を今の版にする。書き出し日時は今のものを残す（戻すと未保存に見えなくなるため） */
    const restore = (from: 'past' | 'future') => {
      const { project, past, future } = get();
      const source = from === 'past' ? past : future;
      const target = source[source.length - 1];
      if (!project || !target) return false;
      const next: Project = {
        ...target,
        updatedAt: now.current().toISOString(),
        ...(project.lastExportedAt ? { lastExportedAt: project.lastExportedAt } : {}),
      };
      if (!project.lastExportedAt) delete next.lastExportedAt;
      set((state) => {
        if (from === 'past') {
          state.past.pop();
          state.future.push(project);
        } else {
          state.future.pop();
          state.past.push(project);
        }
        state.project = next;
      });
      lastWasCheckpoint = true;
      return true;
    };

    const structural = (recipe: (draft: Project) => void) => update(recipe, { checkpoint: true });

    return {
      project: null,
      past: [],
      future: [],
      open: (project) => {
        lastWasCheckpoint = true;
        set({ project, past: [], future: [] });
      },
      close: () => set({ project: null, past: [], future: [] }),
      update,
      undo: () => restore('past'),
      redo: () => restore('future'),
      insertEntry: (serviceId, index, entry) =>
        structural((p) => ops.insertEntry(p, serviceId, index, entry)),
      removeEntry: (serviceId, index) => structural((p) => ops.removeEntry(p, serviceId, index)),
      moveEntry: (serviceId, from, to) => structural((p) => ops.moveEntry(p, serviceId, from, to)),
      removeService: (serviceId) => structural((p) => ops.removeService(p, serviceId)),
      removeServiceKind: (serviceId, kindId) =>
        structural((p) => ops.removeServiceKind(p, serviceId, kindId)),
      renumberPlatform: (stationId, from, to) => {
        if (!get().project) return;
        structural((p) => ops.renumberPlatform(p, stationId, from, to));
      },
    };
  }),
);
