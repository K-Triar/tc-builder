import { describe, expect, it } from 'vitest';
import { departureKey } from '../model';
import { summarizePlatforms } from '../platforms';
import { ProjectBuilder, ruriDown } from './builder';

function summaryOf(b: ProjectBuilder, code: string, platform: number) {
  const list = summarizePlatforms(b.build());
  const s = list.find((x) => x.stationId === b.stationId(code) && x.platform === platform);
  if (!s) throw new Error(`${code} ${platform}番がない`);
  return s;
}

describe('のりばの集計（rules §3.6）', () => {
  const b = ruriDown();

  it('オット 1番：普通だけ停車、快速は通過', () => {
    const s = summaryOf(b, 'KL02', 1);
    expect(s).toMatchObject({
      key: 'st-KL02#1',
      stopTags: ['Lo'],
      passTags: ['Ra'],
      isTerminal: false,
      hasDeparture: true,
    });
    expect(s.spawns.map((x) => x.formationCode)).toEqual(['K300_KL4L13_Lo']);
  });

  it('通過タグは種別の登録順', () => {
    expect(summaryOf(b, 'KL06', 1).passTags).toEqual(['Ra', 'SR-LSR', 'EX-MKR']);
  });

  it('spawn は種別の登録順 → 系統の登録順', () => {
    expect(summaryOf(b, 'KL04', 3).spawns.map((x) => x.formationCode)).toEqual([
      'K302_KL5NSC_Ra',
      'K200_KL5NSC_SR-LSR',
      'K700_KL5B2_EX-MKR',
    ]);
    expect(summaryOf(b, 'KL04', 3)).toMatchObject({
      stopTags: ['Ra', 'SR-LSR', 'EX-MKR'],
      passTags: [],
    });
  });

  it('終点と発車', () => {
    expect(summaryOf(b, 'KL13', 2)).toMatchObject({
      isTerminal: true,
      hasDeparture: false,
      spawns: [],
    });
    // 瑠璃中央 1番：各停 瑠璃中央行の終点で、二労行の始発
    expect(summaryOf(b, 'KU01', 1)).toMatchObject({ isTerminal: true, hasDeparture: true });
  });

  it('どの系統も通らないのりばも一覧に出る', () => {
    expect(summaryOf(b, 'KL02', 2)).toMatchObject({
      used: false,
      stopTags: [],
      passTags: [],
      spawns: [],
      isTerminal: false,
      hasDeparture: false,
    });
  });
});

describe('細かい規則', () => {
  function twoServices() {
    const b = new ProjectBuilder();
    b.kind('Lo');
    b.kind('Ra');
    b.station('A', ['KL01'], { 1: 'right' })
      .station('B', ['KL02'], { 1: 'right' })
      .station('C', ['KL03'], { 1: 'right' })
      .service(
        'x',
        'down',
        [
          ['KL01', 1],
          ['KL02', 1],
          ['KL03', 1],
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
          ['KL03', 1],
        ],
        [
          { tag: 'Ra', formation: 'K302' },
          { tag: 'Lo', formation: 'K300' },
        ],
      );
    return b;
  }

  it('停車タグにもあるタグは通過タグから除く', () => {
    expect(summaryOf(twoServices(), 'KL02', 1)).toMatchObject({
      stopTags: ['Lo', 'Ra'],
      passTags: [],
    });
  });

  it('同じ編成コードの spawn は1枚にまとめる', () => {
    expect(summaryOf(twoServices(), 'KL01', 1).spawns.map((x) => x.formationCode)).toEqual([
      'K300_KL3_Lo',
      'K302_KL3_Ra',
    ]);
  });

  it('発駅を外しても、停車して先へ進むなら発車がある', () => {
    const b = twoServices();
    const p = b.build();
    for (const sv of ['sv1', 'sv2']) {
      for (const k of ['kind-Lo', 'kind-Ra']) {
        p.overrides.departure[departureKey(sv, k, 1)] = { enabled: false };
      }
    }
    expect(summaryOf(b, 'KL02', 1)).toMatchObject({ spawns: [], hasDeparture: true });
  });

  it('他の鉄道会社の編成名が未入力の spawn は、コードなしで残る', () => {
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
    expect(summaryOf(b, 'NSC', 1).spawns).toEqual([
      {
        formationCode: undefined,
        foreign: true,
        serviceId: 'sv1',
        kindId: 'kind-Ra',
        entryIndex: 0,
      },
    ]);
  });
});
