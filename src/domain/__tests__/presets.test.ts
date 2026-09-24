import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../model';
import {
  COMPANIES,
  companyByCode,
  createGuidedProject,
  createProject,
  customCompany,
  DEFAULT_KIND_CODES,
  KT_KINDS,
  KT_USAGES,
} from '../presets';
import { parseProject, serializeProject } from '../schema';

let seq = 0;
const env = {
  newId: () => `id-${++seq}`,
  now: () => new Date('2026-09-24T12:00:00.000Z'),
};

describe('Kトライアを選んだとき', () => {
  const p = createProject(companyByCode('K'), '瑠璃線', env);
  const self = p.orgs.find((o) => o.id === p.selfOrgId)!;

  it('鉄道会社 K が自分の鉄道会社', () => {
    expect(self).toMatchObject({ name: 'Kトライア', code: 'K' });
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
    expect(p.name).toBe('瑠璃線');
    expect(p.createdAt).toBe('2026-09-24T12:00:00.000Z');
  });

  it('路線コード L/B/Q/U/Y が自分の鉄道会社に属する', () => {
    expect(p.lines.map((l) => l.code)).toEqual(['L', 'B', 'Q', 'U', 'Y']);
    expect(p.lines.every((l) => l.orgId === self.id)).toBe(true);
  });

  it('種別は Lo/Ra/SR/EX を最初から選んでおく（貨物 Fg・路面電車 Tm・試運転 Te は入れない。臨時はない）', () => {
    expect(p.kinds.map((k) => k.typeCode)).toEqual(['Lo', 'Ra', 'SR', 'EX']);
    expect(KT_KINDS.map((k) => k.typeCode)).toEqual(['Lo', 'Ra', 'SR', 'EX', 'Fg', 'Tm', 'Te']);
    expect(KT_KINDS.find((k) => k.typeCode === 'SR')?.name).toBe('特別快速');
  });

  it('用途番号と標準最高速度（rules §2.5）', () => {
    expect(p.settings.usages.map((u) => [u.digit, u.defaultMaxSpeed])).toEqual([
      ['1', 0.75],
      ['2', 1.5],
      ['3', 1.0],
      ['6', 1.5],
      ['8', 2.0],
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

describe('鉄道会社の一覧（Wiki の KT式 団体コード表）', () => {
  it('10社。省略コードは重なりがなく、半角英数字だけ', () => {
    expect(COMPANIES.map((c) => c.code)).toEqual([
      'K',
      'C',
      'D',
      'E',
      'H',
      'J',
      'S',
      'T',
      'Y',
      'SU',
    ]);
    expect(COMPANIES.every((c) => /^[A-Za-z0-9]+$/.test(c.code))).toBe(true);
  });

  it('K 以外の会社を選ぶと、その会社が自分の鉄道会社になり、路線は空、種別と用途番号は KT式 の共通値', () => {
    const p = createProject(companyByCode('H'), 'ヘルヴェティア線', env);
    expect(p.orgs).toEqual([{ id: p.selfOrgId, name: 'ヘルヴェティア鉄道局', code: 'H' }]);
    expect(p.lines).toEqual([]);
    expect(p.kinds.map((k) => k.typeCode)).toEqual(DEFAULT_KIND_CODES);
    expect(p.settings.usages).toEqual(KT_USAGES);
  });

  it('一覧にない鉄道会社は名前とコードを入れたものが自分の鉄道会社になる', () => {
    const p = createProject(customCompany('新鉄道', 'N'), '新線', env);
    expect(p.orgs).toEqual([{ id: p.selfOrgId, name: '新鉄道', code: 'N' }]);
    expect(p.lines).toEqual([]);
    expect(p.kinds).toHaveLength(DEFAULT_KIND_CODES.length);
  });

  it('一覧にないコードで探すと例外', () => {
    expect(() => companyByCode('ZZ')).toThrow();
  });
});

describe('はじめての質問（集中モード）で作るとき', () => {
  it('名前と鉄道会社は空、最初の質問（名前）から始める', () => {
    const p = createGuidedProject(env);
    expect(p.name).toBe('');
    expect(p.orgs).toEqual([{ id: p.selfOrgId, name: '', code: '' }]);
    expect(p.lines).toEqual([]);
    expect(p.kinds.map((k) => k.typeCode)).toEqual(DEFAULT_KIND_CODES);
    expect(p.guide).toEqual({ at: 'name' });
    expect(parseProject(serializeProject(p))).toEqual({
      ok: true,
      project: p,
      migratedFrom: undefined,
    });
  });
});

describe('スキーマの往復', () => {
  it.each([
    ['Kトライア', companyByCode('K')],
    ['一覧にない鉄道会社', customCompany()],
  ])('%s：作る → JSON → parse → 同じ', (_, preset) => {
    const p = createProject(preset, 'テスト', env);
    const r = parseProject(serializeProject(p));
    expect(r).toEqual({ ok: true, project: p, migratedFrom: undefined });
  });
});
