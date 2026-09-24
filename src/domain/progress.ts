// 進捗（requirements R10）：作業項目の一覧、内容ハッシュとの突き合わせ（要更新）、完了数。

import type { Derived } from './derive';
import { contentHash } from './hash';
import type { Progress, Project } from './model';

export type WorkCategory = 'install' | 'command' | 'trial';

export interface WorkItem {
  /** Progress.items のキー */
  id: string;
  category: WorkCategory;
  label: string;
  hash: string;
}

export type WorkStatus = 'todo' | 'done' | 'stale';

/** 作業項目の ID */
export const workIds = {
  install: (cardId: string) => `install:${cardId}`,
  trialPlatform: (cardId: string) => `trial:${cardId}`,
  command: (blockId: string) => `command:${blockId}`,
  trialService: (serviceId: string) => `trial:service:${serviceId}`,
  trialSwitchers: 'trial:switchers',
} as const;

export function listWorkItems(project: Project, derived: Derived): WorkItem[] {
  const items: WorkItem[] = [];
  const name = (id: string) => derived.lookup.station(id)?.name ?? '?';

  for (const card of derived.platformCards) {
    if (card.pattern === 'foreign') continue;
    const label = `${name(card.stationId)} ${card.platform}番`;
    items.push({ id: workIds.install(card.id), category: 'install', label, hash: card.hash });
    items.push({ id: workIds.trialPlatform(card.id), category: 'trial', label, hash: card.hash });
  }
  for (const group of derived.commandPlan.groups) {
    for (const block of group.blocks) {
      items.push({
        id: workIds.command(block.id),
        category: 'command',
        label: block.title,
        hash: block.hash,
      });
    }
  }
  for (const service of project.services) {
    const departures = derived.departures
      .filter((d) => d.serviceId === service.id)
      .map((d) => [d.stationId, d.platform, d.formationCode ?? null, d.route]);
    items.push({
      id: workIds.trialService(service.id),
      category: 'trial',
      label: `${service.name} を走らせて確かめた`,
      hash: contentHash(departures),
    });
  }
  const switcherStations = derived.stationCards.filter((s) => s.switcher).map((s) => s.stationId);
  if (switcherStations.length > 0) {
    items.push({
      id: workIds.trialSwitchers,
      category: 'trial',
      label: '全ポイントに switcher を置いた',
      hash: contentHash(switcherStations),
    });
  }
  const cleanups = derived.stationCards.flatMap((s) =>
    s.cleanups.map((c) => [s.stationId, c.towardStationId]),
  );
  const foreign = derived.stationCards.filter((s) => s.foreign).map((s) => s.stationId);
  for (const check of GENERAL_CHECKS) {
    if (check.id === 'trial:cleanup' && cleanups.length === 0) continue;
    if (check.id === 'trial:foreign' && foreign.length === 0) continue;
    items.push({
      id: check.id,
      category: 'trial',
      label: check.label,
      hash: contentHash(
        check.id === 'trial:cleanup' ? cleanups : check.id === 'trial:foreign' ? foreign : check.id,
      ),
    });
  }
  return items;
}

/** 入門ガイドの作業チェックリストのうち、仕上げに確かめる項目 */
export const GENERAL_CHECKS = [
  {
    id: 'trial:facing',
    label:
      '看板はすべてホームから文字面が見える向きに付け、station の right/left をホームから見た発車の向きに合わせた',
  },
  { id: 'trial:spawn-buttons', label: 'spawn 看板にボタンを付け、列車の出る向きを確かめた' },
  { id: 'trial:cleanup', label: '駅の出口側に C（空車削除）を置いた' },
  { id: 'trial:foreign', label: '直通先の鉄道会社と、行先コード・編成名・タグをすり合わせた' },
] as const;

/** 完了時のハッシュと今の内容が違えば「要更新」 */
export function workStatus(progress: Progress, item: Pick<WorkItem, 'id' | 'hash'>): WorkStatus {
  const done = progress.items[item.id];
  if (!done) return 'todo';
  return done.hash === item.hash ? 'done' : 'stale';
}

export function markDone(
  progress: Progress,
  item: Pick<WorkItem, 'id' | 'hash'>,
  now: Date,
): Progress {
  return {
    items: { ...progress.items, [item.id]: { hash: item.hash, doneAt: now.toISOString() } },
  };
}

export function markTodo(progress: Progress, id: string): Progress {
  return { items: Object.fromEntries(Object.entries(progress.items).filter(([k]) => k !== id)) };
}

export interface ProgressCount {
  done: number;
  stale: number;
  total: number;
}

export interface ProgressSummary {
  /** のりば（看板を設置した） */
  platforms: ProgressCount;
  /** 経路（コマンドを実行した） */
  routes: ProgressCount;
  /** 編成（コマンドを実行した） */
  formations: ProgressCount;
  /** 試運転 */
  trials: ProgressCount;
}

export function summarizeProgress(progress: Progress, items: readonly WorkItem[]): ProgressSummary {
  const count = (filter: (i: WorkItem) => boolean): ProgressCount => {
    const list = items.filter(filter);
    const statuses = list.map((i) => workStatus(progress, i));
    return {
      done: statuses.filter((s) => s === 'done').length,
      stale: statuses.filter((s) => s === 'stale').length,
      total: list.length,
    };
  };
  return {
    platforms: count((i) => i.category === 'install'),
    routes: count((i) => i.id.startsWith('command:route:')),
    formations: count((i) => i.id.startsWith('command:formation:')),
    trials: count((i) => i.category === 'trial'),
  };
}
