// 入力を楽にするための提案（R4.3・R4.4、design §6.2）。

import { pairedFormCode } from './codes';
import type { Direction, Project, Service, ServiceKind } from './model';

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

/** 種別コードから用途番号を推す（特急 7、新快速 2、それ以外 3）。プロジェクトにない用途なら最初の用途 */
function guessUsage(project: Project, typeCode: string): string | undefined {
  const guess = typeCode === 'EX' ? '7' : typeCode === 'SR' ? '2' : '3';
  const usages = project.settings.usages;
  return (usages.find((u) => u.digit === guess) ?? usages[0])?.digit;
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
    stops: Array.from({ length: entryCount }, () => true),
  };
}
