// コード体系（rules §2）：駅コード・行先コード・経路コード・編成コード・形式コード・タグ。

import type { Kind, Project, StationCode } from './model';

/** 鉄道会社・路線の ID を解決した駅コード */
export type CodeParts =
  | { kind: 'numbered'; org: string; line: string; number: number; self: boolean }
  | { kind: 'free'; value: string };

/** 行先（駅コード + のりば番号） */
export interface Dest {
  code: CodeParts;
  platform: number;
}

export interface CodeContext {
  selfOrgId: string;
  orgCodes: ReadonlyMap<string, string>;
  lineCodes: ReadonlyMap<string, string>;
}

export function codeContext(p: Pick<Project, 'selfOrgId' | 'orgs' | 'lines'>): CodeContext {
  return {
    selfOrgId: p.selfOrgId,
    orgCodes: new Map(p.orgs.map((o) => [o.id, o.code])),
    lineCodes: new Map(p.lines.map((l) => [l.id, l.code])),
  };
}

export function resolveStationCode(code: StationCode, ctx: CodeContext): CodeParts {
  if (code.kind === 'free') return { kind: 'free', value: code.value };
  return {
    kind: 'numbered',
    org: ctx.orgCodes.get(code.orgId) ?? '?',
    line: ctx.lineCodes.get(code.lineId) ?? '?',
    number: code.number,
    self: code.orgId === ctx.selfOrgId,
  };
}

/** 駅コード（KL04、IIA） */
export function stationCodeText(c: CodeParts): string {
  if (c.kind === 'free') return c.value;
  return `${c.org}${c.line}${String(c.number).padStart(2, '0')}`;
}

/** 行先コード（KL04-2） */
export function destText(d: Dest): string {
  return `${stationCodeText(d.code)}-${d.platform}`;
}

/** 経路コードの始点側（KL04 → KL4） */
export function short(c: CodeParts): string {
  if (c.kind === 'free') return c.value;
  return `${c.org}${c.line}${c.number}`;
}

/** 経路コードの終点側（自分の鉄道会社の KL13 → L13） */
export function shortEnd(c: CodeParts): string {
  if (c.kind === 'numbered' && c.self) return `${c.line}${c.number}`;
  return short(c);
}

/** 経路コード（rules §2.3）。空の経路は空文字 */
export function routeCode(route: readonly Dest[]): string {
  const first = route[0];
  const last = route[route.length - 1];
  if (!first || !last) return '';
  if (stationCodeText(first.code) === stationCodeText(last.code)) return short(first.code);
  return short(first.code) + shortEnd(last.code);
}

/** 編成コード（rules §2.4） */
export function formationCode(formation: string, route: string, tag: string): string {
  return `${formation}_${route}_${tag}`;
}

/** タグ（rules §2.6） */
export function kindTag(kind: Pick<Kind, 'typeCode' | 'trainNameCode'>): string {
  return kind.trainNameCode ? `${kind.typeCode}-${kind.trainNameCode}` : kind.typeCode;
}

/** 形式コード（鉄道会社 + 用途番号1桁 + 形式番号2桁）を分解する。形が合わなければ undefined */
export function parseFormCode(
  form: string,
): { org: string; usage: string; number: string } | undefined {
  const [, org, usage, number] = /^(.+?)(\d)(\d{2})$/.exec(form) ?? [];
  if (org === undefined || usage === undefined || number === undefined) return undefined;
  return { org, usage, number };
}

/** 形式番号の一の位：奇数＝上り、偶数＝下り（rules §2.5） */
export function formParity(form: string): 'up' | 'down' | undefined {
  const f = parseFormCode(form);
  if (!f) return undefined;
  return Number(f.number) % 2 === 1 ? 'up' : 'down';
}

/** 反対方向の対の形式コード（K301 ↔ K300） */
export function pairedFormCode(form: string): string | undefined {
  const f = parseFormCode(form);
  if (!f) return undefined;
  const n = Number(f.number);
  const paired = n % 2 === 1 ? n - 1 : n + 1;
  return `${f.org}${f.usage}${String(paired).padStart(2, '0')}`;
}
