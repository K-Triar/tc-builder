// 看板の生成（rules §4）：のりばのパターン、看板の4行、skip 条件、図の並び、ボタン、C と switcher。

import { computeChoices, type ChoiceInfo } from './choice';
import { contentHash } from './hash';
import { createLookup, type Lookup } from './lookup';
import { platformKey, type Dir, type Platform, type Project } from './model';
import { summarizePlatforms, type PlatformSummary } from './platforms';
import { computeRoutes, type RoutesResult } from './routes';

export type SignKind =
  'spawn' | 'station' | 'destination' | 'skip' | 'skipDestroy' | 'destroy' | 'switcher';

export interface Sign {
  kind: SignKind;
  lines: [string, string, string, string];
  /** 手入力が必要（SKIP_MANUAL、他の鉄道会社の編成名が未入力の spawn） */
  manual?: boolean;
}

export type Pattern = 'A' | 'B' | 'D' | 'T' | 'G' | 'foreign' | 'passOnly';

export const PATTERN_LABELS: Record<Pattern, string> = {
  A: 'A：全列車が止まるのりば',
  B: 'B：通過列車があるのりば',
  D: 'D：終点（降車専用）',
  T: 'T：直通の終点（相手の鉄道会社の線へそのまま走る）',
  G: 'G：折り返し（行き止まり）',
  foreign: '他の鉄道会社の設定に従うのりば',
  passOnly: '通過専用の線路',
};

export interface PlatformCard {
  /** `${stationId}#${platform}` */
  id: string;
  stationId: string;
  platform: number;
  destCode: string;
  pattern: Pattern;
  dir?: Dir;
  /** 進行方向順 */
  signs: Sign[];
  /** ホームから見た物理的な左→右の並び（signs の添字） */
  diagram: number[];
  buttonHint?: 'onBlock' | 'leftSide';
  /** skip 条件を自動で決められない（SKIP_MANUAL） */
  skipManual: boolean;
  notes: string[];
  /** 進捗判定用（看板・向き・ボタンから計算） */
  hash: string;
}

export interface CleanupInstruction {
  /** 出ていく先の駅 */
  towardStationId: string;
  /** この出口へ発車するのりば */
  platforms: number[];
  signs: Sign[];
  text: string;
}

export interface SwitcherInstruction {
  reasons: string[];
  sign: Sign;
  text: string;
}

export interface StationCard {
  stationId: string;
  name: string;
  /** 相手の鉄道会社が看板を置く駅 */
  foreign: boolean;
  platformCards: PlatformCard[];
  cleanups: CleanupInstruction[];
  switcher?: SwitcherInstruction;
  notes: string[];
}

export interface SignsResult {
  platformCards: PlatformCard[];
  stationCards: StationCard[];
}

// ---- 数値と看板の書式（rules §4.2） ----

/** 整数なら小数点を付けない（5.0 → 5） */
export function formatNumber(n: number): string {
  return String(n);
}

const signOf = (kind: SignKind, l1: string, l2 = '', l3 = '', l4 = ''): Sign => ({
  kind,
  lines: [l1, l2, l3, l4],
});

export const skipDestroySign = (): Sign =>
  signOf('skipDestroy', '[+train]', 'skip destroy 0 1', '!empty');
export const destroySign = (): Sign => signOf('destroy', '[+train]', 'destroy');
export const switcherSign = (): Sign => signOf('switcher', '[+train]', 'switcher');

// ---- skip の条件（rules §4.4） ----

/** 自動で決められなければ undefined（手入力） */
export function skipCondition(
  stopTags: readonly string[],
  passTags: readonly string[],
): { line3: string; line4: string } | undefined {
  if (stopTags.length === 1) return { line3: `!t@${stopTags[0]}`, line4: '' };
  if (passTags.length === 1) return { line3: `t@${passTags[0]}`, line4: '' };
  if (passTags.length === 2) return { line3: `t@${passTags[0]}`, line4: `|t@${passTags[1]}` };
  return undefined;
}

// ---- パターン（rules §4.3） ----

export function platformPattern(
  s: Pick<
    PlatformSummary,
    'stopTags' | 'passTags' | 'isTerminal' | 'throughTerminal' | 'hasDeparture'
  >,
  platform: Pick<Platform, 'deadEnd'>,
  signsBySelf: boolean,
): Pattern {
  if (!signsBySelf) return 'foreign';
  if (s.stopTags.length === 0) return 'passOnly';
  if (!s.hasDeparture && s.throughTerminal) return 'T';
  if (!s.hasDeparture && s.isTerminal && !platform.deadEnd) return 'D';
  if (platform.deadEnd && s.hasDeparture) return 'G';
  if (s.passTags.length > 0) return 'B';
  return 'A';
}

// ---- のりばカード ----

export function buildSigns(
  project: Project,
  deps: {
    lookup?: Lookup;
    choices?: ChoiceInfo[][];
    routes?: RoutesResult;
    summaries?: PlatformSummary[];
  } = {},
): SignsResult {
  const lookup = deps.lookup ?? createLookup(project);
  const choices = deps.choices ?? computeChoices(project);
  const routes = deps.routes ?? computeRoutes(project, choices, lookup);
  const summaries = deps.summaries ?? summarizePlatforms(project, routes, lookup);
  const summaryByKey = new Map(summaries.map((s) => [s.key, s]));

  const platformCards: PlatformCard[] = [];
  const stationCards: StationCard[] = [];
  for (const station of project.stations) {
    const bySelf = lookup.signsBySelf(station.id);
    const cards = station.platforms.map((pf) => {
      const summary = summaryByKey.get(platformKey(station.id, pf.number));
      return platformCard(project, lookup, station.id, pf, summary, bySelf);
    });
    platformCards.push(...cards);
    stationCards.push({
      stationId: station.id,
      name: station.name,
      foreign: !bySelf,
      platformCards: cards,
      ...stationInstructions(project, lookup, station.id, cards, bySelf),
      notes: bySelf
        ? []
        : [
            'この駅の看板は相手の鉄道会社の設定に従います。行先コードとのりばの向きをすり合わせてください。',
          ],
    });
  }
  return { platformCards, stationCards };
}

function platformCard(
  project: Project,
  lookup: Lookup,
  stationId: string,
  pf: Platform,
  summary: PlatformSummary | undefined,
  bySelf: boolean,
): PlatformCard {
  const s: PlatformSummary = summary ?? {
    key: platformKey(stationId, pf.number),
    stationId,
    platform: pf.number,
    used: false,
    stopTags: [],
    passTags: [],
    spawns: [],
    isTerminal: false,
    throughTerminal: false,
    throughNotes: [],
    hasDeparture: false,
  };
  const destCode = lookup.destText(stationId, pf.number);
  const pattern = platformPattern(s, pf, bySelf);
  const notes: string[] = [];
  const base = {
    id: s.key,
    stationId,
    platform: pf.number,
    destCode,
    pattern,
    ...(pf.dir ? { dir: pf.dir } : {}),
  };

  if (pattern === 'foreign') {
    notes.push(`相手の鉄道会社の設定に従います（行先コード ${destCode} をすり合わせてください）。`);
    return finish({ ...base, signs: [], diagram: [], skipManual: false, notes });
  }

  const params = { ...project.settings, ...pf.params };
  const destination = signOf('destination', '[+train]', 'destination', destCode);
  const station = signOf(
    'station',
    '[+train]',
    `station ${formatNumber(params.stationLaunchDistance)}`,
    formatNumber(params.stationDwellSeconds),
    pf.dir ?? '',
  );
  const spawns = s.spawns.map((sp): Sign => {
    const sign = signOf(
      'spawn',
      '[train]',
      `spawn ${formatNumber(params.spawnSpeed)}`,
      sp.formationCode ?? '',
    );
    return sp.formationCode === undefined ? { ...sign, manual: true } : sign;
  });

  let signs: Sign[];
  let skipManual = false;
  switch (pattern) {
    case 'passOnly':
      signs = [destination];
      break;
    case 'T':
      signs = [station, destination];
      notes.push(
        `直通先（${s.throughNotes.join('、')}）へそのまま走るので destroy を置きません。直通先の看板は相手の鉄道会社の設定に従います。`,
      );
      break;
    case 'D':
      signs = [destroySign(), destination];
      notes.push('到着した列車は入口の destroy で消えます（想定どおり）。');
      break;
    case 'G':
      signs = [...spawns, station, destination, skipDestroySign(), destroySign()];
      notes.push(
        '看板は発車する向きの順に並べます。到着列車は逆向きに入り、最初に destroy を踏んで消えます（想定どおり）。',
      );
      break;
    case 'B': {
      const auto = skipCondition(s.stopTags, s.passTags);
      const manualInput = project.overrides.skipCondition[s.key];
      skipManual = auto === undefined;
      const cond = auto ?? manualInput ?? { line3: '', line4: '' };
      const skip = signOf(
        'skip',
        '[+train]',
        `skip 0 ${spawns.length + 1}`,
        cond.line3,
        cond.line4,
      );
      signs = [skipManual ? { ...skip, manual: true } : skip, ...spawns, station, destination];
      if (skipManual) {
        notes.push(
          `skip の条件を自動で決められません（停車 ${s.stopTags.join('・')}／通過 ${s.passTags.join('・')}）。3・4行目を手で入れてください。`,
        );
      }
      break;
    }
    case 'A':
      signs = [...spawns, station, destination];
      break;
  }

  if (s.isTerminal && !s.throughTerminal && (pattern === 'A' || pattern === 'B')) {
    notes.push('通り抜けできるのりばが終点になっています。乗客が降りない可能性があります。');
  }
  if (!pf.dir) notes.push('進む向きが未入力です。のりばの設定で入力してください。');
  let buttonHint: PlatformCard['buttonHint'];
  if (spawns.length > 0) {
    if (pf.dir) buttonHint = pf.dir === 'right' ? 'onBlock' : 'leftSide';
    if (buttonHint === 'onBlock') {
      notes.push(
        'spawn のボタンは看板が貼ってあるブロックに直接付けます。列車はホームから見て右へ出ます。',
      );
    } else if (buttonHint === 'leftSide') {
      notes.push(
        'spawn にはホームから見て看板ブロックの「左横」から電源を入れます（左隣のブロックにボタンを付けてレッドストーンで入れるなど）。貼ってあるブロックに付けると右へ出ようとするので注意。',
      );
    }
    notes.push('隣の spawn 看板と電源を共有しないでください。');
    if (spawns.length >= 5)
      notes.push(`spawn 看板が ${spawns.length} 枚並びます。レールの長さに注意してください。`);
    if (spawns.some((x) => x.manual)) {
      notes.push('他の鉄道会社の編成名が未入力の spawn があります（要確認）。');
    }
  }
  notes.push('設置したら試運転で向きと動きを確かめてください。');

  const order = signs.map((_, i) => i);
  const diagram = pf.dir === 'left' ? order.reverse() : order;
  return finish({
    ...base,
    signs,
    diagram,
    ...(buttonHint ? { buttonHint } : {}),
    skipManual,
    notes,
  });
}

function finish(card: Omit<PlatformCard, 'hash'>): PlatformCard {
  return {
    ...card,
    hash: contentHash({
      pattern: card.pattern,
      dir: card.dir,
      signs: card.signs.map((s) => s.lines),
      buttonHint: card.buttonHint,
    }),
  };
}

// ---- 駅ごとの C と switcher（rules §4.5） ----

function stationInstructions(
  project: Project,
  lookup: Lookup,
  stationId: string,
  cards: PlatformCard[],
  bySelf: boolean,
): { cleanups: CleanupInstruction[]; switcher?: SwitcherInstruction } {
  if (!bySelf) return { cleanups: [] };
  const name = (id: string) => lookup.station(id)?.name ?? '?';
  const patternOf = new Map(cards.map((c) => [c.platform, c.pattern]));

  /** 出口（次の駅）ごとの、停車して発車するのりば／通るすべてののりば */
  const departing = new Map<string, Set<number>>();
  const exits = new Map<string, Set<number>>();
  /** 入口（前の駅）ごとの、入るのりば */
  const entrances = new Map<string, Set<number>>();
  const add = (map: Map<string, Set<number>>, key: string, n: number) => {
    const set = map.get(key) ?? new Set<number>();
    map.set(key, set.add(n));
  };

  for (const service of project.services) {
    service.entries.forEach((e, i) => {
      if (e.stationId !== stationId || e.platform === null) return;
      const prev = service.entries[i - 1];
      const next = service.entries[i + 1];
      if (prev) add(entrances, prev.stationId, e.platform);
      if (next) {
        add(exits, next.stationId, e.platform);
        if (service.kinds.some((k) => k.stops[i])) add(departing, next.stationId, e.platform);
      }
    });
  }

  const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);
  const list = (ns: number[]) => ns.map((n) => `${n}番`).join('・');

  const cleanups: CleanupInstruction[] = [];
  for (const [toward, set] of departing) {
    const platforms = sorted(set);
    if (platforms.every((n) => patternOf.get(n) === 'G')) continue;
    cleanups.push({
      towardStationId: toward,
      platforms,
      signs: [skipDestroySign(), destroySign()],
      text: `${name(toward)}方面の出口：station から少し離れた出口側、のりば（${list(platforms)}）からの線路が合流した先に1セット置きます（進行方向順に skip destroy → destroy）。`,
    });
  }

  const reasons: string[] = [];
  for (const [from, set] of entrances) {
    if (set.size >= 2) reasons.push(`${name(from)} 方面から ${list(sorted(set))} に分かれる`);
  }
  for (const [toward, set] of exits) {
    if (set.size >= 2) reasons.push(`${list(sorted(set))} から ${name(toward)} 方面へ合流する`);
  }
  if (reasons.length === 0) return { cleanups };
  return {
    cleanups,
    switcher: {
      reasons,
      sign: switcherSign(),
      text: '駅の前後のすべてのポイント（分岐・合流）の真下に switcher を置きます。',
    },
  };
}
