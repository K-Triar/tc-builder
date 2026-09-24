// のりばの集計（rules §3.6）。

import { kindTag } from './codes';
import { createLookup, type Lookup } from './lookup';
import { platformKey, type Project } from './model';
import { computeRoutes, type RoutesResult } from './routes';

export interface SpawnItem {
  /** 編成コード。他の鉄道会社の編成で名前が未入力なら undefined */
  formationCode: string | undefined;
  foreign: boolean;
  serviceId: string;
  kindId: string;
  entryIndex: number;
}

export interface PlatformSummary {
  /** `${stationId}#${platform}` */
  key: string;
  stationId: string;
  platform: number;
  /** どれかの系統が通る */
  used: boolean;
  /** 停車する種別のタグ（種別の登録順） */
  stopTags: string[];
  /** 通過する種別のタグ（停車タグにあるものは除く。種別の登録順） */
  passTags: string[];
  /** 並び順は「種別の登録順 → 系統の登録順」。同じ編成コードは1つ */
  spawns: SpawnItem[];
  /** いずれかの系統の終点 */
  isTerminal: boolean;
  /** 直通の終点：ここを終点とする系統がすべて直通先を持つ（rules §3.6） */
  throughTerminal: boolean;
  /** ここを終点とする系統の直通先（重複なし） */
  throughNotes: string[];
  /** spawn があるか、停車して先へ進む系統がある */
  hasDeparture: boolean;
}

/** すべての駅のすべてののりばを、駅・のりばの登録順に集計する */
export function summarizePlatforms(
  project: Project,
  routes: RoutesResult = computeRoutes(project),
  lookup: Lookup = createLookup(project),
): PlatformSummary[] {
  const kindOrder = new Map(project.kinds.map((k, i) => [k.id, i]));
  const serviceOrder = new Map(project.services.map((s, i) => [s.id, i]));

  interface Acc {
    used: boolean;
    stopKinds: Set<string>;
    passKinds: Set<string>;
    isTerminal: boolean;
    allThrough: boolean;
    throughNotes: Set<string>;
    continues: boolean;
  }
  const acc = new Map<string, Acc>();
  const get = (key: string): Acc => {
    let a = acc.get(key);
    if (!a) {
      a = {
        used: false,
        stopKinds: new Set(),
        passKinds: new Set(),
        isTerminal: false,
        allThrough: true,
        throughNotes: new Set(),
        continues: false,
      };
      acc.set(key, a);
    }
    return a;
  };

  for (const service of project.services) {
    const m = service.entries.length - 1;
    service.entries.forEach((e, i) => {
      if (e.platform === null) return;
      const a = get(platformKey(e.stationId, e.platform));
      a.used = true;
      if (i === m) {
        a.isTerminal = true;
        if (service.throughNote) a.throughNotes.add(service.throughNote);
        else a.allThrough = false;
      }
      for (const sk of service.kinds) {
        if (sk.stops[i]) {
          a.stopKinds.add(sk.kindId);
          if (i < m) a.continues = true;
        } else {
          a.passKinds.add(sk.kindId);
        }
      }
    });
  }

  const spawnsByKey = new Map<string, SpawnItem[]>();
  for (const d of routes.departures) {
    const key = platformKey(d.stationId, d.platform);
    const list = spawnsByKey.get(key) ?? [];
    spawnsByKey.set(key, list);
    if (d.formationCode !== undefined && list.some((x) => x.formationCode === d.formationCode)) {
      continue;
    }
    list.push({
      formationCode: d.formationCode,
      foreign: d.foreign,
      serviceId: d.serviceId,
      kindId: d.kindId,
      entryIndex: d.entryIndex,
    });
  }

  const byKindOrder = (a: string, b: string) => (kindOrder.get(a) ?? 0) - (kindOrder.get(b) ?? 0);
  const tagsOf = (kindIds: Iterable<string>) =>
    [...kindIds].sort(byKindOrder).map((id) => {
      const k = lookup.kind(id);
      return k ? kindTag(k) : '?';
    });

  const result: PlatformSummary[] = [];
  for (const station of project.stations) {
    for (const pf of station.platforms) {
      const key = platformKey(station.id, pf.number);
      const a = acc.get(key);
      const spawns = (spawnsByKey.get(key) ?? []).sort(
        (x, y) =>
          byKindOrder(x.kindId, y.kindId) ||
          (serviceOrder.get(x.serviceId) ?? 0) - (serviceOrder.get(y.serviceId) ?? 0),
      );
      const stopTags = tagsOf(a?.stopKinds ?? []);
      result.push({
        key,
        stationId: station.id,
        platform: pf.number,
        used: a?.used ?? false,
        stopTags,
        passTags: tagsOf(a?.passKinds ?? []).filter((t) => !stopTags.includes(t)),
        spawns,
        isTerminal: a?.isTerminal ?? false,
        throughTerminal: (a?.isTerminal ?? false) && (a?.allThrough ?? false),
        throughNotes: [...(a?.throughNotes ?? [])],
        hasDeparture: spawns.length > 0 || (a?.continues ?? false),
      });
    }
  }
  return result;
}
