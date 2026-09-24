import { describe, expect, it } from 'vitest';
import { contentHash, stableStringify } from '../hash';
import { buildSigns, formatNumber, skipCondition, type PlatformCard } from '../signs';
import { ProjectBuilder, ruriDown } from './builder';

function cardsOf(b: ProjectBuilder) {
  return buildSigns(b.build());
}
function card(b: ProjectBuilder, code: string, platform: number): PlatformCard {
  const c = cardsOf(b).platformCards.find((x) => x.id === `${b.stationId(code)}#${platform}`);
  if (!c) throw new Error(`${code} ${platform}番のカードがない`);
  return c;
}
/** 看板の列を「1行目 2行目 / 3行目 / 4行目」の読みやすい形に */
const text = (c: PlatformCard) =>
  c.signs.map((s) =>
    [`${s.lines[0]} ${s.lines[1]}`, s.lines[2], s.lines[3]].filter(Boolean).join(' / '),
  );

describe('のりばのパターンと看板（rules §4.2〜4.3）', () => {
  it('T5：オット 1番（B）', () => {
    const c = card(ruriDown(), 'KL02', 1);
    expect(c.pattern).toBe('B');
    expect(text(c)).toEqual([
      '[+train] skip 0 2 / !t@Lo',
      '[train] spawn 1 / K300_KL4L13_Lo',
      '[+train] station 5 / 5 / right',
      '[+train] destination / KL02-1',
    ]);
    expect(c.signs.map((s) => s.kind)).toEqual(['skip', 'spawn', 'station', 'destination']);
  });

  it('T6：東ヘルベチア 1番（A）', () => {
    const b = new ProjectBuilder();
    b.station('貿易港', ['KB04'], { 1: 'right' })
      .station('東ヘルベチア', ['KB05'], { 1: 'right' })
      .station('ラピスTT', ['KB06'], { 1: 'right' })
      .service(
        '貿易港線 下り',
        'down',
        [
          ['KB04', 1],
          ['KB05', 1],
          ['KB06', 1],
        ],
        [{ tag: 'Lo', formation: 'K300' }],
      );
    const c = card(b, 'KB05', 1);
    expect(c.pattern).toBe('A');
    expect(text(c)).toEqual([
      '[train] spawn 1 / K300_KB6_Lo',
      '[+train] station 5 / 5 / right',
      '[+train] destination / KB05-1',
    ]);
  });

  it('T7：イアリーオ国際空港 2番（D）', () => {
    const b = new ProjectBuilder();
    b.station('イアリーオ国際空港', ['IIA'], { 2: 'left' }, { org: 'CR', signsBySelf: true })
      .station('アカシア島', ['KL01'], { 2: 'left' })
      .service(
        '上り',
        'up',
        [
          ['KL01', 2],
          ['IIA', 2],
        ],
        [{ tag: 'Lo', formation: 'K301' }],
      );
    const c = card(b, 'IIA', 2);
    expect(c.pattern).toBe('D');
    expect(text(c)).toEqual(['[+train] destroy', '[+train] destination / IIA-2']);
    expect(c.signs[0]!.lines).toEqual(['[+train]', 'destroy', '', '']);
  });

  it('直通の終点（T）：destroy を置かず station → destination', () => {
    const b = ruriDown();
    b.project.services[0]!.throughNote = '翠鉄城東線 トクテルダム中央行';
    const c = card(b, 'KL13', 2);
    expect(c.pattern).toBe('T');
    expect(text(c)).toEqual(['[+train] station 5 / 5 / right', '[+train] destination / KL13-2']);
    expect(c.notes.join('\n')).toContain('翠鉄城東線 トクテルダム中央行');
    // 直通先がなければ D のまま
    expect(card(ruriDown(), 'KL13', 2).pattern).toBe('D');
  });

  it('直通しない系統も終点にするのりばは T にしない', () => {
    const b = ruriDown();
    b.project.services[0]!.throughNote = '翠鉄城東線';
    b.service(
      '区間便',
      'down',
      [
        ['KL12', 1],
        ['KL13', 2],
      ],
      [{ tag: 'Lo', formation: 'K300' }],
    );
    expect(card(b, 'KL13', 2).pattern).toBe('D');
  });

  it('T8：瑠璃中央 1番（G、行き止まり）', () => {
    const c = card(ruriDown(), 'KU01', 1);
    expect(c.pattern).toBe('G');
    expect(text(c)).toEqual([
      '[train] spawn 1 / K300_KU6_Lo',
      '[+train] station 5 / 5 / right',
      '[+train] destination / KU01-1',
      '[+train] skip destroy 0 1 / !empty',
      '[+train] destroy',
    ]);
  });

  it('spawn が複数なら skip の枚数は spawn + 1', () => {
    const b = new ProjectBuilder();
    b.kind('Lo');
    b.kind('SR-LSR');
    b.station('A', ['KU06'], { 1: 'right' })
      .station('羊ノ森', ['KU05'], { 1: 'right' })
      .station('C', ['KU04'], { 1: 'right' })
      .service(
        'x',
        'down',
        [
          ['KU06', 1],
          ['KU05', 1],
          ['KU04', 1],
        ],
        [
          { tag: 'Lo', formation: 'K300' },
          { tag: 'SR-LSR', formation: 'K200', pass: ['KU05'] },
        ],
      )
      .service(
        'y',
        'down',
        [
          ['KU06', 1],
          ['KU05', 1],
          ['KU04', 1],
        ],
        [{ tag: 'Lo', formation: 'K700' }],
      );
    const c = card(b, 'KU05', 1);
    expect(text(c)[0]).toBe('[+train] skip 0 3 / !t@Lo');
    expect(c.signs.filter((s) => s.kind === 'spawn')).toHaveLength(2);
  });

  it('通過専用の線路は destination だけ', () => {
    const b = new ProjectBuilder();
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
        [{ tag: 'Ra', formation: 'K302', pass: ['KL02'] }],
      );
    const c = card(b, 'KL02', 1);
    expect(c.pattern).toBe('passOnly');
    expect(text(c)).toEqual(['[+train] destination / KL02-1']);
  });

  it('spawn のない A は station と destination だけ', () => {
    const b = new ProjectBuilder();
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
        [{ tag: 'Lo', formation: 'K300' }],
      );
    b.project.overrides.departure['sv1#kind-Lo#1'] = { enabled: false };
    expect(text(card(b, 'KL02', 1))).toEqual([
      '[+train] station 5 / 5 / right',
      '[+train] destination / KL02-1',
    ]);
  });

  it('他団体の駅はカードだけで看板を作らない', () => {
    const c = card(ruriDown(), 'NSC', 2);
    expect(c.pattern).toBe('foreign');
    expect(c.signs).toEqual([]);
    expect(c.notes[0]).toContain('NSC-2');
  });

  it('のりばごとの数値設定と、整数は小数点なし', () => {
    const b = ruriDown();
    const pf = b.project.stations.find((s) => s.id === 'st-KL02')!.platforms[0]!;
    pf.params = { spawnSpeed: 0.5, stationDwellSeconds: 10, stationLaunchDistance: 5.0 };
    expect(text(card(b, 'KL02', 1)).slice(1, 3)).toEqual([
      '[train] spawn 0.5 / K300_KL4L13_Lo',
      '[+train] station 5 / 10 / right',
    ]);
    expect(formatNumber(5.0)).toBe('5');
    expect(formatNumber(1.25)).toBe('1.25');
  });
});

describe('skip の条件（rules §4.4、T9〜T12）', () => {
  it('T9：停車 {Lo}、通過 {Ra, SR-LSR} → !t@Lo', () => {
    expect(skipCondition(['Lo'], ['Ra', 'SR-LSR'])).toEqual({ line3: '!t@Lo', line4: '' });
  });
  it('T10：停車 {Lo, EX-MKR}、通過 {SR-LSR} → t@SR-LSR', () => {
    expect(skipCondition(['Lo', 'EX-MKR'], ['SR-LSR'])).toEqual({ line3: 't@SR-LSR', line4: '' });
  });
  it('T11：停車 {Lo, Ra}、通過 {SR-LSR, EX-MKR} → t@SR-LSR / |t@EX-MKR', () => {
    expect(skipCondition(['Lo', 'Ra'], ['SR-LSR', 'EX-MKR'])).toEqual({
      line3: 't@SR-LSR',
      line4: '|t@EX-MKR',
    });
  });
  it('T12：停車 {Lo, Ra}、通過 {SR, EX, ET} → 手動', () => {
    expect(skipCondition(['Lo', 'Ra'], ['SR', 'EX', 'ET'])).toBeUndefined();
  });

  it('手動のときは看板に印を付け、手入力があればそれを使う', () => {
    const b = new ProjectBuilder();
    for (const k of ['Lo', 'Ra', 'SR', 'EX', 'ET']) b.kind(k);
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
          { tag: 'Ra', formation: 'K302' },
          { tag: 'SR', formation: 'K200', pass: ['KL02'] },
          { tag: 'EX', formation: 'K700', pass: ['KL02'] },
          { tag: 'ET', formation: 'K702', pass: ['KL02'] },
        ],
      );
    const skip = card(b, 'KL02', 1).signs[0]!;
    expect(skip).toMatchObject({ kind: 'skip', manual: true });
    expect(skip.lines).toEqual(['[+train]', 'skip 0 3', '', '']);

    b.project.overrides.skipCondition['st-KL02#1'] = { line3: 't@SR', line4: '|t@EX' };
    expect(card(b, 'KL02', 1).signs[0]).toMatchObject({
      manual: true,
      lines: ['[+train]', 'skip 0 3', 't@SR', '|t@EX'],
    });
  });
});

describe('向き・図・ボタン（rules §4.6〜4.7）', () => {
  it('right：図は進行方向順、ボタンは看板ブロックに', () => {
    const c = card(ruriDown(), 'KL02', 1);
    expect(c.dir).toBe('right');
    expect(c.diagram).toEqual([0, 1, 2, 3]);
    expect(c.buttonHint).toBe('onBlock');
  });

  it('left：図は逆順、ボタンは左横から', () => {
    const b = ruriDown();
    b.project.stations.find((s) => s.id === 'st-KL02')!.platforms[0]!.dir = 'left';
    const c = card(b, 'KL02', 1);
    expect(c.signs[2]!.lines[3]).toBe('left');
    expect(c.diagram).toEqual([3, 2, 1, 0]);
    expect(c.buttonHint).toBe('leftSide');
  });

  it('spawn がなければボタンの指示はない', () => {
    expect(card(ruriDown(), 'KL13', 2).buttonHint).toBeUndefined();
  });

  it('向きが未入力なら station の4行目は空で、注意を出す', () => {
    const b = ruriDown();
    delete b.project.stations.find((s) => s.id === 'st-KL02')!.platforms[0]!.dir;
    const c = card(b, 'KL02', 1);
    expect(c.dir).toBeUndefined();
    expect(c.signs[2]!.lines[3]).toBe('');
    expect(c.notes.some((n) => n.includes('進む向きが未入力'))).toBe(true);
  });

  it('spawn のあるカードには試運転での向きの確認と、電源を共有しない注意', () => {
    const notes = card(ruriDown(), 'KL02', 1).notes.join('\n');
    expect(notes).toContain('試運転');
    expect(notes).toContain('電源を共有しない');
  });

  it('ハッシュは看板の内容で変わる', () => {
    const a = card(ruriDown(), 'KL02', 1).hash;
    expect(card(ruriDown(), 'KL02', 1).hash).toBe(a);
    const b = ruriDown();
    b.project.settings.stationDwellSeconds = 8;
    expect(card(b, 'KL02', 1).hash).not.toBe(a);
  });
});

describe('駅ごとの C と switcher（rules §4.5）', () => {
  const b = ruriDown();
  const stations = cardsOf(b).stationCards;
  const st = (code: string) => stations.find((s) => s.stationId === b.stationId(code))!;

  it('C は駅を出ていく方向ごとに1セット', () => {
    const c = st('KL05').cleanups;
    // セナポンタウン：5番・6番から南セナポン方面へ出る
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ towardStationId: b.stationId('KL06'), platforms: [5, 6] });
    expect(c[0]!.signs.map((s) => s.lines)).toEqual([
      ['[+train]', 'skip destroy 0 1', '!empty', ''],
      ['[+train]', 'destroy', '', ''],
    ]);
    expect(c[0]!.text).toContain('南セナポン方面');
  });

  it('出口へ出る発車がすべて G のりばなら C は不要', () => {
    // 瑠璃中央：1番（G）から瑠璃要塞方面、2・3番から セナポンタウン方面
    const c = st('KL04').cleanups;
    expect(c.map((x) => x.towardStationId)).toEqual([b.stationId('KL05')]);
  });

  it('終点だけの駅に C はない', () => {
    expect(st('KL13').cleanups).toEqual([]);
  });

  it('分岐・合流がある駅に switcher の指示', () => {
    expect(st('KL04').switcher).toBeDefined();
    expect(st('KL04').switcher!.reasons).toContain('瑠前TT 方面から 2番・3番 に分かれる');
    expect(st('KL05').switcher!.reasons).toContain('5番・6番 から 南セナポン 方面へ合流する');
    expect(st('KL04').switcher!.sign.lines).toEqual(['[+train]', 'switcher', '', '']);
    // オット：1番だけを通る
    expect(st('KL02').switcher).toBeUndefined();
  });

  it('他団体の駅は看板の指示を出さない', () => {
    expect(st('NSC')).toMatchObject({ foreign: true, cleanups: [] });
    expect(st('NSC').switcher).toBeUndefined();
  });
});

describe('ハッシュ', () => {
  it('キー順に依存しない', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: undefined }] })).toBe(
      '{"a":[1,{"d":2}],"b":1}',
    );
    expect(contentHash({ a: 1, b: 2 })).toBe(contentHash({ b: 2, a: 1 }));
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
  });
});
