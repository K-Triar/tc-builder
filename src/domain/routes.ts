// 各駅発・経路・編成（rules §3.3〜3.5）。

import { computeChoices, type ChoiceInfo } from './choice';
import { destText, formationCode, kindTag, routeCode, type Dest } from './codes';
import { createLookup, type Lookup } from './lookup';
import { departureKey, type Project } from './model';

/** 1つの発駅から出る1つの編成 */
export interface DepartureRow {
  serviceId: string;
  kindId: string;
  entryIndex: number;
  stationId: string;
  platform: number;
  /** 行先コードの並び */
  route: string[];
  routeCode: string;
  tag: string;
  /** 編成コード。他の鉄道会社の編成で名前が未入力なら undefined（要確認） */
  formationCode: string | undefined;
  /** 他の鉄道会社の編成（名前を手入力する。コマンドは作らない） */
  foreign: boolean;
  /** 各駅発の上書きがある */
  overridden: boolean;
}

export interface DepartureRef {
  serviceId: string;
  kindId: string;
  entryIndex: number;
  stationId: string;
  platform: number;
}

export interface RouteDef {
  code: string;
  dests: string[];
  /** この経路を使う編成コード（出てきた順） */
  usedBy: string[];
}

export interface FormationDef {
  code: string;
  formation: string;
  routeCode: string;
  route: string[];
  tag: string;
  maxSpeed: number;
  mobCollision: string;
  playerCollision: string;
  cars?: string;
  foreign: boolean;
  departures: DepartureRef[];
}

export interface RouteConflict {
  code: string;
  variants: string[][];
}

export interface FormationConflict {
  code: string;
  /** 食い違った項目 */
  fields: (keyof FormationDef)[];
}

export interface RoutesResult {
  departures: DepartureRow[];
  routes: RouteDef[];
  formations: FormationDef[];
  routeConflicts: RouteConflict[];
  formationConflicts: FormationConflict[];
}

const COMPARED_FIELDS = [
  'formation',
  'route',
  'tag',
  'maxSpeed',
  'mobCollision',
  'playerCollision',
  'cars',
] as const satisfies readonly (keyof FormationDef)[];

export function computeRoutes(
  project: Project,
  choices: ChoiceInfo[][] = computeChoices(project),
  lookup: Lookup = createLookup(project),
): RoutesResult {
  const departures: DepartureRow[] = [];
  const formations = new Map<string, FormationDef>();
  const formationConflicts = new Map<string, Set<keyof FormationDef>>();
  const routes = new Map<string, RouteDef>();
  const routeVariants = new Map<string, Map<string, string[]>>();

  project.services.forEach((service, si) => {
    const chosen = choices[si] ?? [];
    const m = service.entries.length - 1;

    for (const sk of service.kinds) {
      const kind = lookup.kind(sk.kindId);
      const tag = kind ? kindTag(kind) : '?';

      for (const [d, entry] of service.entries.entries()) {
        if (d === m || entry.platform === null || !sk.stops[d]) continue;
        const override = project.overrides.departure[departureKey(service.id, sk.kindId, d)];
        if (override?.enabled === false) continue;

        const route: Dest[] = [];
        service.entries.forEach((e, i) => {
          if (i > d && e.platform !== null && chosen[i]?.chosen) {
            route.push(destOrPlaceholder(lookup, e.stationId, e.platform));
          }
        });
        const dests = route.map(destText);
        const rCode = routeCode(route);

        const foreign = override?.foreignName !== undefined || !lookup.signsBySelf(entry.stationId);
        const formation = override?.formation ?? sk.formation;
        const code = foreign
          ? override?.foreignName || undefined
          : formationCode(formation, rCode, tag);

        const row: DepartureRow = {
          serviceId: service.id,
          kindId: sk.kindId,
          entryIndex: d,
          stationId: entry.stationId,
          platform: entry.platform,
          route: dests,
          routeCode: rCode,
          tag,
          formationCode: code,
          foreign,
          overridden: override !== undefined,
        };
        departures.push(row);

        // 経路（中身が同じものはまとめる。コードが同じで中身が違えば食い違い）
        if (rCode) {
          const variants = routeVariants.get(rCode) ?? new Map<string, string[]>();
          routeVariants.set(rCode, variants);
          variants.set(dests.join(' '), dests);
          const def = routes.get(rCode) ?? { code: rCode, dests, usedBy: [] };
          routes.set(rCode, def);
          if (code && !def.usedBy.includes(code)) def.usedBy.push(code);
        }

        if (!code) continue;
        const ref: DepartureRef = {
          serviceId: service.id,
          kindId: sk.kindId,
          entryIndex: d,
          stationId: entry.stationId,
          platform: entry.platform,
        };
        const candidate: FormationDef = {
          code,
          formation: foreign ? '' : formation,
          routeCode: rCode,
          route: dests,
          tag,
          maxSpeed: sk.maxSpeed,
          mobCollision: sk.mobCollision,
          playerCollision: sk.playerCollision,
          ...(sk.cars ? { cars: sk.cars } : {}),
          foreign,
          departures: [ref],
        };
        const existing = formations.get(code);
        if (!existing) {
          formations.set(code, candidate);
          continue;
        }
        existing.departures.push(ref);
        for (const field of COMPARED_FIELDS) {
          if (JSON.stringify(existing[field]) !== JSON.stringify(candidate[field])) {
            const set = formationConflicts.get(code) ?? new Set();
            formationConflicts.set(code, set.add(field));
          }
        }
      }
    }
  });

  return {
    departures,
    routes: [...routes.values()],
    formations: [...formations.values()],
    routeConflicts: [...routeVariants]
      .filter(([, v]) => v.size > 1)
      .map(([code, v]) => ({ code, variants: [...v.values()] })),
    formationConflicts: [...formationConflicts].map(([code, fields]) => ({
      code,
      fields: COMPARED_FIELDS.filter((f) => fields.has(f)),
    })),
  };
}

function destOrPlaceholder(lookup: Lookup, stationId: string, platform: number): Dest {
  return (
    lookup.dest(stationId, platform) ?? {
      code: { kind: 'free', value: `${lookup.station(stationId)?.name ?? '?'}?` },
      platform,
    }
  );
}
