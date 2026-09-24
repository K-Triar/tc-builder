import { describe, expect, it } from 'vitest';
import { departureKey } from '../model';
import { computeRoutes } from '../routes';
import { ProjectBuilder, ruriDown } from './builder';

function departuresAt(r: ReturnType<typeof computeRoutes>, stationId: string, serviceId: string) {
  return r.departures.filter((d) => d.stationId === stationId && d.serviceId === serviceId);
}

describe('経路と編成（rules §3.3〜3.5）', () => {
  const b = ruriDown();
  const p = b.build();
  const r = computeRoutes(p);

  it('T1：瑠璃線普通、発駅 アカシア島', () => {
    const [lo] = departuresAt(r, b.stationId('KL01'), 'sv1');
    expect(lo).toMatchObject({
      platform: 1,
      kindId: 'kind-Lo',
      route: ['KL04-2', 'KL05-6', 'KL10-1', 'KL13-2'],
      routeCode: 'KL4L13',
      formationCode: 'K300_KL4L13_Lo',
      foreign: false,
    });
  });

  it('T2：同、発駅 瑠璃中央', () => {
    const [lo] = departuresAt(r, b.stationId('KL04'), 'sv1');
    expect(lo).toMatchObject({ routeCode: 'KL5L13', formationCode: 'K300_KL5L13_Lo' });
  });

  it('T3：中央線新快速 西水中央行、発駅 二労', () => {
    const [sr] = departuresAt(r, b.stationId('KU06'), 'sv3');
    expect(sr).toMatchObject({
      platform: 2,
      route: ['KL04-3', 'KL05-5', 'KB01-3', 'KB02-3', 'NSC-2'],
      formationCode: 'K200_KL4NSC_SR-LSR',
    });
  });

  it('発駅は停車する経由要素だけ（終点は除く）', () => {
    const lo = r.departures.filter((d) => d.serviceId === 'sv1' && d.kindId === 'kind-Lo');
    expect(lo.map((d) => d.entryIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const ra = r.departures.filter((d) => d.serviceId === 'sv1' && d.kindId === 'kind-Ra');
    expect(ra.map((d) => d.entryIndex)).toEqual([0, 1, 4, 5, 7, 9, 10, 12]);
  });

  it('のりば未定の駅は発駅にならない', () => {
    expect(r.departures.some((d) => d.stationId === b.stationId('QUL'))).toBe(false);
  });

  it('同じ編成コードは1つにまとめる', () => {
    const f = r.formations.find((x) => x.code === 'K300_KL4L13_Lo')!;
    expect(f).toMatchObject({
      formation: 'K300',
      routeCode: 'KL4L13',
      route: ['KL04-2', 'KL05-6', 'KL10-1', 'KL13-2'],
      tag: 'Lo',
      maxSpeed: 1,
      mobCollision: 'cancel',
      playerCollision: 'cancel',
      foreign: false,
    });
    // アカシア島・オット・瑠前TT から出る
    expect(f.departures.map((d) => d.stationId)).toEqual([
      b.stationId('KL01'),
      b.stationId('KL02'),
      b.stationId('KL03'),
    ]);
    expect(new Set(r.formations.map((x) => x.code)).size).toBe(r.formations.length);
  });

  it('同じ中身の経路は系統をまたいで1つにまとめる（KL4NSC）', () => {
    const route = r.routes.find((x) => x.code === 'KL4NSC')!;
    expect(route.dests).toEqual(['KL04-3', 'KL05-5', 'KB01-3', 'KB02-3', 'NSC-2']);
    expect(route.usedBy).toEqual(['K302_KL4NSC_Ra', 'K200_KL4NSC_SR-LSR']);
    expect(new Set(r.routes.map((x) => x.code)).size).toBe(r.routes.length);
    expect(r.routeConflicts).toEqual([]);
    expect(r.formationConflicts).toEqual([]);
  });

  it('選択駅の上書きは経路に反映される（KL10 2番を入れる例と同じ仕組み）', () => {
    const p2 = ruriDown().include('KL11', 1).build();
    const [lo] = departuresAt(computeRoutes(p2), 'st-KL10', 'sv1');
    expect(lo!.routeCode).toBe('KL11L13');
    expect(lo!.route).toEqual(['KL11-1', 'KL13-2']);
  });
});

describe('各駅発の上書き', () => {
  it('外す・形式を変える・他団体の編成名を入れる', () => {
    const b = ruriDown();
    const p = b.build();
    p.overrides.departure[departureKey('sv1', 'kind-Lo', 2)] = { enabled: false };
    p.overrides.departure[departureKey('sv1', 'kind-Lo', 3)] = { formation: 'H3004' };
    p.overrides.departure[departureKey('sv3', 'kind-SR-LSR', 0)] = { foreignName: 'H2006_X' };
    const r = computeRoutes(p);

    expect(departuresAt(r, b.stationId('KL02'), 'sv1').map((d) => d.kindId)).toEqual([]);
    const [kl03] = departuresAt(r, b.stationId('KL03'), 'sv1');
    expect(kl03).toMatchObject({
      formationCode: 'H3004_KL4L13_Lo',
      overridden: true,
      foreign: false,
    });
    const [ku06] = departuresAt(r, b.stationId('KU06'), 'sv3');
    expect(ku06).toMatchObject({ formationCode: 'H2006_X', overridden: true, foreign: true });
    expect(r.formations.find((f) => f.code === 'H2006_X')).toMatchObject({ foreign: true });
    // 経路は他団体の編成でも一覧に残る
    expect(r.routes.find((x) => x.code === 'KL4NSC')!.usedBy).toContain('H2006_X');
  });

  it('停車しない駅は ON にしても発駅にならない', () => {
    const p = ruriDown().build();
    p.overrides.departure[departureKey('sv1', 'kind-Ra', 2)] = { enabled: true };
    const r = computeRoutes(p);
    expect(r.departures.some((d) => d.kindId === 'kind-Ra' && d.entryIndex === 2)).toBe(false);
  });

  it('他団体が看板を置く駅の編成は、名前が未入力なら要確認（コードなし）', () => {
    const b = new ProjectBuilder();
    b.station('西水中央', ['NSC'], { 1: 'right' }, { org: 'H' })
      .station('南瑠順', ['KB02'], { 1: 'right' })
      .service(
        '上り',
        'up',
        [
          ['NSC', 1],
          ['KB02', 1],
        ],
        [{ tag: 'Ra', formation: 'K303' }],
      );
    const r = computeRoutes(b.build());
    expect(r.departures).toHaveLength(1);
    expect(r.departures[0]).toMatchObject({
      foreign: true,
      formationCode: undefined,
      routeCode: 'KB2',
    });
    expect(r.formations).toEqual([]);
  });
});

describe('食い違いの検出', () => {
  it('中身の違う経路が同じ経路コード', () => {
    const b = new ProjectBuilder();
    b.station('A', ['KL01'], { 1: 'right' })
      .station('B', ['KL02'], { 1: 'right', 2: 'right' })
      .station('C', ['KL03'], { 1: 'right' })
      .service(
        'x',
        'down',
        [
          ['KL01', 1],
          ['KL02', 1],
          ['KL03', 1],
        ],
        [{ tag: 'Lo', formation: 'K300' }],
      )
      .service(
        'y',
        'down',
        [
          ['KL01', 1],
          ['KL02', 2],
          ['KL03', 1],
        ],
        [{ tag: 'Ra', formation: 'K302' }],
      );
    const r = computeRoutes(b.build());
    expect(r.routeConflicts).toEqual([
      {
        code: 'KL2L3',
        variants: [
          ['KL02-1', 'KL03-1'],
          ['KL02-2', 'KL03-1'],
        ],
      },
    ]);
  });

  it('同じ編成コードで速度などが食い違う', () => {
    const b = new ProjectBuilder();
    b.station('A', ['KL01'], { 1: 'right' })
      .station('B', ['KL02'], { 1: 'right' })
      .service(
        'x',
        'down',
        [
          ['KL01', 1],
          ['KL02', 1],
        ],
        [{ tag: 'Lo', formation: 'K300' }],
      )
      .service(
        'y',
        'down',
        [
          ['KL01', 1],
          ['KL02', 1],
        ],
        [{ tag: 'Lo', formation: 'K300', maxSpeed: 1.5, cars: 'mm' }],
      );
    const r = computeRoutes(b.build());
    expect(r.formationConflicts).toEqual([{ code: 'K300_KL2_Lo', fields: ['maxSpeed', 'cars'] }]);
  });
});
