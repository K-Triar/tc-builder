import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { derive } from '../../domain/derive';
import { createProject, K_PRESET } from '../../domain/presets';
import { parseProject } from '../../domain/schema';
import { now, useProjectStore } from '../../store/projectStore';
import {
  createAutosaver,
  deleteProject,
  listProjects,
  loadProject,
  projectExists,
  saveProject,
} from '../db';
import {
  asCopy,
  exportFileName,
  hasUnexportedChanges,
  prepareExport,
  readProjectFile,
} from '../file';
import { createSampleProject } from '../sample';

let seq = 0;
const env = { newId: () => `p${++seq}`, now: () => new Date('2026-09-24T00:00:00.000Z') };

describe('IndexedDB への保存', () => {
  it('保存・一覧・読み込み・削除', async () => {
    const a = { ...createProject(K_PRESET, 'A', env), updatedAt: '2026-09-24T01:00:00.000Z' };
    const b = { ...createProject(K_PRESET, 'B', env), updatedAt: '2026-09-24T02:00:00.000Z' };
    await saveProject(a);
    await saveProject(b);
    await saveProject({ ...a, name: 'A2' });

    const list = await listProjects();
    expect(list.map((m) => m.name)).toEqual(['B', 'A2']);
    expect(await loadProject(a.id)).toEqual({ ...a, name: 'A2' });
    expect(await projectExists(b.id)).toBe(true);

    await deleteProject(b.id);
    expect((await listProjects()).map((m) => m.id)).toEqual([a.id]);
    expect(await loadProject(b.id)).toBeUndefined();
    await deleteProject(a.id);
  });
});

describe('自動保存（500ms デバウンス）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('続けて変更しても、最後の1回だけ保存する', async () => {
    const save = vi.fn(async () => {});
    const saver = createAutosaver(save, 500);
    const p = createProject(K_PRESET, 'x', env);
    saver.schedule({ ...p, name: '1' });
    await vi.advanceTimersByTimeAsync(300);
    saver.schedule({ ...p, name: '2' });
    await vi.advanceTimersByTimeAsync(499);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: '2' }));
  });

  it('flush ですぐ保存する', async () => {
    const save = vi.fn(async () => {});
    const saver = createAutosaver(save, 500);
    saver.schedule(createProject(K_PRESET, 'x', env));
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('ファイルの書き出し・読み込み', () => {
  it('書き出すと lastExportedAt が付き、未保存の変更はなくなる', async () => {
    const p = createProject(K_PRESET, '瑠璃線', env);
    expect(hasUnexportedChanges(p)).toBe(true);
    const out = prepareExport(p, new Date('2026-09-24T03:00:00.000Z'));
    expect(out.project.lastExportedAt).toBe('2026-09-24T03:00:00.000Z');
    expect(hasUnexportedChanges(out.project)).toBe(false);
    expect(hasUnexportedChanges({ ...out.project, updatedAt: '2026-09-24T04:00:00.000Z' })).toBe(
      true,
    );

    const r = await readProjectFile(new Blob([out.text]));
    expect(r).toEqual({ ok: true, project: out.project, migratedFrom: undefined });
  });

  it('不正なファイルは理由を日本語で返す', async () => {
    const r = await readProjectFile(new Blob(['not json']));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors[0]).toContain('JSON');
  });

  it('ファイル名に使えない文字を置き換える', () => {
    expect(exportFileName({ name: '瑠璃線/中央線:試作' })).toBe('瑠璃線_中央線_試作.ktc.json');
    expect(exportFileName({ name: '  ' })).toBe('project.ktc.json');
  });

  it('同じ ID があるときは別名（コピー）で開ける', () => {
    const p = prepareExport(createProject(K_PRESET, '瑠璃線', env), env.now()).project;
    const c = asCopy(p, 'new-id', new Date('2026-09-25T00:00:00.000Z'));
    expect(c).toMatchObject({
      id: 'new-id',
      name: '瑠璃線（コピー）',
      createdAt: '2026-09-25T00:00:00.000Z',
    });
    expect(c.lastExportedAt).toBeUndefined();
    expect(c.stations).toBe(p.stations);
  });
});

describe('サンプルを開く', () => {
  it('瑠璃線系統を新しい ID で複製し、エラーがない', () => {
    const p = createSampleProject('sample-copy', new Date('2026-09-25T00:00:00.000Z'));
    expect(p).toMatchObject({ id: 'sample-copy', createdAt: '2026-09-25T00:00:00.000Z' });
    expect(parseProject(p).ok).toBe(true);
    expect(derive(p).hasErrors).toBe(false);
  });
});

describe('ストア', () => {
  it('update で updatedAt が進み、経由リストの操作ができる', () => {
    const p = createSampleProject('s', new Date('2026-09-25T00:00:00.000Z'));
    now.current = () => new Date('2026-09-26T00:00:00.000Z');
    const store = useProjectStore.getState();
    store.open(p);
    const service = p.services[0]!;
    store.removeEntry(service.id, 1);
    const after = useProjectStore.getState().project!;
    expect(after.services[0]!.entries).toHaveLength(service.entries.length - 1);
    expect(after.updatedAt).toBe('2026-09-26T00:00:00.000Z');
    // 元のオブジェクトは変わらない
    expect(p.services[0]!.entries).toHaveLength(service.entries.length);
    store.close();
    expect(useProjectStore.getState().project).toBeNull();
  });
});
