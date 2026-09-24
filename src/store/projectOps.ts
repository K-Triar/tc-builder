// Project を書き換える操作。immer の draft に対して呼ぶ。
// 経由リストを変えるときは、全種別の stops と、添字を含む各駅発の上書きキーを一緒に付け替える（design §4.1）。

import { departureKey, platformKey, type Project, type ServiceEntry } from '../domain/model';

function findService(p: Project, serviceId: string) {
  const s = p.services.find((x) => x.id === serviceId);
  if (!s) throw new Error(`系統 ${serviceId} がありません`);
  return s;
}

/** 始発と終点は停車に固定する */
function pinEnds(p: Project, serviceId: string): void {
  const s = findService(p, serviceId);
  for (const k of s.kinds) {
    if (k.stops.length > 0) {
      k.stops[0] = true;
      k.stops[k.stops.length - 1] = true;
    }
  }
}

/**
 * 系統の各駅発の上書きキーの添字を付け替える。
 * remap が undefined を返した上書きは消す。
 */
function remapDepartureKeys(
  p: Project,
  serviceId: string,
  remap: (index: number, kindId: string) => number | undefined,
): void {
  const next: Project['overrides']['departure'] = {};
  for (const [key, value] of Object.entries(p.overrides.departure)) {
    const [sid, kindId = '', index = ''] = key.split('#');
    if (sid !== serviceId) {
      next[key] = value;
      continue;
    }
    const to = remap(Number(index), kindId);
    if (to !== undefined) next[departureKey(serviceId, kindId, to)] = value;
  }
  p.overrides.departure = next;
}

/** 経由リストの index の位置に駅を入れる（途中の駅は通過で入る） */
export function insertEntry(
  p: Project,
  serviceId: string,
  index: number,
  entry: ServiceEntry,
): void {
  const s = findService(p, serviceId);
  const at = Math.max(0, Math.min(index, s.entries.length));
  s.entries.splice(at, 0, { ...entry });
  for (const k of s.kinds) k.stops.splice(at, 0, false);
  remapDepartureKeys(p, serviceId, (i) => (i >= at ? i + 1 : i));
  pinEnds(p, serviceId);
}

export function removeEntry(p: Project, serviceId: string, index: number): void {
  const s = findService(p, serviceId);
  if (index < 0 || index >= s.entries.length) return;
  s.entries.splice(index, 1);
  for (const k of s.kinds) k.stops.splice(index, 1);
  remapDepartureKeys(p, serviceId, (i) => (i === index ? undefined : i > index ? i - 1 : i));
  pinEnds(p, serviceId);
}

export function moveEntry(p: Project, serviceId: string, from: number, to: number): void {
  const s = findService(p, serviceId);
  const n = s.entries.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return;
  const order = [...Array(n).keys()];
  order.splice(to, 0, ...order.splice(from, 1));
  // order[新しい添字] = 古い添字
  const newIndexOf = new Map(order.map((old, i) => [old, i]));
  const entries = s.entries;
  s.entries = order.flatMap((old) => entries[old] ?? []);
  for (const k of s.kinds) {
    const stops = k.stops;
    k.stops = order.map((old) => stops[old] ?? false);
  }
  remapDepartureKeys(p, serviceId, (i) => newIndexOf.get(i));
  pinEnds(p, serviceId);
}

export function removeService(p: Project, serviceId: string): void {
  p.services = p.services.filter((s) => s.id !== serviceId);
  remapDepartureKeys(p, serviceId, () => undefined);
}

export function removeServiceKind(p: Project, serviceId: string, kindId: string): void {
  const s = findService(p, serviceId);
  s.kinds = s.kinds.filter((k) => k.kindId !== kindId);
  remapDepartureKeys(p, serviceId, (i, k) => (k === kindId ? undefined : i));
}

/** のりば番号を変え、系統の経由リストとのりば単位の上書きキーも付け替える */
export function renumberPlatform(p: Project, stationId: string, from: number, to: number): void {
  if (from === to) return;
  const st = p.stations.find((s) => s.id === stationId);
  const pf = st?.platforms.find((x) => x.number === from);
  if (!st || !pf) throw new Error('のりばがありません');
  if (st.platforms.some((x) => x.number === to)) throw new Error(`${to}番はすでにあります`);
  pf.number = to;
  for (const s of p.services) {
    for (const e of s.entries) {
      if (e.stationId === stationId && e.platform === from) e.platform = to;
    }
  }
  const fromKey = platformKey(stationId, from);
  const toKey = platformKey(stationId, to);
  const rename = <T>(map: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(map).map(([k, v]) => [k === fromKey ? toKey : k, v]));
  p.overrides.choice = rename(p.overrides.choice);
  p.overrides.skipCondition = rename(p.overrides.skipCondition);
}
