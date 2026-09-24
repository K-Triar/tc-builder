import { describe, expect, it } from 'vitest';
import { computeChoices } from '../choice';
import { ruriDown } from './builder';

/** 系統 serviceIndex の経由リストを「駅コード: 選ぶか 理由」の形で返す */
function choicesOf(
  project: ReturnType<ReturnType<typeof ruriDown>['build']>,
  serviceIndex: number,
) {
  const table = computeChoices(project);
  const service = project.services[serviceIndex]!;
  return service.entries.map((e, i) => {
    const st = project.stations.find((s) => s.id === e.stationId)!;
    return { station: st.name, platform: e.platform, ...table[serviceIndex]![i]! };
  });
}

describe('選択駅の自動推定（rules §3.2）', () => {
  const p = ruriDown().build();
  const futsu = choicesOf(p, 0);
  const byName = (name: string) => futsu.find((c) => c.station === name)!;

  it('同じ前の駅から入るのりばが2つ以上なら選ぶ', () => {
    expect(byName('瑠璃中央')).toMatchObject({
      chosen: true,
      auto: true,
      reason: '瑠前TT から入るのりばが 2番・3番 の2つ',
    });
    expect(byName('セナポンタウン').chosen).toBe(true);
    expect(byName('瑠順中央')).toMatchObject({
      chosen: true,
      reason: '沿海 から入るのりばが 1番・3番 の2つ',
    });
    // イアリーオ国際空港から入るアカシア島は、普通 1番・直通快速 3番
    expect(byName('アカシア島').chosen).toBe(true);
  });

  it('1つしかなければ選ばない', () => {
    expect(byName('オット')).toMatchObject({
      chosen: false,
      auto: true,
      reason: 'アカシア島 から入るのりばは 1番 だけ',
    });
    expect(byName('南セナポン').chosen).toBe(false);
    expect(byName('瑠順農園').chosen).toBe(false);
  });

  it('始発駅は入らない、終点は必ず入る', () => {
    expect(futsu[0]).toMatchObject({ chosen: false, reason: '始発駅（経路に入らない）' });
    expect(futsu[futsu.length - 1]).toMatchObject({ chosen: true, reason: '終点' });
  });

  it('のりば未定の駅は選ばない', () => {
    const c = choicesOf(p, 1).find((x) => x.station === 'クォーツ湖')!;
    expect(c).toMatchObject({ chosen: false, reason: 'のりば未定（他団体区間）' });
  });

  it('経路の反対方向の系統は別に数える（前の駅が違う）', () => {
    // 瑠璃中央 1番（中央線各停の終点）と、瑠璃要塞から入る 3番（新快速・特急）
    const shin = choicesOf(p, 2);
    expect(shin.find((c) => c.station === '瑠璃中央')).toMatchObject({
      chosen: true,
      reason: '瑠璃要塞 から入るのりばが 1番・3番 の2つ',
    });
  });
});

describe('のりば単位の上書き', () => {
  it('「入れる」「入れない」は系統をまたいで同じのりばに効く', () => {
    const p = ruriDown().include('KL11', 1).exclude('KL05', 5).build();
    const futsu = choicesOf(p, 0);
    expect(futsu.find((c) => c.station === '瑠順農園')).toMatchObject({
      chosen: true,
      auto: false,
      override: 'include',
      reason: '手動で入れる（自動では入らない：瑠順中央 から入るのりばは 1番 だけ）',
    });
    // 5番は直通快速・新快速・特急の3系統で外れる
    for (const i of [1, 2, 3]) {
      expect(choicesOf(p, i).find((c) => c.station === 'セナポンタウン')).toMatchObject({
        chosen: false,
        override: 'exclude',
      });
    }
    // 6番（普通）は自動のまま
    expect(futsu.find((c) => c.station === 'セナポンタウン')).toMatchObject({
      chosen: true,
      auto: true,
    });
  });

  it('自動と同じ上書きでも印は付く', () => {
    const p = ruriDown().include('KL04', 2).build();
    expect(choicesOf(p, 0).find((c) => c.station === '瑠璃中央')).toMatchObject({
      chosen: true,
      auto: false,
      reason: '手動で入れる（自動でも入る）',
    });
  });
});
