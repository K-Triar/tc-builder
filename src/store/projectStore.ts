// 開いているプロジェクトのストア（Zustand + immer）。変更はすべて update を通し、updatedAt を進める。

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Project, ServiceEntry } from '../domain/model';
import * as ops from './projectOps';

export interface ProjectStore {
  project: Project | null;
  open(project: Project): void;
  close(): void;
  /** 入力を変える。updatedAt を今の時刻にする */
  update(recipe: (draft: Project) => void): void;
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
    const update = (recipe: (draft: Project) => void) =>
      set((state) => {
        if (!state.project) return;
        recipe(state.project);
        state.project.updatedAt = now.current().toISOString();
      });
    return {
      project: null,
      open: (project) => set({ project }),
      close: () => set({ project: null }),
      update,
      insertEntry: (serviceId, index, entry) =>
        update((p) => ops.insertEntry(p, serviceId, index, entry)),
      removeEntry: (serviceId, index) => update((p) => ops.removeEntry(p, serviceId, index)),
      moveEntry: (serviceId, from, to) => update((p) => ops.moveEntry(p, serviceId, from, to)),
      removeService: (serviceId) => update((p) => ops.removeService(p, serviceId)),
      removeServiceKind: (serviceId, kindId) =>
        update((p) => ops.removeServiceKind(p, serviceId, kindId)),
      renumberPlatform: (stationId, from, to) => {
        if (!get().project) return;
        update((p) => ops.renumberPlatform(p, stationId, from, to));
      },
    };
  }),
);
