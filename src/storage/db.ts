// ブラウザ内の保存（IndexedDB、design §7）。キー `project:<id>`、一覧は `projects:index`。

import { del, get, set } from 'idb-keyval';
import type { Project } from '../domain/model';
import { parseProject } from '../domain/schema';

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: string;
  lastExportedAt?: string;
}

const INDEX_KEY = 'projects:index';
const projectKey = (id: string) => `project:${id}`;

export function metaOf(p: Project): ProjectMeta {
  return {
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt,
    ...(p.lastExportedAt ? { lastExportedAt: p.lastExportedAt } : {}),
  };
}

/** 一覧（更新日時の新しい順） */
export async function listProjects(): Promise<ProjectMeta[]> {
  const list = (await get<ProjectMeta[]>(INDEX_KEY)) ?? [];
  return [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** 読み込み。古い版はマイグレーションし、壊れていればエラーを投げる */
export async function loadProject(id: string): Promise<Project | undefined> {
  const raw = await get<unknown>(projectKey(id));
  if (raw === undefined) return undefined;
  const r = parseProject(raw);
  if (!r.ok) throw new Error(`保存データを読めませんでした：${r.errors.join(' / ')}`);
  return r.project;
}

export async function saveProject(p: Project): Promise<void> {
  await set(projectKey(p.id), p);
  const list = ((await get<ProjectMeta[]>(INDEX_KEY)) ?? []).filter((m) => m.id !== p.id);
  await set(INDEX_KEY, [...list, metaOf(p)]);
  void requestPersist();
}

export async function deleteProject(id: string): Promise<void> {
  await del(projectKey(id));
  const list = (await get<ProjectMeta[]>(INDEX_KEY)) ?? [];
  await set(
    INDEX_KEY,
    list.filter((m) => m.id !== id),
  );
}

export async function projectExists(id: string): Promise<boolean> {
  return (await get(projectKey(id))) !== undefined;
}

let persistRequested = false;

/** 初回保存時に永続化を頼む（ブラウザのデータ消去に備える） */
export async function requestPersist(): Promise<boolean> {
  if (persistRequested) return true;
  persistRequested = true;
  try {
    return (await globalThis.navigator?.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** 変更を delay ミリ秒まとめてから保存する */
export function createAutosaver(save: (p: Project) => Promise<void>, delay = 500) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Project | undefined;
  const flush = async () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    const p = pending;
    pending = undefined;
    if (p) await save(p);
  };
  return {
    schedule(p: Project) {
      pending = p;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), delay);
    },
    flush,
  };
}
