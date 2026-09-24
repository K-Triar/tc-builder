// コマンドの手順（rules §5）。

import { contentHash } from './hash';
import type { FormationDef, RouteDef, RoutesResult } from './routes';

export type CommandBlockKind = 'prep' | 'route' | 'formation' | 'finish';

/** まとめてコピーでき、チェックを付けられる単位（1経路・1編成など） */
export interface CommandBlock {
  /** 進捗のキー。`route:<経路コード>`、`formation:<編成コード>` など */
  id: string;
  kind: CommandBlockKind;
  title: string;
  lines: string[];
  note?: string;
  hash: string;
}

export interface CommandGroup {
  kind: 'prep' | 'routes' | 'formations' | 'finish';
  title: string;
  /** 編成のグループの両数（未設定は undefined） */
  cars?: string;
  note?: string;
  blocks: CommandBlock[];
}

export interface CommandPlan {
  groups: CommandGroup[];
  notes: string[];
}

/** 最高速度は少なくとも小数1桁（1 → 1.0、0.75 → 0.75） */
export function formatSpeed(n: number): string {
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

export function routeCommands(route: Pick<RouteDef, 'code' | 'dests'>): string[] {
  return [`/train route set ${route.dests.join(' ')}`, `/train route save ${route.code}`];
}

export function formationCommands(f: FormationDef): string[] {
  return [
    `/train maxspeed ${formatSpeed(f.maxSpeed)}`,
    `/train collision mobs ${f.mobCollision}`,
    `/train collision player ${f.playerCollision}`,
    `/train tags set ${f.tag}`,
    `/train route load ${f.routeCode}`,
    `/train setname ${f.code}`,
    `/train save ${f.code}`,
  ];
}

const CHEST_NOTE = 'もらったアイテムを十分に長いレールに向けて使い、出た列車に乗ります。';

function block(b: Omit<CommandBlock, 'hash'>): CommandBlock {
  return { ...b, hash: contentHash({ lines: b.lines, note: b.note }) };
}

function prepBlock(cars: string | undefined, id: string): CommandBlock {
  return cars === undefined
    ? block({
        id,
        kind: 'prep',
        title: '列車を用意する',
        lines: [],
        note: '好きな両数の列車を出して乗ります（両数が未設定の編成だけのため）。',
      })
    : block({
        id,
        kind: 'prep',
        title: `${cars} の列車を用意する`,
        lines: [`/train chest ${cars}`],
        note: CHEST_NOTE,
      });
}

export function buildCommandPlan(routes: Pick<RoutesResult, 'routes' | 'formations'>): CommandPlan {
  // 両数ごとにまとめる（出てきた順、未設定は最後）
  const byCars = new Map<string | undefined, FormationDef[]>();
  for (const f of routes.formations) {
    if (f.foreign) continue;
    const list = byCars.get(f.cars) ?? [];
    byCars.set(f.cars, list.concat(f));
  }
  const carsOrder = [...byCars.keys()].sort(
    (a, b) => Number(a === undefined) - Number(b === undefined),
  );
  const firstCars = carsOrder[0];

  const groups: CommandGroup[] = [
    {
      kind: 'prep',
      title: '0. 準備',
      ...(firstCars !== undefined ? { cars: firstCars } : {}),
      blocks: [prepBlock(firstCars, 'prep:first')],
    },
    {
      kind: 'routes',
      title: '1. 経路の保存',
      note: '経路はすべて、編成の保存より先に保存します。',
      blocks: routes.routes
        .filter((r) => r.code !== '')
        .map((r) =>
          block({ id: `route:${r.code}`, kind: 'route', title: r.code, lines: routeCommands(r) }),
        ),
    },
  ];

  carsOrder.forEach((cars, i) => {
    const formations = byCars.get(cars) ?? [];
    const blocks = formations.map((f) =>
      block({
        id: `formation:${f.code}`,
        kind: 'formation',
        title: f.code,
        lines: formationCommands(f),
      }),
    );
    if (i > 0 && cars !== undefined) blocks.unshift(prepBlock(cars, `prep:${cars}`));
    groups.push({
      kind: 'formations',
      title: `2. 編成の保存（${cars === undefined ? '両数未設定' : `両数 ${cars}`}）`,
      ...(cars !== undefined ? { cars } : {}),
      ...(cars === undefined && i > 0
        ? { note: '両数が未設定の編成です。今乗っている列車のままで保存してかまいません。' }
        : {}),
      blocks,
    });
  });

  groups.push({
    kind: 'finish',
    title: '3. 仕上げ',
    note: '看板を足したり動かしたりした後も、このコマンドで道のりを計算し直します。',
    blocks: [
      block({
        id: 'finish:reroute',
        kind: 'finish',
        title: '道のりの再計算',
        lines: ['/train reroute'],
      }),
    ],
  });

  return {
    groups,
    notes: [
      '保存が終わるまで列車から降りないでください。',
      '同じ列車のまま次の編成を保存してかまいません（tags set と route load は上書きされます）。',
    ],
  };
}

/** 確認用コマンド（rules §5.2、ヘルプとして表示） */
export const CHECK_COMMANDS: readonly { command: string; purpose: string }[] = [
  { command: '/train route', purpose: '乗っている列車の経路' },
  { command: '/train tags', purpose: '乗っている列車のタグ' },
  {
    command: '/train debug destination',
    purpose: 'もらえる棒でレールを右クリックすると、行ける行先の一覧',
  },
  { command: '/train debug destination <行先>', purpose: 'その行先までの道のりを粒子で表示' },
  { command: '/train reroute', purpose: '看板を足したり動かしたりした後に道のりを計算し直す' },
];
