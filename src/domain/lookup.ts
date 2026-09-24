// プロジェクトの ID 引きと、駅・のりばから行先コードを作る道具。

import { codeContext, destText, resolveStationCode, type CodeParts, type Dest } from './codes';
import type { Kind, Platform, Project, Station } from './model';

export interface Lookup {
  project: Project;
  station(id: string): Station | undefined;
  platform(stationId: string, number: number): Platform | undefined;
  kind(id: string): Kind | undefined;
  /** のりばの行先（のりばや駅コードが見つからなければ undefined） */
  dest(stationId: string, platform: number): Dest | undefined;
  /** 行先コードの文字列。見つからなければ「<駅名>?-<番号>」 */
  destText(stationId: string, platform: number): string;
  /** 自分の鉄道会社が看板を置く駅か（rules §4.1） */
  signsBySelf(stationId: string): boolean;
}

export function createLookup(project: Project): Lookup {
  const ctx = codeContext(project);
  const stations = new Map(project.stations.map((s) => [s.id, s]));
  const kinds = new Map(project.kinds.map((k) => [k.id, k]));
  const codeParts = new Map<string, CodeParts>();
  for (const s of project.stations) {
    for (const c of s.codes) codeParts.set(`${s.id}/${c.id}`, resolveStationCode(c.code, ctx));
  }

  const platform = (stationId: string, number: number) =>
    stations.get(stationId)?.platforms.find((p) => p.number === number);

  const dest = (stationId: string, number: number): Dest | undefined => {
    const pf = platform(stationId, number);
    const code = pf && codeParts.get(`${stationId}/${pf.codeId}`);
    return code ? { code, platform: number } : undefined;
  };

  return {
    project,
    station: (id) => stations.get(id),
    platform,
    kind: (id) => kinds.get(id),
    dest,
    destText: (stationId, number) => {
      const d = dest(stationId, number);
      return d ? destText(d) : `${stations.get(stationId)?.name ?? '?'}?-${number}`;
    },
    signsBySelf: (stationId) => {
      const s = stations.get(stationId);
      if (!s) return false;
      return s.managerOrgId === project.selfOrgId || s.signsBySelf;
    },
  };
}
