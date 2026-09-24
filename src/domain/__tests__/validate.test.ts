import { describe, expect, it } from 'vitest';
import { departureKey } from '../model';
import { validate, type Issue, type IssueCode } from '../validate';
import { ProjectBuilder, ruriDown, type KindSpec } from './builder';

const codesOf = (issues: Issue[]) => issues.map((i) => i.code);
const find = (issues: Issue[], code: IssueCode) => issues.filter((i) => i.code === code);

/** A → B → C の1系統 */
function line3(kinds: KindSpec[] = [{ tag: 'Lo', formation: 'K300' }]) {
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
      kinds,
    );
  return b;
}

describe('検証（rules §6）', () => {
  it('瑠璃線フィクスチャにはエラーがない', () => {
    const issues = validate(ruriDown().build());
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('DEST_DUP：行先コードの重複', () => {
    const b = line3();
    // C 駅の 1番に、B 駅と同じ駅コード KL02 を使わせる
    const c = b.project.stations[2]!;
    c.codes.push({
      id: 'dup',
      code: { kind: 'numbered', orgId: b.project.selfOrgId, lineId: 'line-L', number: 2 },
    });
    c.platforms[0]!.codeId = 'dup';
    const issues = find(validate(b.build()), 'DEST_DUP');
    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({ severity: 'error' });
    expect(issues[0]!.message).toContain('KL02-1');
  });

  it('ROUTE_CODE_CONFLICT：中身の違う経路が同じ経路コード', () => {
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
    const [issue] = find(validate(b.build()), 'ROUTE_CODE_CONFLICT');
    expect(issue).toMatchObject({ severity: 'error', target: { kind: 'route', code: 'KL2L3' } });
  });

  it('FORMATION_CONFLICT：同じ編成コードで速度が違う', () => {
    const b = line3();
    b.service(
      'y',
      'down',
      [
        ['KL01', 1],
        ['KL02', 1],
        ['KL03', 1],
      ],
      [{ tag: 'Lo', formation: 'K300', maxSpeed: 2 }],
    );
    const issues = find(validate(b.build()), 'FORMATION_CONFLICT');
    expect(issues.map((i) => i.target)).toEqual([{ kind: 'formation', code: 'K300_KL3_Lo' }]);
    expect(issues[0]!.message).toContain('最高速度');
  });

  it('PLATFORM_DIR_MISSING：看板を作るのりばで向きが未入力', () => {
    const b = line3();
    delete b.project.stations[1]!.platforms[0]!.dir;
    expect(find(validate(b.build()), 'PLATFORM_DIR_MISSING')).toEqual([
      expect.objectContaining({
        severity: 'error',
        target: { kind: 'platform', stationId: 'st-KL02', platform: 1 },
      }),
    ]);
  });

  it('PLATFORM_DIR_MISSING：他団体が看板を置く駅は対象外', () => {
    const b = ruriDown();
    delete b.project.stations.find((s) => s.id === 'st-NSC')!.platforms[0]!.dir;
    expect(find(validate(b.build()), 'PLATFORM_DIR_MISSING')).toEqual([]);
  });

  it('SERVICE_NO_TERMINAL：終点ののりばが未定', () => {
    const b = line3();
    b.project.services[0]!.entries[2]!.platform = null;
    expect(codesOf(validate(b.build()))).toContain('SERVICE_NO_TERMINAL');
  });

  it('SERVICE_TOO_SHORT：経由リストが2駅未満', () => {
    const b = line3();
    b.project.services[0]!.entries.splice(1);
    b.project.services[0]!.kinds[0]!.stops = [true];
    expect(codesOf(validate(b.build()))).toContain('SERVICE_TOO_SHORT');
  });

  it('KIND_NO_STOP：途中に停車駅がなく、発駅もない種別', () => {
    const b = line3([{ tag: 'Lo', formation: 'K300', pass: ['KL02'] }]);
    b.project.overrides.departure[departureKey('sv1', 'kind-Lo', 0)] = { enabled: false };
    expect(find(validate(b.build()), 'KIND_NO_STOP')).toEqual([
      expect.objectContaining({
        severity: 'error',
        target: { kind: 'service', serviceId: 'sv1', kindId: 'kind-Lo' },
      }),
    ]);
  });

  it('SKIP_MANUAL：自動で決められない skip 条件', () => {
    const b = line3(
      ['Lo', 'Ra', 'SR', 'EX', 'ET'].map((tag, i) => ({
        tag,
        formation: `K30${i * 2}`,
        ...(i >= 2 ? { pass: ['KL02'] } : {}),
      })),
    );
    expect(find(validate(b.build()), 'SKIP_MANUAL')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        target: { kind: 'platform', stationId: 'st-KL02', platform: 1 },
      }),
    ]);
  });

  it('FOREIGN_FORMATION_MISSING：他団体の編成名が未入力', () => {
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
    const issues = validate(b.build());
    expect(find(issues, 'FOREIGN_FORMATION_MISSING')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        target: { kind: 'departure', serviceId: 'sv1', kindId: 'kind-Ra', entryIndex: 0 },
      }),
    ]);
    // FOREIGN_STATION：すり合わせが必要な駅（情報）
    expect(find(issues, 'FOREIGN_STATION')).toEqual([
      expect.objectContaining({
        severity: 'info',
        target: { kind: 'station', stationId: 'st-NSC' },
      }),
    ]);
  });

  it('FORM_PARITY：上り系統なのに偶数など', () => {
    const b = line3([{ tag: 'Lo', formation: 'K301' }]);
    const [issue] = find(validate(b.build()), 'FORM_PARITY');
    expect(issue).toMatchObject({ severity: 'warning' });
    expect(issue!.message).toContain('K300');
    // 他団体の形式コードは見ない
    const h = line3([{ tag: 'Lo', formation: 'H3005' }]);
    expect(find(validate(h.build()), 'FORM_PARITY')).toEqual([]);
  });

  it('TERMINAL_THROUGH：通り抜けできるのりばが終点', () => {
    const b = line3();
    b.service(
      'y',
      'down',
      [
        ['KL01', 1],
        ['KL02', 1],
      ],
      [{ tag: 'Ra', formation: 'K302' }],
    );
    expect(find(validate(b.build()), 'TERMINAL_THROUGH')).toEqual([
      expect.objectContaining({
        severity: 'warning',
        target: { kind: 'platform', stationId: 'st-KL02', platform: 1 },
      }),
    ]);
    // 直通の終点なら警告しない
    b.project.services[1]!.throughNote = '他社線';
    expect(find(validate(b.build()), 'TERMINAL_THROUGH')).toEqual([]);
  });

  it('MANY_SPAWNS：spawn が5枚以上', () => {
    const b = line3(
      ['Lo', 'Ra', 'SR', 'EX', 'ET'].map((tag, i) => ({ tag, formation: `K30${i * 2}` })),
    );
    expect(find(validate(b.build()), 'MANY_SPAWNS').map((i) => i.target)).toEqual([
      { kind: 'platform', stationId: 'st-KL01', platform: 1 },
      { kind: 'platform', stationId: 'st-KL02', platform: 1 },
    ]);
  });

  it('CODE_CHARS：コードに空白や全角文字', () => {
    const b = line3([{ tag: 'Lo', formation: 'K３00' }]);
    b.project.orgs[0]!.code = 'K ';
    b.project.kinds[0]!.trainNameCode = 'ＬＳＲ';
    const issues = find(validate(b.build()), 'CODE_CHARS');
    expect(issues.map((i) => i.target)).toEqual([
      { kind: 'org', orgId: b.project.selfOrgId },
      { kind: 'kind', kindId: 'kind-Lo' },
      { kind: 'service', serviceId: 'sv1', kindId: 'kind-Lo' },
    ]);
    expect(issues.every((i) => i.severity === 'error')).toBe(true);
  });

  it('CODE_CHARS：必須のコードが空', () => {
    const b = line3([{ tag: 'Lo', formation: '' }]);
    expect(find(validate(b.build()), 'CODE_CHARS')[0]!.message).toContain('空');
  });

  it('PLATFORM_MISSING：系統が存在しないのりばを通る', () => {
    const b = line3();
    b.project.services[0]!.entries[1]!.platform = 9;
    expect(find(validate(b.build()), 'PLATFORM_MISSING')).toEqual([
      expect.objectContaining({
        severity: 'error',
        target: { kind: 'service', serviceId: 'sv1', entryIndex: 1 },
      }),
    ]);
  });

  it('エラー → 警告 → 情報 の順に並ぶ', () => {
    const b = line3([{ tag: 'Lo', formation: 'K301' }]);
    delete b.project.stations[1]!.platforms[0]!.dir;
    const sev = validate(b.build()).map((i) => i.severity);
    expect(sev).toEqual([...sev].sort((a, c) => rank(a) - rank(c)));
  });
});

const rank = (s: string) => ['error', 'warning', 'info'].indexOf(s);
