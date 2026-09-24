// 入力を楽にするための提案（R4.3・R4.4、design §6.2）。

import { formParity, pairedFormCode } from './codes';
import type { Direction, Project, Service, ServiceEntry, ServiceKind } from './model';
import { KIND_DEFAULTS, KIND_FALLBACK } from './presets';

/**
 * 系統の経由リストに駅を足すときののりばの提案。
 * 同じ前の駅から入る系統が使うのりば → その駅でよく使われるのりば → 最初ののりば の順。
 */
export function suggestPlatform(
  project: Project,
  prevStationId: string | undefined,
  stationId: string,
): number | null {
  const station = project.stations.find((s) => s.id === stationId);
  if (!station || station.platforms.length === 0) return null;
  const fromPrev = new Map<number, number>();
  const any = new Map<number, number>();
  for (const s of project.services) {
    s.entries.forEach((e, i) => {
      if (e.stationId !== stationId || e.platform === null) return;
      any.set(e.platform, (any.get(e.platform) ?? 0) + 1);
      if (prevStationId && s.entries[i - 1]?.stationId === prevStationId) {
        fromPrev.set(e.platform, (fromPrev.get(e.platform) ?? 0) + 1);
      }
    });
  }
  const best = (counts: Map<number, number>) =>
    [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
  return best(fromPrev) ?? best(any) ?? station.platforms[0]?.number ?? null;
}

/** 反対方向の系統。駅の並びを逆にし、のりばは要入力（未定）、形式番号は対の番号にする */
export function reverseService(service: Service, newId: string): Service {
  return {
    id: newId,
    name: `${service.name}（反対方向）`,
    direction: service.direction === 'up' ? 'down' : 'up',
    entries: [...service.entries]
      .reverse()
      .map((e) => ({ stationId: e.stationId, platform: null })),
    kinds: service.kinds.map((k) => ({
      ...k,
      formation: pairedFormCode(k.formation) ?? k.formation,
      stops: [...k.stops].reverse(),
    })),
  };
}

/**
 * 種別コードから用途番号を推す（KIND_DEFAULTS）。プロジェクトにない用途なら最初の用途。
 * 特急は 8。用途番号 8 がなく 7 を特急にしている以前のプロジェクトでは 7
 */
function guessUsage(project: Project, typeCode: string): string | undefined {
  const guess = (KIND_DEFAULTS[typeCode] ?? KIND_FALLBACK).usage;
  const usages = project.settings.usages;
  const legacy = typeCode === 'EX' ? usages.find((u) => u.digit === '7') : undefined;
  return (usages.find((u) => u.digit === guess) ?? legacy ?? usages[0])?.digit;
}

/** 系統に種別を載せるときの初期値 */
export function defaultServiceKind(
  project: Project,
  kindId: string,
  direction: Direction,
  entryCount: number,
): ServiceKind {
  const kind = project.kinds.find((k) => k.id === kindId);
  const orgCode = project.orgs.find((o) => o.id === project.selfOrgId)?.code ?? '';
  const usage = guessUsage(project, kind?.typeCode ?? '');
  const speed = project.settings.usages.find((u) => u.digit === usage)?.defaultMaxSpeed ?? 1;
  return {
    kindId,
    formation: usage ? `${orgCode}${usage}${direction === 'up' ? '01' : '00'}` : '',
    maxSpeed: speed,
    mobCollision: 'cancel',
    playerCollision: 'cancel',
    cars: (KIND_DEFAULTS[kind?.typeCode ?? ''] ?? KIND_FALLBACK).cars,
    stops: Array.from({ length: entryCount }, () => true),
  };
}

// ---- 列車の走り方を小さな質問で作る（docs/redesign2.md §2-4） ----

/** のりばが1つだけならその番号、なければ未定、2つ以上なら提案 */
function entryPlatform(project: Project, prev: string | undefined, stationId: string) {
  const st = project.stations.find((s) => s.id === stationId);
  if (!st || st.platforms.length === 0) return null;
  if (st.platforms.length === 1) return st.platforms[0]?.number ?? null;
  return suggestPlatform(project, prev, stationId);
}

/**
 * 始発と終点から、通る駅の候補を作る。駅の登録順で始発と終点の間にある駅を並べる
 * （分岐がある路線網では正しくないことがあるので、あとで足す／外すで直す）。
 */
export function suggestEntries(project: Project, fromId: string, toId: string): ServiceEntry[] {
  const ids = project.stations.map((s) => s.id);
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return [];
  const between = from < to ? ids.slice(from, to + 1) : ids.slice(to, from + 1).reverse();
  const entries: ServiceEntry[] = [];
  for (const stationId of between) {
    entries.push({
      stationId,
      platform: entryPlatform(project, entries.at(-1)?.stationId, stationId),
    });
  }
  return entries;
}

/** のりばを聞く駅（のりばが2つ以上ある駅）の、経由リストでの位置 */
export function platformQuestionIndexes(project: Project, service: Service): number[] {
  return service.entries.flatMap((e, i) => {
    const st = project.stations.find((s) => s.id === e.stationId);
    return st && st.platforms.length > 1 ? [i] : [];
  });
}

/** 「アカシア島 → エメラルド城 普通・快速」のような自動の名前 */
export function autoServiceName(project: Project, service: Service): string {
  const name = (i: number) =>
    project.stations.find((s) => s.id === service.entries[i]?.stationId)?.name || '？';
  const kinds = service.kinds
    .map((k) => project.kinds.find((x) => x.id === k.kindId)?.name)
    .filter(Boolean)
    .join('・');
  const ends =
    service.entries.length === 0 ? '' : `${name(0)} → ${name(service.entries.length - 1)}`;
  return [ends, kinds].filter(Boolean).join(' ');
}

/** 形式番号の一の位を向きに合わせる（上りは奇数、下りは偶数。rules §2.5）。形が違えばそのまま */
export function formationForDirection(form: string, direction: Direction): string {
  const parity = formParity(form);
  return parity && parity !== direction ? (pairedFormCode(form) ?? form) : form;
}

/**
 * 反対向きの走り方。駅と停車を逆にし、のりばが1つの駅だけ自動で決める（2つ以上ある駅は聞き直す）。
 * 名前は自動の名前にする
 */
export function reverseForGuide(project: Project, service: Service, newId: string): Service {
  const r = reverseService(service, newId);
  r.entries = r.entries.map((e) => {
    const st = project.stations.find((s) => s.id === e.stationId);
    return {
      ...e,
      platform: st?.platforms.length === 1 ? (st.platforms[0]?.number ?? null) : null,
    };
  });
  r.name = autoServiceName(project, r);
  return r;
}
