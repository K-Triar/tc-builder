// 資料タブの表（R8）。画面・印刷・TSV コピーで同じ中身を使う。

import { kindTag } from '../../domain/codes';
import type { Derived } from '../../domain/derive';
import { formatSpeed } from '../../domain/commands';
import type { Project } from '../../domain/model';

export interface Table {
  title: string;
  headers: string[];
  rows: string[][];
}

/** 表計算ソフトに貼れるタブ区切り（セル内のタブ・改行は空白にする） */
export function toTsv(t: Pick<Table, 'headers' | 'rows'>): string {
  const clean = (s: string) => s.replace(/[\t\r\n]+/g, ' ');
  return [t.headers, ...t.rows].map((r) => r.map(clean).join('\t')).join('\n');
}

const stationName = (d: Derived, id: string) => d.lookup.station(id)?.name ?? '?';

export function routesTable(d: Derived): Table {
  return {
    title: '経路一覧',
    headers: ['経路コード', '経路（行先コードの並び）', '使う編成'],
    rows: d.routes.map((r) => [r.code, r.dests.join(' → '), r.usedBy.join('、')]),
  };
}

export function formationsTable(d: Derived): Table {
  return {
    title: '編成一覧',
    headers: [
      '編成コード',
      '形式',
      '経路コード',
      'タグ',
      '最高速度',
      'mob 衝突',
      'プレイヤー衝突',
      '両数',
      '発駅',
    ],
    rows: d.formations.map((f) => [
      f.code,
      f.foreign ? '（他の鉄道会社）' : f.formation,
      f.routeCode,
      f.tag,
      formatSpeed(f.maxSpeed),
      f.mobCollision,
      f.playerCollision,
      f.cars ?? '',
      f.departures.map((x) => `${stationName(d, x.stationId)} ${x.platform}番`).join('、'),
    ]),
  };
}

export function departuresTable(project: Project, d: Derived): Table {
  const serviceName = new Map(project.services.map((s) => [s.id, s.name]));
  const order = new Map(project.stations.map((s, i) => [s.id, i]));
  const rows = [...d.departures].sort(
    (a, b) =>
      (order.get(a.stationId) ?? 0) - (order.get(b.stationId) ?? 0) || a.platform - b.platform,
  );
  return {
    title: '各駅発編成一覧',
    headers: ['駅', 'のりば', '行先コード', '編成コード', '列車の走り方', '上書き'],
    rows: rows.map((x) => [
      stationName(d, x.stationId),
      `${x.platform}`,
      d.lookup.destText(x.stationId, x.platform),
      x.formationCode ?? '要確認',
      serviceName.get(x.serviceId) ?? '',
      x.overridden ? 'あり' : '',
    ]),
  };
}

/** 系統ごとの停車駅表（Excel 種別表と同じ見方） */
export function stopTables(project: Project, d: Derived): Table[] {
  return project.services.map((s, si) => {
    const kinds = s.kinds.map((k) => project.kinds.find((x) => x.id === k.kindId));
    return {
      title: `${s.name || '（名前なし）'}（${s.direction === 'up' ? '上り' : '下り'}）${s.throughNote ? ` 直通：${s.throughNote}` : ''}`,
      headers: [
        '駅',
        '行先コード',
        '経路に入れる',
        ...kinds.map((k) => (k ? `${k.name}（${kindTag(k)}）` : '?')),
      ],
      rows: s.entries.map((e, i) => [
        stationName(d, e.stationId),
        e.platform === null ? '未定' : d.lookup.destText(e.stationId, e.platform),
        d.choices[si]?.[i]?.chosen ? '○' : '',
        ...s.kinds.map((k) => (k.stops[i] ? '○' : '通過')),
      ]),
    };
  });
}
