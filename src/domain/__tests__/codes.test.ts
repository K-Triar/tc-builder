import { describe, expect, it } from 'vitest';
import {
  codeContext,
  destText,
  formationCode,
  formParity,
  kindTag,
  pairedFormCode,
  parseFormCode,
  resolveStationCode,
  routeCode,
  short,
  shortEnd,
  stationCodeText,
  type CodeParts,
  type Dest,
} from '../codes';
import { companyByCode, createProject } from '../presets';

/** テスト用：'KL04' や 'NSC' を CodeParts にする（団体 K を自団体とみなす） */
function parts(text: string): CodeParts {
  const m = /^([A-Z])([A-Z])(\d{2})$/.exec(text);
  if (m)
    return { kind: 'numbered', org: m[1]!, line: m[2]!, number: Number(m[3]), self: m[1] === 'K' };
  return { kind: 'free', value: text };
}
function dest(text: string): Dest {
  const i = text.lastIndexOf('-');
  return { code: parts(text.slice(0, i)), platform: Number(text.slice(i + 1)) };
}
const route = (s: string) => s.split(' → ').map(dest);

describe('駅コード（rules §2.1）', () => {
  const p = createProject(companyByCode('K'), 't');
  const ctx = codeContext(p);
  const L = p.lines.find((l) => l.code === 'L')!;

  it('番号つきは 団体 + 路線 + 2桁', () => {
    const c = resolveStationCode(
      { kind: 'numbered', orgId: p.selfOrgId, lineId: L.id, number: 4 },
      ctx,
    );
    expect(c).toEqual({ kind: 'numbered', org: 'K', line: 'L', number: 4, self: true });
    expect(stationCodeText(c)).toBe('KL04');
  });

  it('番号のない駅は文字列そのまま', () => {
    const c = resolveStationCode({ kind: 'free', value: 'IIA' }, ctx);
    expect(stationCodeText(c)).toBe('IIA');
  });

  it('3桁以上の駅番号はそのまま', () => {
    expect(
      stationCodeText({ kind: 'numbered', org: 'K', line: 'L', number: 123, self: true }),
    ).toBe('KL123');
  });
});

describe('行先コード（rules §2.2）', () => {
  it('<駅コード>-<のりば番号>', () => {
    expect(destText(dest('KL04-2'))).toBe('KL04-2');
    expect(destText(dest('KU01-1'))).toBe('KU01-1');
    expect(destText(dest('IIA-2'))).toBe('IIA-2');
    expect(destText(dest('NSC-2'))).toBe('NSC-2');
  });
});

describe('short / shortEnd（rules §2.3）', () => {
  it('short は先頭の0を除く', () => {
    expect(short(parts('KL04'))).toBe('KL4');
    expect(short(parts('KB01'))).toBe('KB1');
    expect(short(parts('KL13'))).toBe('KL13');
    expect(short(parts('NSC'))).toBe('NSC');
  });

  it('shortEnd は自団体なら団体コードも除く', () => {
    expect(shortEnd(parts('KL13'))).toBe('L13');
    expect(shortEnd(parts('KU06'))).toBe('U6');
    expect(shortEnd(parts('NSC'))).toBe('NSC');
    expect(shortEnd(parts('IIA'))).toBe('IIA');
  });

  it('他団体の番号つき駅は団体コードを残す', () => {
    expect(shortEnd(parts('HA05'))).toBe('HA5');
  });
});

describe('経路コード（rules §2.3 の表、T4）', () => {
  it.each([
    ['KL01-1 → KL04-2 → KL05-6 → KL10-1 → KL13-2', 'KL1L13'],
    ['KL04-3 → KL05-5 → KB01-3 → KB02-3 → NSC-2', 'KL4NSC'],
    ['KB02-4 → KB01-4 → KL05-4 → KL04-4 → KU06-2', 'KB2U6'],
    ['KL13-2', 'KL13'],
    ['KU06-2', 'KU6'], // T4
    ['IIA-2', 'IIA'],
    ['KL10-2 → KL05-3 → KL04-5 → KL01-2 → IIA-2', 'KL10IIA'],
  ])('%s → %s', (r, code) => {
    expect(routeCode(route(r))).toBe(code);
  });

  it('始点と終点が同じ駅コード（別のりば）なら short(A) だけ', () => {
    expect(routeCode(route('KL04-2 → KL04-5'))).toBe('KL4');
  });
});

describe('編成コード・形式コード・タグ（rules §2.4〜2.6）', () => {
  it('編成コード', () => {
    expect(formationCode('K300', 'KL4L13', 'Lo')).toBe('K300_KL4L13_Lo');
    expect(formationCode('K200', 'KL4NSC', 'SR-LSR')).toBe('K200_KL4NSC_SR-LSR');
    expect(formationCode('K700', 'KL4B6', 'EX-MKR')).toBe('K700_KL4B6_EX-MKR');
  });

  it('タグ', () => {
    expect(kindTag({ typeCode: 'Lo' })).toBe('Lo');
    expect(kindTag({ typeCode: 'SR', trainNameCode: 'LSR' })).toBe('SR-LSR');
    expect(kindTag({ typeCode: 'EX', trainNameCode: 'MKR' })).toBe('EX-MKR');
    expect(kindTag({ typeCode: 'Lo', trainNameCode: '' })).toBe('Lo');
  });

  it('形式コードの分解', () => {
    expect(parseFormCode('K300')).toEqual({ org: 'K', usage: '3', number: '00' });
    expect(parseFormCode('K201')).toEqual({ org: 'K', usage: '2', number: '01' });
    expect(parseFormCode('H3004')).toEqual({ org: 'H3', usage: '0', number: '04' });
    expect(parseFormCode('K30')).toBeUndefined();
    expect(parseFormCode('')).toBeUndefined();
  });

  it('奇数＝上り、偶数＝下り。対の番号', () => {
    expect(formParity('K301')).toBe('up');
    expect(formParity('K300')).toBe('down');
    expect(formParity('abc')).toBeUndefined();
    expect(pairedFormCode('K301')).toBe('K300');
    expect(pairedFormCode('K300')).toBe('K301');
    expect(pairedFormCode('K702')).toBe('K703');
    expect(pairedFormCode('abc')).toBeUndefined();
  });
});
