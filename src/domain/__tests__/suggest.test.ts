import { describe, expect, it } from 'vitest';
import {
  autoServiceName,
  defaultServiceKind,
  formationForDirection,
  platformQuestionIndexes,
  reverseForGuide,
  reverseService,
  suggestEntries,
  suggestPlatform,
} from '../suggest';
import { companyByCode, createProject } from '../presets';
import { ruriDown } from './builder';

describe('のりばの提案（R4、design §6.2）', () => {
  const p = ruriDown().build();

  it('同じ前の駅から入る系統ののりばを提案する', () => {
    // アカシア島 → オット は 1番だけ
    expect(suggestPlatform(p, 'st-KL01', 'st-KL02')).toBe(1);
  });

  it('候補が複数なら、いちばん多く使われているのりば', () => {
    // 瑠前TT → 瑠璃中央：普通 2番（1系統）、直通快速 3番（1系統）→ 同数なら小さい番号
    expect(suggestPlatform(p, 'st-KL03', 'st-KL04')).toBe(2);
    // 瑠璃中央 → セナポンタウン：6番（1系統）、5番（3系統）
    expect(suggestPlatform(p, 'st-KL04', 'st-KL05')).toBe(5);
  });

  it('前の駅からの例がなければ、その駅でいちばん使われているのりば、なければ最初ののりば', () => {
    expect(suggestPlatform(p, 'st-KU06', 'st-KL02')).toBe(1);
    expect(suggestPlatform(p, undefined, 'st-KL13')).toBe(2);
    const empty = createProject(companyByCode('K'), 'x');
    empty.stations.push({
      id: 's',
      name: 's',
      managerOrgId: empty.selfOrgId,
      signsBySelf: true,
      codes: [],
      platforms: [
        { number: 3, codeId: 'c', deadEnd: false },
        { number: 4, codeId: 'c', deadEnd: false },
      ],
    });
    expect(suggestPlatform(empty, undefined, 's')).toBe(3);
  });

  it('のりばのない駅は未定', () => {
    expect(suggestPlatform(p, 'st-KB02', 'st-QUL')).toBeNull();
  });
});

describe('反対方向を作る（R4.4）', () => {
  const p = ruriDown().build();
  const down = p.services[0]!;

  it('駅の並びを逆にし、のりばは要入力（未定）にする', () => {
    const up = reverseService(down, 'new');
    expect(up.id).toBe('new');
    expect(up.direction).toBe('up');
    expect(up.entries.map((e) => e.stationId)).toEqual(
      [...down.entries].reverse().map((e) => e.stationId),
    );
    expect(up.entries.every((e) => e.platform === null)).toBe(true);
    expect(up.name).toBe(`${down.name}（反対方向）`);
    expect(up.throughNote).toBeUndefined();
  });

  it('停車は逆順、形式番号は対の番号を提案する', () => {
    const up = reverseService(down, 'new');
    const ra = up.kinds.find((k) => k.kindId === 'kind-Ra')!;
    expect(ra.stops).toEqual([...down.kinds[1]!.stops].reverse());
    expect(ra.formation).toBe('K303');
    expect(up.kinds[0]!.formation).toBe('K301');
  });
});

describe('系統に種別を載せるときの初期値', () => {
  it('用途番号の標準最高速度と、方向に合った形式番号', () => {
    const p = createProject(companyByCode('K'), 'x');
    const ex = p.kinds.find((k) => k.typeCode === 'EX')!;
    const lo = p.kinds.find((k) => k.typeCode === 'Lo')!;
    const sr = p.kinds.find((k) => k.typeCode === 'SR')!;
    expect(defaultServiceKind(p, ex.id, 'down', 3)).toMatchObject({
      formation: 'K700',
      maxSpeed: 2,
      mobCollision: 'cancel',
      playerCollision: 'cancel',
      stops: [true, true, true],
    });
    expect(defaultServiceKind(p, lo.id, 'up', 2)).toMatchObject({ formation: 'K301', maxSpeed: 1 });
    expect(defaultServiceKind(p, sr.id, 'up', 2)).toMatchObject({
      formation: 'K201',
      maxSpeed: 1.5,
    });
  });
});

describe('列車の走り方を小さな質問で作る（redesign2 §2-4）', () => {
  const p = ruriDown().build();
  const names = (entries: { stationId: string }[]) =>
    entries.map((e) => p.stations.find((s) => s.id === e.stationId)!.name);

  it('始発と終点を選ぶと、登録順でその間の駅が並ぶ（逆向きも）', () => {
    expect(names(suggestEntries(p, 'st-KL01', 'st-KL04'))).toEqual([
      'アカシア島',
      'オット',
      '瑠前TT',
      '瑠璃中央',
    ]);
    expect(names(suggestEntries(p, 'st-KL03', 'st-KL01'))).toEqual([
      '瑠前TT',
      'オット',
      'アカシア島',
    ]);
    expect(suggestEntries(p, 'st-KL01', 'st-KL01')).toEqual([]);
  });

  it('のりばが1つなら自動、2つ以上ならほかの走り方から提案する', () => {
    const entries = suggestEntries(p, 'st-KL02', 'st-KL04');
    expect(entries.map((e) => e.platform)).toEqual([1, 1, 2]);
    const service = { ...p.services[0]!, entries };
    // オット（1・2番）・瑠前TT（1・2番）・瑠璃中央（1〜5番）はどれも2つ以上なので聞く
    expect(platformQuestionIndexes(p, service)).toEqual([0, 1, 2]);
  });

  it('自動の名前は「始発 → 終点 種別・種別」', () => {
    const v = p.services[0]!;
    const first = p.stations.find((s) => s.id === v.entries[0]!.stationId)!.name;
    const last = p.stations.find((s) => s.id === v.entries.at(-1)!.stationId)!.name;
    expect(autoServiceName(p, v)).toBe(`${first} → ${last} 普通・快速`);
  });

  it('向きを変えると形式番号の一の位を合わせる', () => {
    expect(formationForDirection('K300', 'up')).toBe('K301');
    expect(formationForDirection('K301', 'up')).toBe('K301');
    expect(formationForDirection('K301', 'down')).toBe('K300');
    expect(formationForDirection('', 'down')).toBe('');
  });

  it('反対向きは、のりばが1つの駅だけ自動で決め、名前も自動', () => {
    const v = p.services[0]!;
    const r = reverseForGuide(p, v, 'rev');
    expect(r.direction).toBe('up');
    r.entries.forEach((e) => {
      const st = p.stations.find((s) => s.id === e.stationId)!;
      expect(e.platform).toBe(st.platforms.length === 1 ? st.platforms[0]!.number : null);
    });
    expect(r.name).toBe(autoServiceName(p, r));
  });
});
