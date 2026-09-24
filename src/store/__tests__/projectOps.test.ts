import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { departureKey, type Project } from '../../domain/model';
import { ProjectBuilder } from '../../domain/__tests__/builder';
import {
  insertEntry,
  moveEntry,
  removeEntry,
  removeService,
  removeServiceKind,
  renumberPlatform,
} from '../projectOps';

/** A B C D の4駅、2種別の系統 sv1 と、別の系統 sv2 */
function base(): Project {
  const b = new ProjectBuilder();
  b.station('A', ['KL01'], { 1: 'right' })
    .station('B', ['KL02'], { 1: 'right', 2: 'right' })
    .station('C', ['KL03'], { 1: 'right' })
    .station('D', ['KL04'], { 1: 'right' })
    .service(
      'x',
      'down',
      [
        ['KL01', 1],
        ['KL02', 1],
        ['KL03', 1],
        ['KL04', 1],
      ],
      [
        { tag: 'Lo', formation: 'K300' },
        { tag: 'Ra', formation: 'K302', pass: ['KL02'] },
      ],
    )
    .service(
      'y',
      'down',
      [
        ['KL01', 1],
        ['KL02', 1],
      ],
      [{ tag: 'Lo', formation: 'K300' }],
    );
  const p = b.build();
  // 系統 sv1 の各駅発の上書き（添字 1・2）と、sv2 の上書き（添字 0）
  p.overrides.departure[departureKey('sv1', 'kind-Lo', 1)] = { enabled: false };
  p.overrides.departure[departureKey('sv1', 'kind-Ra', 2)] = { formation: 'H3004' };
  p.overrides.departure[departureKey('sv2', 'kind-Lo', 0)] = { enabled: false };
  return p;
}

const sv1 = (p: Project) => p.services[0]!;
const stations = (p: Project) => sv1(p).entries.map((e) => e.stationId.slice(3));
const stops = (p: Project, k = 0) => sv1(p).kinds[k]!.stops;
const depKeys = (p: Project) => Object.keys(p.overrides.departure).sort();

describe('経由リストの挿入', () => {
  it('途中に入れると stops と上書きの添字がずれる', () => {
    const p = produce(base(), (d) =>
      insertEntry(d, 'sv1', 1, { stationId: 'st-KL02', platform: 2 }),
    );
    expect(stations(p)).toEqual(['KL01', 'KL02', 'KL02', 'KL03', 'KL04']);
    expect(stops(p, 0)).toEqual([true, false, true, true, true]);
    expect(stops(p, 1)).toEqual([true, false, false, true, true]);
    expect(depKeys(p)).toEqual(['sv1#kind-Lo#2', 'sv1#kind-Ra#3', 'sv2#kind-Lo#0']);
  });

  it('末尾に入れると新しい終点は停車、前の終点はそのまま', () => {
    const p = produce(base(), (d) =>
      insertEntry(d, 'sv1', 4, { stationId: 'st-KL01', platform: 1 }),
    );
    expect(stops(p, 1)).toEqual([true, false, true, true, true]);
  });

  it('先頭に入れると新しい始発は停車', () => {
    const p = produce(base(), (d) =>
      insertEntry(d, 'sv1', 0, { stationId: 'st-KL04', platform: 1 }),
    );
    expect(stops(p, 0)).toEqual([true, true, true, true, true]);
    expect(depKeys(p)).toEqual(['sv1#kind-Lo#2', 'sv1#kind-Ra#3', 'sv2#kind-Lo#0']);
  });
});

describe('経由リストの削除', () => {
  it('消した要素の上書きは消え、後ろはずれる', () => {
    const p = produce(base(), (d) => removeEntry(d, 'sv1', 1));
    expect(stations(p)).toEqual(['KL01', 'KL03', 'KL04']);
    expect(stops(p, 1)).toEqual([true, true, true]);
    expect(depKeys(p)).toEqual(['sv1#kind-Ra#1', 'sv2#kind-Lo#0']);
  });

  it('終点を消すと、新しい終点は停車になる', () => {
    const p = produce(base(), (d) => {
      sv1(d).kinds[1]!.stops[2] = false;
      removeEntry(d, 'sv1', 3);
    });
    expect(stops(p, 1)).toEqual([true, false, true]);
  });
});

describe('経由リストの並べ替え', () => {
  it('stops と上書きが要素と一緒に動く', () => {
    const p = produce(base(), (d) => moveEntry(d, 'sv1', 1, 2));
    expect(stations(p)).toEqual(['KL01', 'KL03', 'KL02', 'KL04']);
    expect(stops(p, 1)).toEqual([true, true, false, true]);
    expect(depKeys(p)).toEqual(['sv1#kind-Lo#2', 'sv1#kind-Ra#1', 'sv2#kind-Lo#0']);
  });

  it('端に動かすと始発・終点は停車', () => {
    const p = produce(base(), (d) => moveEntry(d, 'sv1', 1, 3));
    expect(stations(p)).toEqual(['KL01', 'KL03', 'KL04', 'KL02']);
    expect(stops(p, 1)).toEqual([true, true, true, true]);
  });

  it('範囲外は何もしない', () => {
    const before = base();
    const p = produce(before, (d) => moveEntry(d, 'sv1', 1, 9));
    expect(p).toBe(before);
  });
});

describe('系統・種別の削除', () => {
  it('系統を消すと、その系統の各駅発の上書きも消える', () => {
    const p = produce(base(), (d) => removeService(d, 'sv1'));
    expect(p.services.map((s) => s.id)).toEqual(['sv2']);
    expect(depKeys(p)).toEqual(['sv2#kind-Lo#0']);
  });

  it('系統から種別を外すと、その種別の上書きも消える', () => {
    const p = produce(base(), (d) => removeServiceKind(d, 'sv1', 'kind-Ra'));
    expect(sv1(p).kinds.map((k) => k.kindId)).toEqual(['kind-Lo']);
    expect(depKeys(p)).toEqual(['sv1#kind-Lo#1', 'sv2#kind-Lo#0']);
  });
});

describe('のりば番号の変更', () => {
  it('系統の経由リストと、のりば単位の上書きキーも付け替える', () => {
    const start = produce(base(), (d) => {
      d.overrides.choice['st-KL02#2'] = 'include';
      d.overrides.skipCondition['st-KL02#2'] = { line3: 't@X', line4: '' };
      sv1(d).entries[1]!.platform = 2;
    });
    const p = produce(start, (d) => renumberPlatform(d, 'st-KL02', 2, 5));
    expect(p.stations[1]!.platforms.map((x) => x.number)).toEqual([1, 5]);
    expect(sv1(p).entries[1]!.platform).toBe(5);
    expect(p.services[1]!.entries[1]!.platform).toBe(1);
    expect(p.overrides.choice).toEqual({ 'st-KL02#5': 'include' });
    expect(Object.keys(p.overrides.skipCondition)).toEqual(['st-KL02#5']);
  });

  it('使われている番号には変えない', () => {
    const before = base();
    expect(() => produce(before, (d) => renumberPlatform(d, 'st-KL02', 2, 1))).toThrow();
  });
});
