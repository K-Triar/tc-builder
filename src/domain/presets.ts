// 団体プリセット（requirements R2.1）と新しいプロジェクトの作成。

import { SCHEMA_VERSION, type Project, type Usage } from './model';

export interface Preset {
  id: 'K' | 'empty';
  label: string;
  org: { name: string; code: string };
  lines: { code: string; name: string }[];
  kinds: { typeCode: string; name: string }[];
  usages: Usage[];
}

export const K_PRESET: Preset = {
  id: 'K',
  label: 'Kトライア',
  org: { name: 'Kトライア', code: 'K' },
  lines: [
    { code: 'L', name: '瑠璃本線' },
    { code: 'B', name: '貿易港線' },
    { code: 'Q', name: '地下鉄交易所線' },
    { code: 'U', name: '地下鉄中央線' },
    { code: 'Y', name: '富士有徳線' },
  ],
  kinds: [
    { typeCode: 'Lo', name: '普通' },
    { typeCode: 'Ra', name: '快速' },
    { typeCode: 'SR', name: '特別快速（新快速）' },
    { typeCode: 'EX', name: '特急' },
    { typeCode: 'ET', name: '臨時' },
    { typeCode: 'Te', name: '試運転' },
  ],
  usages: [
    { digit: '1', label: '路面電車型', defaultMaxSpeed: 0.75 },
    { digit: '2', label: '在来線標準型・新快速', defaultMaxSpeed: 1.5 },
    { digit: '3', label: '在来線標準型・普通快速', defaultMaxSpeed: 1.0 },
    { digit: '6', label: '貨物', defaultMaxSpeed: 1.5 },
    { digit: '7', label: '特急', defaultMaxSpeed: 2.0 },
    { digit: '9', label: '試験・事業用', defaultMaxSpeed: 0.5 },
  ],
};

export const EMPTY_PRESET: Preset = {
  id: 'empty',
  label: '空の団体（自分で入力する）',
  org: { name: '', code: '' },
  lines: [],
  kinds: [],
  usages: [],
};

export const PRESETS: readonly Preset[] = [K_PRESET, EMPTY_PRESET];

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

export function createProject(preset: Preset, name: string, env: CreateEnv = defaultEnv): Project {
  const now = env.now().toISOString();
  const selfOrgId = env.newId();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: env.newId(),
    name,
    createdAt: now,
    updatedAt: now,
    selfOrgId,
    settings: { ...DEFAULT_SETTINGS, usages: preset.usages.map((u) => ({ ...u })) },
    orgs: [{ id: selfOrgId, ...preset.org }],
    lines: preset.lines.map((l) => ({ id: env.newId(), orgId: selfOrgId, ...l })),
    kinds: preset.kinds.map((k) => ({ id: env.newId(), ...k })),
    stations: [],
    services: [],
    overrides: { choice: {}, departure: {}, skipCondition: {} },
    progress: { items: {} },
  };
}
