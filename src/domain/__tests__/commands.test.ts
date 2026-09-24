import { describe, expect, it } from 'vitest';
import { buildCommandPlan, formatSpeed } from '../commands';
import { departureKey } from '../model';
import { computeRoutes } from '../routes';
import { ProjectBuilder, ruriDown } from './builder';

function plan(b: ProjectBuilder) {
  const p = b.build();
  return buildCommandPlan(computeRoutes(p));
}
const blocksOf = (pl: ReturnType<typeof plan>) => pl.groups.flatMap((g) => g.blocks);

describe('コマンド（rules §5）', () => {
  it('T13：K300_KL4L13_Lo の経路と編成のコマンドが §5.1 の例と完全一致', () => {
    const blocks = blocksOf(plan(ruriDown()));
    const route = blocks.find((x) => x.id === 'route:KL4L13')!;
    const formation = blocks.find((x) => x.id === 'formation:K300_KL4L13_Lo')!;
    expect([...route.lines, ...formation.lines].join('\n')).toBe(
      [
        '/train route set KL04-2 KL05-6 KL10-1 KL13-2',
        '/train route save KL4L13',
        '/train maxspeed 1.0',
        '/train collision mobs cancel',
        '/train collision player cancel',
        '/train tags set Lo',
        '/train route load KL4L13',
        '/train setname K300_KL4L13_Lo',
        '/train save K300_KL4L13_Lo',
      ].join('\n'),
    );
  });

  it('最高速度は少なくとも小数1桁', () => {
    expect(formatSpeed(1)).toBe('1.0');
    expect(formatSpeed(1.5)).toBe('1.5');
    expect(formatSpeed(0.75)).toBe('0.75');
    expect(formatSpeed(2)).toBe('2.0');
  });

  it('準備 → 経路 → 編成 → 仕上げ の順。経路はすべて編成より先', () => {
    const pl = plan(ruriDown());
    expect(pl.groups.map((g) => g.kind)).toEqual(['prep', 'routes', 'formations', 'finish']);
    const kinds = blocksOf(pl).map((x) => x.kind);
    expect(kinds.lastIndexOf('route')).toBeLessThan(kinds.indexOf('formation'));
    expect(pl.groups.at(-1)!.blocks[0]!.lines).toEqual(['/train reroute']);
    // 経路は経路コードごとに1回
    const routeIds = blocksOf(pl)
      .filter((x) => x.kind === 'route')
      .map((x) => x.id);
    expect(new Set(routeIds).size).toBe(routeIds.length);
  });

  it('両数ごとにまとめ、両数ごとに /train chest を出す。未設定は最後', () => {
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
        [
          { tag: 'Lo', formation: 'K300', cars: 'mmmm' },
          { tag: 'Ra', formation: 'K302' },
          { tag: 'SR', formation: 'K200', cars: 'mm' },
        ],
      );
    const pl = plan(b);
    expect(pl.groups.map((g) => [g.kind, g.cars])).toEqual([
      ['prep', 'mmmm'],
      ['routes', undefined],
      ['formations', 'mmmm'],
      ['formations', 'mm'],
      ['formations', undefined],
      ['finish', undefined],
    ]);
    expect(pl.groups[0]!.blocks[0]!.lines).toEqual(['/train chest mmmm']);
    // 2つ目の両数から列車を出し直す
    expect(pl.groups[3]!.blocks[0]).toMatchObject({ kind: 'prep', lines: ['/train chest mm'] });
    expect(pl.groups[4]!.blocks.map((x) => x.id)).toEqual(['formation:K302_KL3_Ra']);
    expect(pl.groups[4]!.note).toContain('今乗っている列車のまま');
  });

  it('両数がすべて未設定なら準備は案内だけ', () => {
    const pl = plan(ruriDown());
    expect(pl.groups[0]!.blocks[0]).toMatchObject({ lines: [] });
    expect(pl.groups[0]!.blocks[0]!.note).toContain('好きな両数');
  });

  it('他団体の編成（手入力）はコマンドを作らない。経路は作る', () => {
    const b = ruriDown();
    b.project.overrides.departure[departureKey('sv3', 'kind-SR-LSR', 0)] = {
      foreignName: 'H2006_X',
    };
    const blocks = blocksOf(plan(b));
    expect(blocks.some((x) => x.id === 'formation:H2006_X')).toBe(false);
    expect(blocks.some((x) => x.id === 'route:KL4NSC')).toBe(true);
  });

  it('ブロックごとのハッシュは中身で変わる', () => {
    const a = blocksOf(plan(ruriDown())).find((x) => x.id === 'formation:K300_KL4L13_Lo')!;
    const b = ruriDown();
    b.project.services[0]!.kinds[0]!.maxSpeed = 1.2;
    const c = blocksOf(plan(b)).find((x) => x.id === 'formation:K300_KL4L13_Lo')!;
    expect(c.hash).not.toBe(a.hash);
  });

  it('注意書き', () => {
    expect(plan(ruriDown()).notes.join('\n')).toContain('降りない');
  });
});
