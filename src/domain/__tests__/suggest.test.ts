import { describe, expect, it } from 'vitest';
import { defaultServiceKind, reverseService, suggestPlatform } from '../suggest';
import { createProject, K_PRESET } from '../presets';
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
    const empty = createProject(K_PRESET, 'x');
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
    const p = createProject(K_PRESET, 'x');
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
