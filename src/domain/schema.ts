// プロジェクトファイル（.ktc.json）の検証とマイグレーション（design §7）。
// スキーマを変えたら SCHEMA_VERSION を上げ、MIGRATIONS に変換を足し、古い版を読むテストを追加する。

import { z } from 'zod';
import { SCHEMA_VERSION, type Project } from './model';

const usageSchema = z.object({
  digit: z.string(),
  label: z.string(),
  defaultMaxSpeed: z.number(),
});

const settingsSchema = z.object({
  spawnSpeed: z.number(),
  stationLaunchDistance: z.number(),
  stationDwellSeconds: z.number(),
  usages: z.array(usageSchema),
});

const orgSchema = z.object({ id: z.string(), name: z.string(), code: z.string() });

const lineSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  code: z.string(),
  name: z.string(),
});

const kindSchema = z.object({
  id: z.string(),
  typeCode: z.string(),
  trainNameCode: z.string().optional(),
  name: z.string(),
});

const stationCodeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('numbered'),
    orgId: z.string(),
    lineId: z.string(),
    number: z.int().min(0),
  }),
  z.object({ kind: z.literal('free'), value: z.string() }),
]);

const dirSchema = z.enum(['right', 'left']);

const platformSchema = z.object({
  number: z.int().min(1),
  codeId: z.string(),
  label: z.string().optional(),
  dir: dirSchema.optional(),
  deadEnd: z.boolean(),
  params: z
    .object({
      spawnSpeed: z.number().optional(),
      stationLaunchDistance: z.number().optional(),
      stationDwellSeconds: z.number().optional(),
    })
    .optional(),
});

const stationSchema = z.object({
  id: z.string(),
  name: z.string(),
  managerOrgId: z.string(),
  signsBySelf: z.boolean(),
  codes: z.array(z.object({ id: z.string(), code: stationCodeSchema })),
  platforms: z.array(platformSchema),
});

const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  direction: z.enum(['up', 'down']),
  throughNote: z.string().optional(),
  entries: z.array(z.object({ stationId: z.string(), platform: z.int().min(1).nullable() })),
  kinds: z.array(
    z.object({
      kindId: z.string(),
      formation: z.string(),
      maxSpeed: z.number(),
      mobCollision: z.string(),
      playerCollision: z.string(),
      cars: z.string().optional(),
      stops: z.array(z.boolean()),
    }),
  ),
});

const overridesSchema = z.object({
  choice: z.record(z.string(), z.enum(['include', 'exclude'])),
  departure: z.record(
    z.string(),
    z.object({
      enabled: z.boolean().optional(),
      formation: z.string().optional(),
      foreignName: z.string().optional(),
    }),
  ),
  skipCondition: z.record(z.string(), z.object({ line3: z.string(), line4: z.string() })),
});

const progressSchema = z.object({
  items: z.record(z.string(), z.object({ hash: z.string(), doneAt: z.string() })),
});

export const projectSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastExportedAt: z.string().optional(),
  selfOrgId: z.string(),
  settings: settingsSchema,
  orgs: z.array(orgSchema),
  lines: z.array(lineSchema),
  kinds: z.array(kindSchema),
  stations: z.array(stationSchema),
  services: z.array(serviceSchema),
  overrides: overridesSchema,
  progress: progressSchema,
  guide: z
    .object({
      at: z.string(),
      through: z.enum(['yes', 'no', 'unknown']).optional(),
      named: z.boolean().optional(),
    })
    .optional(),
});

// ---- マイグレーション ----

type RawProject = Record<string, unknown>;
/** キー n は「版 n → 版 n+1」の変換 */
export type Migrations = Record<number, (raw: RawProject) => RawProject>;

const MIGRATIONS: Migrations = {
  // 版 2 で集中モードの状態（guide）を足した。古いプロジェクトは答え終わったものとして扱う
  1: (raw) => ({ ...raw, schemaVersion: 2 }),
};

/** raw.schemaVersion から target まで順に変換する。変換が足りなければ例外 */
export function migrateWith(raw: RawProject, migrations: Migrations, target: number): RawProject {
  let current = raw;
  let version = Number(current.schemaVersion);
  while (version < target) {
    const step = migrations[version];
    if (!step) throw new Error(`版 ${version} から ${version + 1} への変換がありません`);
    current = step(current);
    version += 1;
  }
  return current;
}

export function migrate(raw: RawProject): RawProject {
  return migrateWith(raw, MIGRATIONS, SCHEMA_VERSION);
}

// ---- 読み込み ----

export type ParseResult =
  | { ok: true; project: Project; migratedFrom: number | undefined }
  | { ok: false; errors: string[] };

const NOT_PROJECT = 'KT式 TC ビルダーのプロジェクトファイルではありません（版番号がありません）。';

/** .ktc.json の中身（文字列または JSON.parse 済みの値）を検証して Project にする */
export function parseProject(input: unknown): ParseResult {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return fail('ファイルを JSON として読めませんでした。.ktc.json ファイルを選んでください。');
    }
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return fail(NOT_PROJECT);
  const version = (raw as RawProject).schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return fail(NOT_PROJECT);
  }
  if (version > SCHEMA_VERSION) {
    return fail(
      `このファイルは新しい版 ${version} のツールで作られています（このツールは版 ${SCHEMA_VERSION} まで）。ページを再読み込みしてツールを更新してください。`,
    );
  }

  let migrated: RawProject;
  try {
    migrated = migrate(raw as RawProject);
  } catch (e) {
    return fail(`古い版のファイルを変換できませんでした：${(e as Error).message}`);
  }

  const result = projectSchema.safeParse(migrated);
  if (!result.success) {
    return { ok: false, errors: result.error.issues.map(formatIssue) };
  }
  const project: Project = result.data;
  const refErrors = checkReferences(project);
  if (refErrors.length > 0) return { ok: false, errors: refErrors };
  return { ok: true, project, migratedFrom: version < SCHEMA_VERSION ? version : undefined };
}

/** 書き出し用の整形済み JSON */
export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2) + '\n';
}

function fail(message: string): ParseResult {
  return { ok: false, errors: [message] };
}

// ---- 参照の整合性（構造は正しいが中身がつながっていないファイルを拒否する） ----

type Path = (string | number)[];

function checkReferences(p: Project): string[] {
  const errors: string[] = [];
  const add = (path: Path, message: string) => errors.push(`${formatPath(path)}：${message}`);

  const orgIds = new Set(p.orgs.map((o) => o.id));
  const lineIds = new Set(p.lines.map((l) => l.id));
  const kindIds = new Set(p.kinds.map((k) => k.id));
  const stationIds = new Set(p.stations.map((s) => s.id));

  const missing = (listName: string, id: string) => `${listName}にない ID「${id}」です`;

  checkUnique(p.orgs, ['orgs'], add);
  checkUnique(p.lines, ['lines'], add);
  checkUnique(p.kinds, ['kinds'], add);
  checkUnique(p.stations, ['stations'], add);
  checkUnique(p.services, ['services'], add);

  if (!orgIds.has(p.selfOrgId)) add(['selfOrgId'], missing('鉄道会社の一覧', p.selfOrgId));
  p.lines.forEach((l, i) => {
    if (!orgIds.has(l.orgId)) add(['lines', i, 'orgId'], missing('鉄道会社の一覧', l.orgId));
  });

  p.stations.forEach((s, si) => {
    if (!orgIds.has(s.managerOrgId)) {
      add(['stations', si, 'managerOrgId'], missing('鉄道会社の一覧', s.managerOrgId));
    }
    checkUnique(s.codes, ['stations', si, 'codes'], add);
    s.codes.forEach(({ code }, ci) => {
      if (code.kind !== 'numbered') return;
      if (!orgIds.has(code.orgId)) {
        add(['stations', si, 'codes', ci, 'code', 'orgId'], missing('鉄道会社の一覧', code.orgId));
      }
      if (!lineIds.has(code.lineId)) {
        add(['stations', si, 'codes', ci, 'code', 'lineId'], missing('路線の一覧', code.lineId));
      }
    });
    const codeIds = new Set(s.codes.map((c) => c.id));
    const seen = new Set<number>();
    s.platforms.forEach((pf, pi) => {
      if (seen.has(pf.number)) {
        add(
          ['stations', si, 'platforms', pi, 'number'],
          `のりば番号 ${pf.number} が重複しています`,
        );
      }
      seen.add(pf.number);
      if (!codeIds.has(pf.codeId)) {
        add(['stations', si, 'platforms', pi, 'codeId'], missing('この駅の駅コード', pf.codeId));
      }
    });
  });

  p.services.forEach((v, vi) => {
    v.entries.forEach((e, ei) => {
      if (!stationIds.has(e.stationId)) {
        add(['services', vi, 'entries', ei, 'stationId'], missing('駅の一覧', e.stationId));
      }
    });
    v.kinds.forEach((k, ki) => {
      if (!kindIds.has(k.kindId))
        add(['services', vi, 'kinds', ki, 'kindId'], missing('種別の一覧', k.kindId));
      if (k.stops.length !== v.entries.length) {
        add(
          ['services', vi, 'kinds', ki, 'stops'],
          `経由リストと同じ数（${v.entries.length}）にしてください`,
        );
      }
    });
  });

  return errors;
}

function checkUnique(
  items: { id: string }[],
  path: Path,
  add: (path: Path, message: string) => void,
): void {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    if (seen.has(item.id)) add([...path, i, 'id'], `ID「${item.id}」が重複しています`);
    seen.add(item.id);
  });
}

// ---- エラーメッセージの日本語化 ----

/** 配列の要素につける名前（「駅 2 番目」） */
const COLLECTION_LABELS: Record<string, string> = {
  orgs: '鉄道会社',
  lines: '路線',
  kinds: '種別',
  stations: '駅',
  platforms: 'のりば',
  codes: '駅コード',
  services: '系統',
  entries: '経由リスト',
  stops: '停車',
  usages: '用途番号',
};

const FIELD_LABELS: Record<string, string> = {
  schemaVersion: '版番号',
  id: 'ID',
  name: '名前',
  createdAt: '作成日時',
  updatedAt: '更新日時',
  lastExportedAt: '書き出し日時',
  selfOrgId: '自分の鉄道会社',
  settings: '設定',
  spawnSpeed: 'spawn の初速',
  stationLaunchDistance: 'station の加速距離',
  stationDwellSeconds: '停車秒数',
  digit: '用途番号',
  label: '表示名',
  defaultMaxSpeed: '標準最高速度',
  code: 'コード',
  orgId: '鉄道会社',
  lineId: '路線',
  typeCode: '種別コード',
  trainNameCode: '列車名コード',
  managerOrgId: '管理する鉄道会社',
  signsBySelf: '看板を自分で置くか',
  kind: '種類',
  value: '値',
  number: '番号',
  codeId: '行先コードに使う駅コード',
  dir: '進む向き',
  deadEnd: '行き止まり',
  params: 'のりばごとの設定',
  direction: '方向',
  throughNote: '直通先',
  stationId: '駅',
  platform: 'のりば',
  kindId: '種別',
  formation: '形式コード',
  maxSpeed: '最高速度',
  mobCollision: 'mob 衝突',
  playerCollision: 'プレイヤー衝突',
  cars: '両数',
  overrides: '上書き',
  choice: '選択駅の上書き',
  departure: '各駅発の上書き',
  skipCondition: 'skip 条件の手入力',
  enabled: '有効',
  foreignName: '他の鉄道会社の編成名',
  line3: '3行目',
  line4: '4行目',
  progress: '進捗',
  items: '項目',
  hash: 'ハッシュ',
  doneAt: '完了日時',
  guide: 'はじめての質問',
  at: '開いていた質問',
  through: '乗り入れ',
  named: '名前付き列車',
};

export function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return 'ファイル全体';
  if (path.length === 1 && path[0] === 'name') return 'プロジェクト名';
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const next = path[i + 1];
    if (typeof key === 'string' && typeof next === 'number' && key in COLLECTION_LABELS) {
      parts.push(`${COLLECTION_LABELS[key]} ${next + 1} 番目`);
      i++;
    } else if (typeof key === 'string') {
      parts.push(FIELD_LABELS[key] ?? COLLECTION_LABELS[key] ?? `「${key}」`);
    } else {
      parts.push(`${String(key)}`);
    }
  }
  return parts.join(' › ');
}

const TYPE_LABELS: Record<string, string> = {
  string: '文字列',
  number: '数値',
  int: '整数',
  boolean: 'true / false',
  array: '一覧（配列）',
  object: 'まとまり（オブジェクト）',
  record: 'まとまり（オブジェクト）',
};

function formatIssue(issue: z.core.$ZodIssue): string {
  return `${formatPath(issue.path)}：${issueMessage(issue)}`;
}

function issueMessage(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type': {
      const type = TYPE_LABELS[issue.expected] ?? issue.expected;
      return issue.input === undefined ? `必須です（${type}）` : `${type}にしてください`;
    }
    case 'invalid_value':
      return `${issue.values.map((v) => `「${String(v)}」`).join('')}のどれかにしてください`;
    case 'too_small':
      return `${String(issue.minimum)} 以上にしてください`;
    case 'too_big':
      return `${String(issue.maximum)} 以下にしてください`;
    case 'invalid_union':
      return '形式が正しくありません';
    default:
      return `正しくありません（${issue.code}）`;
  }
}
