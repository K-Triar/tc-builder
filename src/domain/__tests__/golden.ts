// T14：瑠璃線サンプルの出力を Excel（expected.json）と比べ、差分を読みやすい文にする。

import type { Derived } from '../derive';
import type { Project } from '../model';

export interface Expected {
  routes: { code: string; dests: string[] }[];
  formations: {
    code: string;
    formation: string;
    tag: string;
    routeCode: string;
    maxSpeed: number;
    mobCollision: string;
    playerCollision: string;
  }[];
  departures: {
    station: string;
    stationCode: string;
    description: string;
    platform: number | null;
    formationCode: string;
  }[];
  signs: {
    station: string | null;
    title: string;
    titleCell: string;
    platform: number;
    destCode: string | null;
    foreign: string | null;
    order: 'ltr' | 'rtl' | null;
    signs: string[][];
  }[];
}

export interface GoldenDiff {
  /** 差分の種類と場所（confirmed.json のキー） */
  key: string;
  message: string;
}

export function goldenDiffs(project: Project, d: Derived, expected: Expected): GoldenDiff[] {
  const diffs: GoldenDiff[] = [];
  const add = (key: string, message: string) => diffs.push({ key, message });

  // ---- 経路 ----
  const ours = new Map(d.routes.map((r) => [r.code, r.dests]));
  for (const r of expected.routes) {
    const o = ours.get(r.code);
    if (!o) add(`route-missing:${r.code}`, `経路 ${r.code}（${r.dests.join(' ')}）が出力にない`);
    else if (o.join(' ') !== r.dests.join(' ')) {
      add(
        `route-dests:${r.code}`,
        `経路 ${r.code} の中身が違う：Excel ${r.dests.join(' ')}／出力 ${o.join(' ')}`,
      );
    }
  }
  const expectedRoutes = new Set(expected.routes.map((r) => r.code));
  for (const r of d.routes) {
    if (!expectedRoutes.has(r.code)) {
      add(
        `route-extra:${r.code}`,
        `経路 ${r.code}（${r.dests.join(' ')}）は Excel にない（使う編成：${r.usedBy.join('、') || 'なし'}）`,
      );
    }
  }

  // ---- 編成 ----
  const formations = new Map(d.formations.map((f) => [f.code, f]));
  for (const f of expected.formations) {
    const o = formations.get(f.code);
    if (!o) {
      add(`formation-missing:${f.code}`, `編成 ${f.code} が出力にない`);
      continue;
    }
    const fields: string[] = [];
    if (o.maxSpeed !== f.maxSpeed) fields.push(`最高速度 Excel ${f.maxSpeed}／出力 ${o.maxSpeed}`);
    if (o.tag !== f.tag) fields.push(`タグ Excel ${f.tag}／出力 ${o.tag}`);
    if (o.routeCode !== f.routeCode) fields.push(`経路 Excel ${f.routeCode}／出力 ${o.routeCode}`);
    if (o.mobCollision !== f.mobCollision || o.playerCollision !== f.playerCollision)
      fields.push('衝突設定');
    if (fields.length > 0)
      add(`formation-fields:${f.code}`, `編成 ${f.code}：${fields.join('、')}`);
  }
  const expectedFormations = new Set(expected.formations.map((f) => f.code));
  for (const f of d.formations) {
    if (!expectedFormations.has(f.code))
      add(`formation-extra:${f.code}`, `編成 ${f.code} は Excel にない`);
  }

  // ---- 各駅発 ----
  const stationByCode = new Map<string, { id: string; name: string }>();
  for (const s of project.stations) {
    for (const c of s.codes) {
      const text =
        c.code.kind === 'free'
          ? c.code.value
          : `K${c.code.lineId.slice(5)}${String(c.code.number).padStart(2, '0')}`;
      stationByCode.set(text, s);
    }
  }
  const depKey = (stationId: string, platform: number | null, code: string) =>
    `${stationId}#${platform}|${code}`;
  const ourDeps = new Set(
    d.departures
      .filter((x) => x.formationCode)
      .map((x) => depKey(x.stationId, x.platform, x.formationCode!)),
  );
  const matchedOur = new Set<string>();
  for (const e of expected.departures) {
    const st = stationByCode.get(e.stationCode);
    if (!st) {
      add(
        `departure-station:${e.stationCode}`,
        `各駅発：駅コード ${e.stationCode} の駅がサンプルにない`,
      );
      continue;
    }
    const label = `${st.name} ${e.platform}番 ${e.formationCode}`;
    if (e.formationCode.startsWith('[') || e.formationCode.startsWith('(')) {
      // [HRA設定]_KB2NSC_Ra のように他団体が決める部分がある
      const suffix = e.formationCode.replace(/^\[[^\]]*\]/, '');
      const hit = [...ourDeps].find(
        (k) =>
          k.startsWith(`${st.id}#${e.platform}|`) &&
          suffix !== e.formationCode &&
          k.endsWith(suffix),
      );
      if (hit) matchedOur.add(hit);
      else
        add(
          `departure-foreign:${st.id}#${e.platform}|${e.formationCode}`,
          `各駅発：${label}（${e.description}）に当たる出力がない`,
        );
      continue;
    }
    const key = depKey(st.id, e.platform, e.formationCode);
    if (ourDeps.has(key)) matchedOur.add(key);
    else add(`departure-missing:${key}`, `各駅発：${label}（${e.description}）が出力にない`);
  }
  for (const k of ourDeps) {
    if (matchedOur.has(k)) continue;
    const [pf, code] = k.split('|');
    const [sid, n] = pf!.split('#');
    const name = project.stations.find((s) => s.id === sid)?.name;
    add(`departure-extra:${k}`, `各駅発：${name} ${n}番 ${code} は Excel にない`);
  }

  // ---- 看板 ----
  const cards = new Map(d.platformCards.map((c) => [c.destCode, c]));
  const seen = new Set<string>();
  const show = (signs: string[][]) => signs.map((s) => s.filter(Boolean).join(' / ')).join(' → ');
  for (const b of expected.signs) {
    if (b.foreign || !b.destCode) continue;
    const card = cards.get(b.destCode);
    const where = `${b.station} ${b.platform}番（${b.destCode}、Excel ${b.titleCell}）`;
    if (!card) {
      add(`sign-missing:${b.destCode}`, `看板：${where} のカードが出力にない`);
      continue;
    }
    seen.add(card.id);
    const ourText = show(card.signs.map((s) => [...s.lines]));
    const ltr = show(b.signs);
    const rtl = show([...b.signs].reverse());
    const excelText = b.order === 'rtl' ? rtl : ltr;
    if (b.order !== null) {
      if (ourText !== excelText) {
        add(
          `sign:${b.destCode}`,
          `看板：${where}\n    Excel（進行方向順）${excelText}\n    出力（パターン ${card.pattern}）${ourText}`,
        );
      }
    } else if (ourText !== ltr && ourText !== rtl) {
      add(
        `sign:${b.destCode}`,
        `看板：${where}（Excel は向きの矢印が読めない。図の左から）\n    Excel ${ltr}\n    出力（パターン ${card.pattern}）${ourText}`,
      );
    }
  }
  for (const c of d.platformCards) {
    if (c.pattern === 'foreign' || seen.has(c.id)) continue;
    add(
      `sign-extra:${c.destCode}`,
      `看板：${c.destCode}（パターン ${c.pattern}）は Excel の駅看板表にない`,
    );
  }

  return diffs;
}
