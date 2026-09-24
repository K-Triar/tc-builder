import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../model';
import { createProject, EMPTY_PRESET, K_PRESET } from '../presets';
import { parseProject, serializeProject } from '../schema';

let seq = 0;
const env = {
  newId: () => `id-${++seq}`,
  now: () => new Date('2026-09-24T12:00:00.000Z'),
};

describe('K プリセット', () => {
  const p = createProject(K_PRESET, '瑠璃線', env);
  const self = p.orgs.find((o) => o.id === p.selfOrgId)!;

  it('団体 K が自団体', () => {
    expect(self).toMatchObject({ name: 'Kトライア', code: 'K' });
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
    expect(p.name).toBe('瑠璃線');
    expect(p.createdAt).toBe('2026-09-24T12:00:00.000Z');
  });

  it('路線コード L/B/Q/U/Y が自団体に属する', () => {
    expect(p.lines.map((l) => l.code)).toEqual(['L', 'B', 'Q', 'U', 'Y']);
    expect(p.lines.every((l) => l.orgId === self.id)).toBe(true);
  });

  it('種別コード Lo/Ra/SR/EX/ET/Te（特急は EX）', () => {
    expect(p.kinds.map((k) => k.typeCode)).toEqual(['Lo', 'Ra', 'SR', 'EX', 'ET', 'Te']);
  });

  it('用途番号と標準最高速度（rules §2.5）', () => {
    expect(p.settings.usages.map((u) => [u.digit, u.defaultMaxSpeed])).toEqual([
      ['1', 0.75],
      ['2', 1.5],
      ['3', 1.0],
      ['6', 1.5],
      ['7', 2.0],
      ['9', 0.5],
    ]);
  });

  it('看板の既定値は 1・5・5、ほかは空', () => {
    expect(p.settings).toMatchObject({
      spawnSpeed: 1,
      stationLaunchDistance: 5,
      stationDwellSeconds: 5,
    });
    expect(p.stations).toEqual([]);
    expect(p.services).toEqual([]);
    expect(p.overrides).toEqual({ choice: {}, departure: {}, skipCondition: {} });
    expect(p.progress).toEqual({ items: {} });
  });

  it('ID はすべて別', () => {
    const ids = [
      p.id,
      ...p.orgs.map((o) => o.id),
      ...p.lines.map((l) => l.id),
      ...p.kinds.map((k) => k.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('空プリセット', () => {
  it('名前とコードが空の自団体だけを持つ', () => {
    const p = createProject(EMPTY_PRESET, '新しい路線', env);
    expect(p.orgs).toEqual([{ id: p.selfOrgId, name: '', code: '' }]);
    expect(p.lines).toEqual([]);
    expect(p.kinds).toEqual([]);
    expect(p.settings.usages).toEqual([]);
  });
});

describe('スキーマの往復', () => {
  it.each([
    ['K', K_PRESET],
    ['空', EMPTY_PRESET],
  ])('%s プリセット：作る → JSON → parse → 同じ', (_, preset) => {
    const p = createProject(preset, 'テスト', env);
    const r = parseProject(serializeProject(p));
    expect(r).toEqual({ ok: true, project: p, migratedFrom: undefined });
  });
});
