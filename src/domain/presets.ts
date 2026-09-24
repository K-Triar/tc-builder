// 鉄道会社の一覧（requirements R2.1）と新しいプロジェクトの作成。

import { SCHEMA_VERSION, type Project, type Usage } from './model';

/** 新しいプロジェクトで自分の鉄道会社になる会社 */
export interface Company {
  name: string;
  /** 省略コード（K、C、SU など）。駅コード・形式コードの先頭に付く */
  code: string;
  /** Wiki にある路線コード。分かっている会社だけ */
  lines: readonly { code: string; name: string }[];
}

export interface ListedCompany extends Company {
  /** Wiki の表の長いコード（KT、CR など）。表示用 */
  fullCode: string;
}

/**
 * サーバー Wiki「TrainCartsで使うコード」の KT式 団体コード表（2026-09-25 時点）。
 * 並びは Wiki のまま。路線コードは Wiki に載っている会社だけ入れる。
 */
export const COMPANIES: readonly ListedCompany[] = [
  {
    name: 'Kトライア',
    fullCode: 'KT',
    code: 'K',
    lines: [
      { code: 'L', name: '瑠璃本線' },
      { code: 'B', name: '貿易港線' },
      { code: 'Q', name: '地下鉄交易所線' },
      { code: 'U', name: '地下鉄中央線' },
      { code: 'Y', name: '富士有徳線' },
    ],
  },
  { name: 'ころりん鉄道', fullCode: 'CR', code: 'C', lines: [] },
  { name: 'だいやキラめき鉄道', fullCode: 'DKR', code: 'D', lines: [] },
  { name: 'エメラルド国営鉄道', fullCode: 'ERB', code: 'E', lines: [] },
  { name: 'ヘルヴェティア鉄道局', fullCode: 'HRA', code: 'H', lines: [] },
  { name: 'ジストーリオ鉄道', fullCode: 'JR', code: 'J', lines: [] },
  { name: 'セナポンタウン交通局', fullCode: 'STA', code: 'S', lines: [] },
  { name: 'メトロトクテルダム', fullCode: 'MET', code: 'T', lines: [] },
  { name: '山田ふってぃ鉄道', fullCode: 'YFR', code: 'Y', lines: [] },
  { name: '翠鉄（翠玉急行電気鉄道）', fullCode: 'SU', code: 'SU', lines: [] },
];

/** 一覧から省略コードで探す */
export function companyByCode(code: string): ListedCompany {
  const c = COMPANIES.find((x) => x.code === code);
  if (!c) throw new Error(`一覧にない鉄道会社コード: ${code}`);
  return c;
}

/** 一覧にない鉄道会社（名前とコードは自分で入れる） */
export function customCompany(name = '', code = ''): Company {
  return { name, code, lines: [] };
}

/** KT式の種別コード（rules §2.6）。どの会社でも同じ */
export const KT_KINDS: readonly { typeCode: string; name: string }[] = [
  { typeCode: 'Lo', name: '普通' },
  { typeCode: 'Ra', name: '快速' },
  { typeCode: 'SR', name: '特別快速' },
  { typeCode: 'EX', name: '特急' },
  { typeCode: 'Fg', name: '貨物' },
  { typeCode: 'Tm', name: '路面電車' },
  { typeCode: 'Te', name: '試運転' },
];

/** 新しいプロジェクトで最初から選んでおく種別（redesign2 §6 Q4）。貨物・路面電車・試運転は「ほかの種別」から足す */
export const DEFAULT_KIND_CODES: readonly string[] = ['Lo', 'Ra', 'SR', 'EX'];

/** KT式の用途番号と標準最高速度（rules §2.5）。どの会社でも同じ */
export const KT_USAGES: readonly Usage[] = [
  { digit: '1', label: '路面電車型', defaultMaxSpeed: 0.75 },
  { digit: '2', label: '在来線標準型・新快速', defaultMaxSpeed: 1.5 },
  { digit: '3', label: '在来線標準型・普通快速', defaultMaxSpeed: 1.0 },
  { digit: '6', label: '貨物', defaultMaxSpeed: 1.5 },
  { digit: '8', label: '特急', defaultMaxSpeed: 2.0 },
  { digit: '9', label: '試験・事業用', defaultMaxSpeed: 0.5 },
];

/**
 * 種別コードごとの用途番号と両数の初期値（rules §2.7）。
 * 一覧にない種別（自分で足した種別・以前の臨時 ET など）は KIND_FALLBACK
 */
export const KIND_DEFAULTS: Readonly<Record<string, { usage: string; cars: string }>> = {
  Lo: { usage: '3', cars: 'mmmm' },
  Ra: { usage: '3', cars: 'mmmm' },
  SR: { usage: '2', cars: 'mmmmmm' },
  EX: { usage: '8', cars: 'mmmmmm' },
  Fg: { usage: '6', cars: 'msssss' },
  Tm: { usage: '1', cars: 'mm' },
  Te: { usage: '9', cars: 'mmmm' },
};
export const KIND_FALLBACK = { usage: '3', cars: 'mmmm' } as const;

export const DEFAULT_SETTINGS = {
  spawnSpeed: 1,
  stationLaunchDistance: 5,
  stationDwellSeconds: 5,
} as const;

/** ID と時刻の出どころ。テストでは固定値を渡す */
export interface CreateEnv {
  newId: () => string;
  now: () => Date;
}

const defaultEnv: CreateEnv = {
  newId: () => globalThis.crypto.randomUUID(),
  now: () => new Date(),
};

/** 選んだ鉄道会社を自分の鉄道会社にして、KT式の種別・用途番号が入ったプロジェクトを作る */
export function createProject(
  company: Company,
  name: string,
  env: CreateEnv = defaultEnv,
): Project {
  const now = env.now().toISOString();
  const selfOrgId = env.newId();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: env.newId(),
    name,
    createdAt: now,
    updatedAt: now,
    selfOrgId,
    settings: { ...DEFAULT_SETTINGS, usages: KT_USAGES.map((u) => ({ ...u })) },
    orgs: [{ id: selfOrgId, name: company.name, code: company.code }],
    lines: company.lines.map((l) => ({ id: env.newId(), orgId: selfOrgId, ...l })),
    kinds: KT_KINDS.filter((k) => DEFAULT_KIND_CODES.includes(k.typeCode)).map((k) => ({
      id: env.newId(),
      ...k,
    })),
    stations: [],
    services: [],
    overrides: { choice: {}, departure: {}, skipCondition: {} },
    progress: { items: {} },
  };
}

/**
 * はじめての質問（集中モード）で作るプロジェクト。名前と鉄道会社はこのあとの質問で入れるので空にしておく。
 */
export function createGuidedProject(env: CreateEnv = defaultEnv): Project {
  return { ...createProject(customCompany(), '', env), guide: { at: 'name' } };
}
