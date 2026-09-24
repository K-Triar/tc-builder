import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import type { Project } from '../../domain/model';
import { companyByCode, createGuidedProject } from '../../domain/presets';
import {
  addNamedKind,
  chooseCompany,
  dropUnusedNamedKinds,
  dropUnusedOrgs,
  setStationOrg,
  toggleKind,
  toggleLine,
  toggleOrg,
} from '../setupOps';

const fresh = () => createGuidedProject();
const apply = (p: Project, fn: (d: Project) => void) => produce(p, fn);

describe('鉄道会社を選ぶ', () => {
  it('一覧の会社を選ぶと名前・コード・Wiki の路線が入る', () => {
    const p = apply(fresh(), (d) => chooseCompany(d, companyByCode('K')));
    expect(p.orgs[0]).toMatchObject({ name: 'Kトライア', code: 'K' });
    expect(p.lines.map((l) => l.code)).toEqual(['L', 'B', 'Q', 'U', 'Y']);
  });

  it('選び直すと前の会社の路線は外れる（駅コードで使っている路線は残す）', () => {
    let p = apply(fresh(), (d) => chooseCompany(d, companyByCode('K')));
    const l = p.lines[0]!;
    p = apply(p, (d) => {
      d.stations.push({
        id: 's',
        name: 's',
        managerOrgId: d.selfOrgId,
        signsBySelf: true,
        codes: [
          { id: 'c', code: { kind: 'numbered', orgId: d.selfOrgId, lineId: l.id, number: 1 } },
        ],
        platforms: [],
      });
      chooseCompany(d, companyByCode('H'));
    });
    expect(p.orgs[0]).toMatchObject({ name: 'ヘルヴェティア鉄道局', code: 'H' });
    expect(p.lines.map((x) => x.code)).toEqual(['L']);
  });
});

describe('乗り入れ先', () => {
  it('チェックで足し、外すと消える。乗り入れないと答えると使っていない会社は外れる', () => {
    let p = apply(fresh(), (d) => chooseCompany(d, companyByCode('K')));
    p = apply(p, (d) => toggleOrg(d, companyByCode('SU'), true));
    p = apply(p, (d) => toggleOrg(d, companyByCode('SU'), true));
    p = apply(p, (d) => toggleOrg(d, companyByCode('C'), true));
    expect(p.orgs.map((o) => o.code)).toEqual(['K', 'SU', 'C']);
    p = apply(p, (d) => toggleOrg(d, companyByCode('SU'), false));
    expect(p.orgs.map((o) => o.code)).toEqual(['K', 'C']);
    p = apply(p, dropUnusedOrgs);
    expect(p.orgs.map((o) => o.code)).toEqual(['K']);
  });
});

describe('路線のチェック', () => {
  it('外すと消え、付け直すと戻る', () => {
    let p = apply(fresh(), (d) => chooseCompany(d, companyByCode('K')));
    p = apply(p, (d) => toggleLine(d, { code: 'Q', name: '地下鉄交易所線' }, false));
    expect(p.lines.map((l) => l.code)).toEqual(['L', 'B', 'U', 'Y']);
    p = apply(p, (d) => toggleLine(d, { code: 'Q', name: '地下鉄交易所線' }, true));
    expect(p.lines.map((l) => l.code)).toEqual(['L', 'B', 'U', 'Y', 'Q']);
  });
});

describe('種別のチェック', () => {
  it('足すときは KT式の並びの位置に入り、外すと消える', () => {
    let p = fresh();
    p = apply(p, (d) => toggleKind(d, { typeCode: 'Te', name: '試運転' }, true));
    p = apply(p, (d) => toggleKind(d, { typeCode: 'Ra', name: '快速' }, false));
    p = apply(p, (d) => toggleKind(d, { typeCode: 'Fg', name: '貨物' }, true));
    p = apply(p, (d) => toggleKind(d, { typeCode: 'Ra', name: '快速' }, true));
    expect(p.kinds.map((k) => k.typeCode)).toEqual(['Lo', 'Ra', 'SR', 'EX', 'Fg', 'Te']);
  });

  it('列車の走り方で使っている種別は外さない', () => {
    let p = fresh();
    const lo = p.kinds[0]!;
    p = apply(p, (d) => {
      d.services.push({
        id: 'v',
        name: 'v',
        direction: 'down',
        entries: [],
        kinds: [
          {
            kindId: lo.id,
            formation: 'K300',
            maxSpeed: 1,
            mobCollision: 'cancel',
            playerCollision: 'cancel',
            stops: [],
          },
        ],
      });
      toggleKind(d, { typeCode: 'Lo', name: '普通' }, false);
    });
    expect(p.kinds[0]!.id).toBe(lo.id);
  });
});

describe('名前付き列車', () => {
  it('種別の後ろに足し、「ない」と答えると外れる', () => {
    let p = fresh();
    p = apply(p, (d) => void addNamedKind(d, 'SR'));
    expect(p.kinds.map((k) => [k.typeCode, k.trainNameCode])).toEqual([
      ['Lo', undefined],
      ['Ra', undefined],
      ['SR', undefined],
      ['SR', ''],
      ['EX', undefined],
    ]);
    // 名前付きの種別は、ふつうの種別のチェックでは消えない
    p = apply(p, (d) => toggleKind(d, { typeCode: 'SR', name: '特別快速' }, false));
    expect(p.kinds.map((k) => k.typeCode)).toEqual(['Lo', 'Ra', 'SR', 'EX']);
    p = apply(p, dropUnusedNamedKinds);
    expect(p.kinds.map((k) => k.typeCode)).toEqual(['Lo', 'Ra', 'EX']);
  });
});

describe('駅の鉄道会社', () => {
  it('他の鉄道会社の駅にすると駅コードは空になり、戻すと続きの番号になる', () => {
    let p = apply(fresh(), (d) => {
      chooseCompany(d, companyByCode('K'));
      toggleOrg(d, companyByCode('SU'), true);
      const lineId = d.lines[0]!.id;
      for (const [id, n] of [
        ['a', 1],
        ['b', 2],
      ] as const) {
        d.stations.push({
          id,
          name: id,
          managerOrgId: d.selfOrgId,
          signsBySelf: true,
          codes: [
            { id: `c${id}`, code: { kind: 'numbered', orgId: d.selfOrgId, lineId, number: n } },
          ],
          platforms: [{ number: 1, codeId: `c${id}`, deadEnd: false }],
        });
      }
    });
    const su = p.orgs.find((o) => o.code === 'SU')!.id;
    p = apply(p, (d) => setStationOrg(d, 'a', su));
    expect(p.stations[0]).toMatchObject({
      managerOrgId: su,
      codes: [{ id: 'ca', code: { kind: 'free', value: '' } }],
    });
    p = apply(p, (d) => setStationOrg(d, 'a', d.selfOrgId));
    expect(p.stations[0]!.codes[0]!.code).toMatchObject({ kind: 'numbered', number: 3 });
  });
});
