// 入力（Project）から出力をまとめて計算する（design §5）。UI は Project が変わるたびに1回呼ぶ。

import { computeChoices, type ChoiceInfo } from './choice';
import { buildCommandPlan, type CommandPlan } from './commands';
import { createLookup, type Lookup } from './lookup';
import type { Project } from './model';
import { summarizePlatforms, type PlatformSummary } from './platforms';
import {
  computeRoutes,
  type DepartureRow,
  type FormationConflict,
  type FormationDef,
  type RouteConflict,
  type RouteDef,
} from './routes';
import { buildSigns, type PlatformCard, type StationCard } from './signs';
import { validate, type Issue } from './validate';

export interface Derived {
  lookup: Lookup;
  /** [系統の添字][経由要素の添字] */
  choices: ChoiceInfo[][];
  departures: DepartureRow[];
  routes: RouteDef[];
  formations: FormationDef[];
  routeConflicts: RouteConflict[];
  formationConflicts: FormationConflict[];
  platformSummaries: PlatformSummary[];
  platformCards: PlatformCard[];
  stationCards: StationCard[];
  commandPlan: CommandPlan;
  issues: Issue[];
  /** エラーがある（出力を止める） */
  hasErrors: boolean;
}

export function derive(project: Project): Derived {
  const lookup = createLookup(project);
  const choices = computeChoices(project);
  const routes = computeRoutes(project, choices, lookup);
  const summaries = summarizePlatforms(project, routes, lookup);
  const signs = buildSigns(project, { lookup, choices, routes, summaries });
  const issues = validate(project, { lookup, choices, routes, summaries, signs });
  return {
    lookup,
    choices,
    ...routes,
    platformSummaries: summaries,
    platformCards: signs.platformCards,
    stationCards: signs.stationCards,
    commandPlan: buildCommandPlan(routes),
    issues,
    hasErrors: issues.some((i) => i.severity === 'error'),
  };
}
