// はじめての質問（集中モード、docs/redesign2.md §2-1）で使う、Project を書き換える操作。
// 「チェックを付ける／外す」を、鉄道会社・路線・種別の一覧への足し引きに置き換える。
// 使われているもの（駅コードや列車の走り方が指しているもの）は消さない。

import type { Project } from '../domain/model';
import { KT_KINDS, type Company } from '../domain/presets';

const newId = () => globalThis.crypto.randomUUID();

/** 鉄道会社が駅・駅コード・路線で使われているか */
export function orgInUse(p: Project, orgId: string): boolean {
  return (
    p.selfOrgId === orgId ||
    p.lines.some((l) => l.orgId === orgId) ||
    p.stations.some(
      (s) =>
        s.managerOrgId === orgId ||
        s.codes.some((c) => c.code.kind === 'numbered' && c.code.orgId === orgId),
    )
  );
}

/** 路線が駅コードで使われているか */
export function lineInUse(p: Project, lineId: string): boolean {
  return p.stations.some((s) =>
    s.codes.some((c) => c.code.kind === 'numbered' && c.code.lineId === lineId),
  );
}

/** 種別が列車の走り方で使われているか */
export function kindInUse(p: Project, kindId: string): boolean {
  return p.services.some((s) => s.kinds.some((k) => k.kindId === kindId));
}

/**
 * 自分の鉄道会社を選ぶ。名前とコードを入れ替え、その会社の Wiki の路線を入れる。
 * 前の会社の路線は、駅コードで使っていなければ外す。
 */
export function chooseCompany(p: Project, company: Company): void {
  const self = p.orgs.find((o) => o.id === p.selfOrgId);
  if (!self) return;
  self.name = company.name;
  self.code = company.code;
  p.lines = p.lines.filter(
    (l) =>
      l.orgId !== p.selfOrgId || lineInUse(p, l.id) || company.lines.some((c) => c.code === l.code),
  );
  for (const l of company.lines) {
    if (!p.lines.some((x) => x.orgId === p.selfOrgId && x.code === l.code)) {
      p.lines.push({ id: newId(), orgId: p.selfOrgId, code: l.code, name: l.name });
    }
  }
}

/** 乗り入れない（まだ分からない）と答えたら、使っていない他の鉄道会社を外す */
export function dropUnusedOrgs(p: Project): void {
  p.orgs = p.orgs.filter((o) => orgInUse(p, o.id));
}

/** 乗り入れ先の鉄道会社のチェック。外すのは使っていないときだけ */
export function toggleOrg(p: Project, company: Pick<Company, 'name' | 'code'>, on: boolean): void {
  const found = p.orgs.find((o) => o.id !== p.selfOrgId && o.code === company.code);
  if (on && !found) p.orgs.push({ id: newId(), name: company.name, code: company.code });
  if (!on && found && !orgInUse(p, found.id)) p.orgs = p.orgs.filter((o) => o !== found);
}

/** 自分の鉄道会社の路線のチェック。外すのは駅コードで使っていないときだけ */
export function toggleLine(p: Project, line: { code: string; name: string }, on: boolean): void {
  const found = p.lines.find((l) => l.orgId === p.selfOrgId && l.code === line.code);
  if (on && !found) p.lines.push({ id: newId(), orgId: p.selfOrgId, ...line });
  if (!on && found && !lineInUse(p, found.id)) p.lines = p.lines.filter((l) => l !== found);
}

/** 名前付き列車の種別か（列車名コードを入れている途中の空文字も含む） */
export const isNamedKind = (k: { trainNameCode?: string }) => k.trainNameCode !== undefined;

const ktOrder = (typeCode: string) => {
  const i = KT_KINDS.findIndex((k) => k.typeCode === typeCode);
  return i < 0 ? KT_KINDS.length : i;
};

/**
 * 種別のチェック（列車名コードのない種別だけ）。足すときは KT式の並び（普通・快速…）の位置に入れる。
 * 外すのは列車の走り方で使っていないときだけ
 */
export function toggleKind(
  p: Project,
  kind: { typeCode: string; name: string },
  on: boolean,
): void {
  const found = p.kinds.find((k) => k.typeCode === kind.typeCode && !isNamedKind(k));
  if (on && !found) {
    const order = ktOrder(kind.typeCode);
    const at = p.kinds.findIndex((k) => ktOrder(k.typeCode) > order);
    const item = { id: newId(), typeCode: kind.typeCode, name: kind.name };
    if (at < 0) p.kinds.push(item);
    else p.kinds.splice(at, 0, item);
  }
  if (!on && found && !kindInUse(p, found.id)) p.kinds = p.kinds.filter((k) => k !== found);
}

/** 名前付き列車は「ない」と答えたら、使っていない名前付きの種別を外す */
export function dropUnusedNamedKinds(p: Project): void {
  p.kinds = p.kinds.filter((k) => !isNamedKind(k) || kindInUse(p, k.id));
}

/** 名前付き列車を1つ足す（種別の後ろに入れる） */
export function addNamedKind(p: Project, typeCode: string): string {
  const id = newId();
  // 名前は愛称を入れてもらう（「特急」のままにしない）
  const item = { id, typeCode, trainNameCode: '', name: '' };
  const last = p.kinds.findLastIndex((k) => k.typeCode === typeCode);
  if (last < 0) p.kinds.push(item);
  else p.kinds.splice(last + 1, 0, item);
  return id;
}

/**
 * 駅がどの鉄道会社の駅かを変える。他の鉄道会社の駅にすると、自分の番号つき駅コードは空の文字列コードにする
 * （相手の駅コードを入れてもらう）。自分の駅に戻すと、空の文字列コードは続きの番号にする
 */
export function setStationOrg(p: Project, stationId: string, orgId: string): void {
  const st = p.stations.find((s) => s.id === stationId);
  if (!st || st.managerOrgId === orgId) return;
  st.managerOrgId = orgId;
  const self = orgId === p.selfOrgId;
  if (self) st.signsBySelf = true;
  const line = p.lines.find((l) => l.orgId === p.selfOrgId);
  for (const c of st.codes) {
    if (!self && c.code.kind === 'numbered' && c.code.orgId === p.selfOrgId) {
      c.code = { kind: 'free', value: '' };
    } else if (self && line && c.code.kind === 'free' && !c.code.value) {
      const numbers = p.stations.flatMap((s) =>
        s.codes.flatMap((x) =>
          x.code.kind === 'numbered' && x.code.lineId === line.id ? [x.code.number] : [],
        ),
      );
      c.code = {
        kind: 'numbered',
        orgId: p.selfOrgId,
        lineId: line.id,
        number: Math.max(0, ...numbers) + 1,
      };
    }
  }
}
