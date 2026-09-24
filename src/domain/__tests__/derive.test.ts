import { describe, expect, it } from 'vitest';
import { derive } from '../derive';
import {
  listWorkItems,
  markDone,
  markTodo,
  summarizeProgress,
  workIds,
  workStatus,
} from '../progress';
import { ruriDown } from './builder';

const now = new Date('2026-09-24T12:00:00.000Z');

describe('derive', () => {
  it('すべての出力をまとめて返す', () => {
    const p = ruriDown().build();
    const d = derive(p);
    expect(d.choices).toHaveLength(p.services.length);
    expect(d.formations.map((f) => f.code)).toContain('K300_KL4L13_Lo');
    expect(d.routes.map((r) => r.code)).toContain('KL4NSC');
    expect(d.platformCards).toHaveLength(p.stations.reduce((n, s) => n + s.platforms.length, 0));
    expect(d.stationCards).toHaveLength(p.stations.length);
    expect(d.commandPlan.groups.length).toBeGreaterThan(0);
    expect(d.hasErrors).toBe(false);
  });

  it('エラーがあれば hasErrors', () => {
    const b = ruriDown();
    delete b.project.stations[1]!.platforms[0]!.dir;
    expect(derive(b.build()).hasErrors).toBe(true);
  });

  it('入力を書き換えない', () => {
    const p = ruriDown().build();
    const before = JSON.stringify(p);
    derive(p);
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe('進捗（R10）', () => {
  const b = ruriDown();
  const p = b.build();
  const items = listWorkItems(p, derive(p));
  const otto = items.find((i) => i.id === workIds.install('st-KL02#1'))!;

  it('作業項目：看板の設置・試運転、コマンド、系統ごとの試運転、switcher', () => {
    expect(otto).toMatchObject({ category: 'install', label: 'オット 1番' });
    expect(items.some((i) => i.id === workIds.trialPlatform('st-KL02#1'))).toBe(true);
    expect(items.some((i) => i.id === 'command:route:KL4L13')).toBe(true);
    expect(items.some((i) => i.id === 'command:formation:K300_KL4L13_Lo')).toBe(true);
    expect(items.some((i) => i.id === workIds.trialService('sv1'))).toBe(true);
    expect(items.some((i) => i.id === workIds.trialSwitchers)).toBe(true);
    // 他の鉄道会社の駅は作業項目にしない
    expect(items.some((i) => i.id.includes('st-NSC'))).toBe(false);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it('未完了 → 完了 → 内容が変わると要更新 → 外す', () => {
    let progress = p.progress;
    expect(workStatus(progress, otto)).toBe('todo');
    progress = markDone(progress, otto, now);
    expect(progress.items[otto.id]).toEqual({ hash: otto.hash, doneAt: now.toISOString() });
    expect(workStatus(progress, otto)).toBe('done');

    const changed = ruriDown();
    changed.project.settings.stationDwellSeconds = 8;
    const newItem = listWorkItems(changed.project, derive(changed.project)).find(
      (i) => i.id === otto.id,
    )!;
    expect(workStatus(progress, newItem)).toBe('stale');

    progress = markTodo(progress, otto.id);
    expect(workStatus(progress, otto)).toBe('todo');
  });

  it('完了数のまとめ', () => {
    const route = items.find((i) => i.id === 'command:route:KL4L13')!;
    const progress = markDone(markDone(p.progress, otto, now), route, now);
    const s = summarizeProgress(progress, items);
    expect(s.platforms).toMatchObject({ done: 1, stale: 0 });
    expect(s.platforms.total).toBe(items.filter((i) => i.category === 'install').length);
    expect(s.routes).toMatchObject({ done: 1, total: derive(p).routes.length });
    expect(s.formations).toMatchObject({ done: 0, total: derive(p).formations.length });
    expect(s.trials.done).toBe(0);
  });
});

describe('仕上げのチェック項目', () => {
  it('入門ガイドの仕上げの確認項目が作業項目に入る', () => {
    const p = ruriDown().build();
    const ids = listWorkItems(p, derive(p)).map((i) => i.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'trial:facing',
        'trial:spawn-buttons',
        'trial:cleanup',
        'trial:foreign',
      ]),
    );
  });
});
