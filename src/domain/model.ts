// 入力データの型（design §4）。保存するのは Project だけで、出力は毎回 derive で計算する。

export const SCHEMA_VERSION = 1;

export interface Project {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  createdAt: string; // ISO
  updatedAt: string;
  lastExportedAt?: string; // ファイル書き出し日時（未保存警告に使う）
  selfOrgId: string;
  settings: ProjectSettings;
  orgs: Org[];
  lines: Line[];
  kinds: Kind[]; // 種別（登録順 = spawn の並び順の第1キー）
  stations: Station[];
  services: Service[]; // 系統（登録順 = spawn の並び順の第2キー）
  overrides: Overrides;
  progress: Progress;
}

export interface ProjectSettings {
  spawnSpeed: number; // 既定 1
  stationLaunchDistance: number; // 既定 5
  stationDwellSeconds: number; // 既定 5
  usages: Usage[]; // 用途番号（KT式 共通：1,2,3,6,7,9）
}

export interface Usage {
  digit: string;
  label: string;
  defaultMaxSpeed: number;
}

export interface Org {
  id: string;
  name: string;
  code: string; // K, H など
}

export interface Line {
  id: string;
  orgId: string;
  code: string; // L, B, Q, U, Y
  name: string;
}

export interface Kind {
  id: string;
  typeCode: string; // Lo, Ra, SR, EX, ET, Te
  trainNameCode?: string; // LSR, MKR
  name: string; // 表示名（新快速、特急みかり）
}

export type StationCode =
  | { kind: 'numbered'; orgId: string; lineId: string; number: number } // KL04
  | { kind: 'free'; value: string }; // IIA, LM-1

export interface StationCodeEntry {
  id: string;
  code: StationCode;
}

export interface Station {
  id: string;
  name: string;
  managerOrgId: string; // 管理団体
  signsBySelf: boolean; // 他団体駅で自分が看板を置くか（自団体駅は常に true）
  codes: StationCodeEntry[];
  platforms: Platform[];
}

/** ホームに立って線路を見たとき、列車が進む向き（rules §4.6）。左→右 = right */
export type Dir = 'right' | 'left';

export type PlatformParams = Partial<
  Pick<ProjectSettings, 'spawnSpeed' | 'stationLaunchDistance' | 'stationDwellSeconds'>
>;

export interface Platform {
  number: number;
  codeId: string; // 行先コードに使う駅コード（Station.codes の id）
  label?: string; // 「下り」「瑠璃線赤石方面」など表示用
  dir?: Dir; // 未入力はエラー（看板を作る場合）
  deadEnd: boolean; // 行き止まり（折り返し）
  params?: PlatformParams;
}

export type Direction = 'up' | 'down';

export interface Service {
  id: string;
  name: string; // 「CRアカシア線→瑠璃線→翠鉄城東線 トクテルダム中央行」
  direction: Direction;
  throughNote?: string; // 直通先の表示用テキスト
  entries: ServiceEntry[]; // 経由リスト（通過駅も含む）
  kinds: ServiceKind[];
}

export interface ServiceEntry {
  stationId: string;
  platform: number | null; // null = のりば未定（他団体区間）
}

export interface ServiceKind {
  kindId: string;
  formation: string; // 形式コード（K300、H3004 など）
  maxSpeed: number;
  mobCollision: string; // 既定 "cancel"
  playerCollision: string; // 既定 "cancel"
  cars?: string; // 両数（"mmmm" など）
  stops: boolean[]; // entries と同じ長さ。先頭と末尾は true 固定
}

export type ChoiceOverride = 'include' | 'exclude';

export interface Overrides {
  /** rules §3.2：のりば単位の選択駅上書き。キーは `${stationId}#${platform}` */
  choice: Record<string, ChoiceOverride>;
  /** rules §3.3：各駅発の上書き。キーは `${serviceId}#${kindId}#${entryIndex}` */
  departure: Record<string, DepartureOverride>;
  /** rules §4.4：自動にできない skip 条件の手入力。キーは `${stationId}#${platform}` */
  skipCondition: Record<string, SkipConditionOverride>;
}

export interface DepartureOverride {
  enabled?: boolean; // false で外す、true で足す
  formation?: string; // 形式コードの上書き
  foreignName?: string; // 他団体の編成名をまるごと手入力
}

export interface SkipConditionOverride {
  line3: string;
  line4: string;
}

export interface ProgressItem {
  hash: string;
  doneAt: string;
}

export interface Progress {
  /** キーは作業項目の ID、値は完了時の内容ハッシュ */
  items: Record<string, ProgressItem>;
}

/** のりばを指すキー（上書き・カード ID に使う） */
export function platformKey(stationId: string, platform: number): string {
  return `${stationId}#${platform}`;
}

/** 各駅発の上書きキー */
export function departureKey(serviceId: string, kindId: string, entryIndex: number): string {
  return `${serviceId}#${kindId}#${entryIndex}`;
}
