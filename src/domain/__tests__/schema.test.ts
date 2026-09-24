import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type Project } from '../model';
import { migrateWith, parseProject, serializeProject } from '../schema';

/** 2駅・1種別の小さなプロジェクト */
function smallProject(): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'p1',
    name: 'テスト路線',
    createdAt: '2026-09-24T00:00:00.000Z',
    updatedAt: '2026-09-24T00:00:00.000Z',
    selfOrgId: 'o-k',
    settings: {
      spawnSpeed: 1,
      stationLaunchDistance: 5,
      stationDwellSeconds: 5,
      usages: [{ digit: '3', label: '在来線標準型・普通快速', defaultMaxSpeed: 1 }],
    },
    orgs: [{ id: 'o-k', name: 'Kトライア', code: 'K' }],
    lines: [{ id: 'l-l', orgId: 'o-k', code: 'L', name: '瑠璃本線' }],
    kinds: [{ id: 'k-lo', typeCode: 'Lo', name: '普通' }],
    stations: [
      {
        id: 's1',
        name: 'アカシア島',
        managerOrgId: 'o-k',
        signsBySelf: true,
        codes: [{ id: 'c1', code: { kind: 'numbered', orgId: 'o-k', lineId: 'l-l', number: 1 } }],
        platforms: [{ number: 1, codeId: 'c1', dir: 'right', deadEnd: false }],
      },
      {
        id: 's2',
        name: 'オット',
        managerOrgId: 'o-k',
        signsBySelf: true,
        codes: [{ id: 'c2', code: { kind: 'numbered', orgId: 'o-k', lineId: 'l-l', number: 2 } }],
        platforms: [{ number: 1, codeId: 'c2', dir: 'right', deadEnd: false, label: '下り' }],
      },
    ],
    services: [
      {
        id: 'v1',
        name: '瑠璃線 下り',
        direction: 'down',
        entries: [
          { stationId: 's1', platform: 1 },
          { stationId: 's2', platform: 1 },
        ],
        kinds: [
          {
            kindId: 'k-lo',
            formation: 'K300',
            maxSpeed: 1,
            mobCollision: 'cancel',
            playerCollision: 'cancel',
            cars: 'mmmm',
            stops: [true, true],
          },
        ],
      },
    ],
    overrides: { choice: { 's2#1': 'include' }, departure: {}, skipCondition: {} },
    progress: { items: {} },
  };
}

function expectErrors(input: unknown): string[] {
  const r = parseProject(input);
  if (r.ok) throw new Error('エラーになるはずが通った');
  return r.errors;
}

describe('parseProject', () => {
  it('正しいプロジェクトはそのまま通る（書き出し → 読み込みで同じ）', () => {
    const p = smallProject();
    const r = parseProject(serializeProject(p));
    expect(r).toEqual({ ok: true, project: p, migratedFrom: undefined });
  });

  it('オブジェクトのままでも受け付ける', () => {
    const r = parseProject(smallProject());
    expect(r.ok).toBe(true);
  });

  it('JSON として読めない文字列は日本語のエラー', () => {
    expect(expectErrors('{ 壊れた')).toEqual([
      'ファイルを JSON として読めませんでした。.ktc.json ファイルを選んでください。',
    ]);
  });

  it('プロジェクトファイルでないものは拒否する', () => {
    expect(expectErrors([1, 2])[0]).toContain('プロジェクトファイルではありません');
    expect(expectErrors({ foo: 1 })[0]).toContain('プロジェクトファイルではありません');
  });

  it('新しい版のファイルは拒否する', () => {
    const raw = { ...smallProject(), schemaVersion: SCHEMA_VERSION + 1 };
    expect(expectErrors(raw)[0]).toContain(`版 ${SCHEMA_VERSION + 1}`);
  });

  it('型の違いを日本語の場所つきで示す', () => {
    const p = smallProject() as unknown as { stations: { platforms: { dir: unknown }[] }[] };
    p.stations[1]!.platforms[0]!.dir = 'up';
    const errors = expectErrors(p);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(
      '駅 2 番目 › のりば 1 番目 › 進む向き：「right」「left」のどれかにしてください',
    );
  });

  it('必須項目の欠けを示す', () => {
    const p = smallProject() as unknown as Record<string, unknown>;
    delete p.name;
    expect(expectErrors(p)).toEqual(['プロジェクト名：必須です（文字列）']);
  });

  it('停車の数が経由リストと合わなければエラー', () => {
    const p = smallProject();
    p.services[0]!.kinds[0]!.stops = [true];
    expect(expectErrors(p)).toEqual([
      '列車の走り方 1 番目 › 種別 1 番目 › 停車：経由リストと同じ数（2）にしてください',
    ]);
  });

  it('存在しない ID を参照していればエラー', () => {
    const p = smallProject();
    p.selfOrgId = 'nope';
    p.services[0]!.entries[1]!.stationId = 'nope';
    p.services[0]!.kinds[0]!.kindId = 'nope';
    p.stations[0]!.platforms[0]!.codeId = 'nope';
    expect(expectErrors(p)).toEqual([
      '自分の鉄道会社：鉄道会社の一覧にない ID「nope」です',
      '駅 1 番目 › のりば 1 番目 › 行先コードに使う駅コード：この駅の駅コードにない ID「nope」です',
      '列車の走り方 1 番目 › 経由リスト 2 番目 › 駅：駅の一覧にない ID「nope」です',
      '列車の走り方 1 番目 › 種別 1 番目 › 種別：種別の一覧にない ID「nope」です',
    ]);
  });

  it('同じ駅に同じのりば番号が2つあればエラー', () => {
    const p = smallProject();
    p.stations[0]!.platforms.push({ number: 1, codeId: 'c1', dir: 'left', deadEnd: false });
    expect(expectErrors(p)).toEqual([
      '駅 1 番目 › のりば 2 番目 › 番号：のりば番号 1 が重複しています',
    ]);
  });

  it('知らない項目は読み飛ばす', () => {
    const raw = { ...smallProject(), extra: 'x' };
    const r = parseProject(raw);
    expect(r.ok && 'extra' in r.project).toBe(false);
  });
});

describe('migrateWith（マイグレーションの枠）', () => {
  it('古い版から順に変換して最新版にする', () => {
    const migrations = {
      1: (p: Record<string, unknown>) => ({ ...p, a: 1, schemaVersion: 2 }),
      2: (p: Record<string, unknown>) => ({ ...p, b: 2, schemaVersion: 3 }),
    };
    expect(migrateWith({ schemaVersion: 1 }, migrations, 3)).toEqual({
      schemaVersion: 3,
      a: 1,
      b: 2,
    });
  });

  it('変換がない版は例外', () => {
    expect(() => migrateWith({ schemaVersion: 1 }, {}, 2)).toThrow();
  });
});

describe('版 1 → 版 2（集中モードの状態 guide）', () => {
  it('版 1 のファイルは guide なし（答え終わったもの）として読める', () => {
    const raw = { ...smallProject(), schemaVersion: 1 };
    const r = parseProject(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migratedFrom).toBe(1);
    expect(r.project.schemaVersion).toBe(2);
    expect(r.project.guide).toBeUndefined();
  });

  it('集中モードの途中のファイルは guide を持ったまま読める', () => {
    const p = { ...smallProject(), guide: { at: 'lines', through: 'no' as const } };
    const r = parseProject(serializeProject(p));
    expect(r.ok && r.project.guide).toEqual({ at: 'lines', through: 'no' });
  });
});
