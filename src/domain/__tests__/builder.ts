// テスト用の小さなプロジェクトを手早く書くための道具。
// 駅は駅コードの文字列（'KL04'、'NSC'）で指す。'KL04' の形なら番号つき、それ以外は自由文字列。

import type { Dir, Platform, Project, Service, Station, StationCode } from '../model';
import { companyByCode, createProject } from '../presets';

let seq = 0;
const env = { newId: () => `id${++seq}`, now: () => new Date('2026-09-24T00:00:00.000Z') };

export interface StationOpts {
  /** 管理団体のコード（既定は自団体 K） */
  org?: string;
  signsBySelf?: boolean;
}

export interface PlatformSpec {
  /** 行先コードに使う駅コード（既定は駅の最初のコード） */
  code?: string;
  dir?: Dir | null; // null で未入力
  deadEnd?: boolean;
}

export interface KindSpec {
  /** 種別のタグ（'Lo'、'SR-LSR'） */
  tag: string;
  formation: string;
  maxSpeed?: number;
  cars?: string;
  /** 停車しない駅（駅コード）。始発と終点は常に停車 */
  pass?: string[];
  /** 停車する駅だけを並べる書き方（pass と排他） */
  stopsAt?: string[];
}

export class ProjectBuilder {
  readonly project: Project;

  constructor() {
    this.project = createProject(companyByCode('K'), 'テスト', env);
    this.project.lines.forEach((l) => (l.id = `line-${l.code}`));
    this.project.kinds = [];
  }

  org(code: string, name = code): string {
    const id = `org-${code}`;
    this.project.orgs.push({ id, name, code });
    return id;
  }

  private orgId(code: string | undefined): string {
    if (!code) return this.project.selfOrgId;
    const o = this.project.orgs.find((x) => x.code === code);
    return o ? o.id : this.org(code);
  }

  /** 種別を登録（タグ = typeCode[-trainNameCode]）。登録順 = spawn の並び順 */
  kind(tag: string, name = tag): string {
    const [typeCode, trainNameCode] = tag.split('-') as [string, string | undefined];
    const id = `kind-${tag}`;
    this.project.kinds.push({ id, typeCode, ...(trainNameCode ? { trainNameCode } : {}), name });
    return id;
  }

  private kindId(tag: string): string {
    const id = `kind-${tag}`;
    return this.project.kinds.some((k) => k.id === id) ? id : this.kind(tag);
  }

  private parseCode(text: string): StationCode {
    const m = /^([A-Z])([A-Z])(\d{2})$/.exec(text);
    if (m) {
      return {
        kind: 'numbered',
        orgId: this.orgId(m[1] === 'K' ? undefined : m[1]),
        lineId: `line-${m[2]}`,
        number: Number(m[3]),
      };
    }
    return { kind: 'free', value: text };
  }

  /** 駅を登録。codes の最初が駅の ID 代わり。platforms はのりば番号 → 設定 */
  station(
    name: string,
    codes: string[],
    platforms: Record<number, PlatformSpec | Dir>,
    opts: StationOpts = {},
  ): this {
    const id = `st-${codes[0]}`;
    const managerOrgId = this.orgId(opts.org);
    const st: Station = {
      id,
      name,
      managerOrgId,
      signsBySelf: opts.signsBySelf ?? managerOrgId === this.project.selfOrgId,
      codes: codes.map((c) => ({ id: `code-${c}`, code: this.parseCode(c) })),
      platforms: Object.entries(platforms).map(([n, spec]): Platform => {
        const s: PlatformSpec = typeof spec === 'string' ? { dir: spec } : spec;
        return {
          number: Number(n),
          codeId: `code-${s.code ?? codes[0]}`,
          ...(s.dir === null ? {} : { dir: s.dir ?? 'right' }),
          deadEnd: s.deadEnd ?? false,
        };
      }),
    };
    this.project.stations.push(st);
    return this;
  }

  stationId(code: string): string {
    const st = this.project.stations.find((s) => s.codes.some((c) => c.id === `code-${code}`));
    if (!st) throw new Error(`駅コード ${code} の駅がない`);
    return st.id;
  }

  /** 系統を登録。entries は [駅コード, のりば番号 | null] の並び */
  service(
    name: string,
    direction: 'up' | 'down',
    entries: [string, number | null][],
    kinds: KindSpec[],
  ): this {
    const codes = entries.map(([c]) => c);
    const service: Service = {
      id: `sv${this.project.services.length + 1}`,
      name,
      direction,
      entries: entries.map(([c, platform]) => ({ stationId: this.stationId(c), platform })),
      kinds: kinds.map((k) => ({
        kindId: this.kindId(k.tag),
        formation: k.formation,
        maxSpeed: k.maxSpeed ?? 1,
        mobCollision: 'cancel',
        playerCollision: 'cancel',
        ...(k.cars ? { cars: k.cars } : {}),
        stops: codes.map((c, i) => {
          if (i === 0 || i === codes.length - 1) return true;
          if (k.stopsAt) return k.stopsAt.includes(c);
          return !(k.pass ?? []).includes(c);
        }),
      })),
    };
    this.project.services.push(service);
    return this;
  }

  include(code: string, platform: number): this {
    this.project.overrides.choice[`${this.stationId(code)}#${platform}`] = 'include';
    return this;
  }

  exclude(code: string, platform: number): this {
    this.project.overrides.choice[`${this.stationId(code)}#${platform}`] = 'exclude';
    return this;
  }

  build(): Project {
    return this.project;
  }
}

/**
 * 瑠璃線系統の一部（下り方向中心）。T1〜T3 と選択駅の推定に使う。
 * 直通快速・新快速・特急は通過駅も経由リストに入れてある（rules §3.1）。
 */
export function ruriDown(): ProjectBuilder {
  const b = new ProjectBuilder();
  b.org('H', 'HRA');
  b.kind('Lo', '普通');
  b.kind('Ra', '快速');
  b.kind('SR-LSR', '新快速');
  b.kind('EX-MKR', '特急みかり');
  b.station(
    'イアリーオ国際空港',
    ['IIA'],
    { 1: 'right', 2: 'left' },
    { org: 'CR', signsBySelf: true },
  )
    .station('アカシア島', ['KL01'], { 1: 'right', 2: 'left', 3: 'right' })
    .station('オット', ['KL02'], { 1: 'right', 2: 'left' })
    .station('瑠前TT', ['KL03'], { 1: 'right', 2: 'left' })
    .station('瑠璃中央', ['KL04', 'KU01'], {
      1: { code: 'KU01', deadEnd: true },
      2: 'right',
      3: 'right',
      4: 'left',
      5: 'left',
    })
    .station('セナポンタウン', ['KL05'], { 3: 'left', 4: 'left', 5: 'right', 6: 'right' })
    .station('南セナポン', ['KL06'], { 1: 'right', 2: 'left' })
    .station('クォーツ', ['KL07'], { 2: 'right', 3: 'left' })
    .station('クォーツ南口', ['KL08'], { 1: 'left', 2: 'right' })
    .station('沿海', ['KL09'], { 1: 'right', 2: 'left' })
    .station('瑠順中央', ['KL10', 'KB01'], {
      1: 'right',
      2: 'left',
      3: { code: 'KB01', dir: 'right' },
      4: { code: 'KB01', dir: 'left' },
    })
    .station('瑠順農園', ['KL11'], { 1: 'right', 2: 'left' })
    .station('瑠順要塞', ['KL12'], { 1: 'right', 2: 'left' })
    .station('エメラルド城', ['KL13', 'LM-1'], { 1: 'left', 2: 'right' })
    .station('南瑠順', ['KB02'], { 1: 'right', 3: 'right', 4: 'left' })
    .station('クォーツ湖', ['QUL'], {}, { org: 'H' })
    .station('西水中央', ['NSC'], { 1: 'right', 2: 'right' }, { org: 'H' })
    .station('瑠璃要塞', ['KU02'], { 1: 'left', 2: 'right' })
    .station('クロアチア', ['KU03'], { 1: 'left', 2: 'right' })
    .station('二労', ['KU06'], { 1: 'left', 2: 'left' });

  b.service(
    '瑠璃線 普通・快速 トクテルダム中央行',
    'down',
    [
      ['IIA', 1],
      ['KL01', 1],
      ['KL02', 1],
      ['KL03', 1],
      ['KL04', 2],
      ['KL05', 6],
      ['KL06', 1],
      ['KL07', 2],
      ['KL08', 2],
      ['KL09', 1],
      ['KL10', 1],
      ['KL11', 1],
      ['KL12', 1],
      ['KL13', 2],
    ],
    [
      { tag: 'Lo', formation: 'K300' },
      { tag: 'Ra', formation: 'K302', pass: ['KL02', 'KL03', 'KL06', 'KL08', 'KL11'] },
    ],
  );
  b.service(
    '直通快速 西水中央行',
    'down',
    [
      ['IIA', 1],
      ['KL01', 3],
      ['KL02', 1],
      ['KL03', 1],
      ['KL04', 3],
      ['KL05', 5],
      ['KL06', 1],
      ['KL07', 2],
      ['KL08', 2],
      ['KL09', 1],
      ['KB01', 3],
      ['KB02', 3],
      ['QUL', null],
      ['NSC', 2],
    ],
    [{ tag: 'Ra', formation: 'K302', pass: ['KL02', 'KL03', 'KL06', 'KL08', 'KB02', 'QUL'] }],
  );
  b.service(
    '中央線 新快速 西水中央行',
    'down',
    [
      ['KU06', 2],
      ['KU03', 1],
      ['KU02', 1],
      ['KL04', 3],
      ['KL05', 5],
      ['KL06', 1],
      ['KL07', 2],
      ['KL08', 2],
      ['KL09', 1],
      ['KB01', 3],
      ['KB02', 3],
      ['QUL', null],
      ['NSC', 2],
    ],
    [
      {
        tag: 'SR-LSR',
        formation: 'K200',
        maxSpeed: 1.5,
        stopsAt: ['KU03', 'KL04', 'KL05', 'KB01'],
      },
    ],
  );
  b.service(
    '特急みかり ラピスTT行（南瑠順まで）',
    'down',
    [
      ['KU06', 2],
      ['KU03', 1],
      ['KU02', 1],
      ['KL04', 3],
      ['KL05', 5],
      ['KL06', 1],
      ['KL07', 2],
      ['KL08', 2],
      ['KL09', 1],
      ['KB01', 3],
      ['KB02', 1],
    ],
    [
      {
        tag: 'EX-MKR',
        formation: 'K700',
        maxSpeed: 2,
        stopsAt: ['KU03', 'KU02', 'KL04', 'KL09', 'KB01'],
      },
    ],
  );
  b.service(
    '中央線 各駅停車 瑠璃中央行',
    'up',
    [
      ['KU06', 1],
      ['KU03', 1],
      ['KU02', 1],
      ['KU01', 1],
    ],
    [{ tag: 'Lo', formation: 'K301' }],
  );
  b.service(
    '中央線 各駅停車 二労行',
    'down',
    [
      ['KU01', 1],
      ['KU02', 2],
      ['KU03', 2],
      ['KU06', 2],
    ],
    [{ tag: 'Lo', formation: 'K300' }],
  );
  return b;
}
