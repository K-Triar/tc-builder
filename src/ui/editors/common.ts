// 入力画面で共通に使う道具（コンポーネント以外）。

import { codeContext, resolveStationCode, stationCodeText } from '../../domain/codes';
import type { Project, Station } from '../../domain/model';

export const newId = () => globalThis.crypto.randomUUID();

/** 駅の駅コードをまとめた表示（KL04・KU01） */
export function stationCodesText(project: Project, station: Station): string {
  const ctx = codeContext(project);
  return station.codes.map((c) => stationCodeText(resolveStationCode(c.code, ctx))).join('・');
}

/** 駅コード1つの表示 */
export function codeText(project: Project, station: Station, codeId: string): string {
  const c = station.codes.find((x) => x.id === codeId);
  return c ? stationCodeText(resolveStationCode(c.code, codeContext(project))) : '?';
}

/** 表示用の駅名（駅コードつき） */
export function stationLabel(project: Project, stationId: string): string {
  const s = project.stations.find((x) => x.id === stationId);
  if (!s) return '（消した駅）';
  const codes = stationCodesText(project, s);
  return codes ? `${s.name}（${codes}）` : s.name;
}

export const isSelfStation = (project: Project, s: Station) => s.managerOrgId === project.selfOrgId;

/** 見つかるはずの要素を取り出す（見つからなければ例外） */
export function must<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error('対象が見つかりません');
  return value;
}
