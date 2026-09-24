// 検証（rules §6）。エラーは出力を止め、警告・情報は出力したうえで知らせる。

import { computeChoices, type ChoiceInfo } from './choice';
import { formParity, pairedFormCode, parseFormCode } from './codes';
import { createLookup, type Lookup } from './lookup';
import type { Project } from './model';
import { summarizePlatforms, type PlatformSummary } from './platforms';
import { computeRoutes, type FormationDef, type RoutesResult } from './routes';
import { buildSigns, type SignsResult } from './signs';

export type IssueCode =
  | 'DEST_DUP'
  | 'ROUTE_CODE_CONFLICT'
  | 'FORMATION_CONFLICT'
  | 'PLATFORM_DIR_MISSING'
  | 'SERVICE_NO_TERMINAL'
  | 'SERVICE_TOO_SHORT'
  | 'KIND_NO_STOP'
  | 'SKIP_MANUAL'
  | 'FOREIGN_FORMATION_MISSING'
  | 'FOREIGN_STATION'
  | 'FORM_PARITY'
  | 'TERMINAL_THROUGH'
  | 'MANY_SPAWNS'
  | 'CODE_CHARS'
  | 'PLATFORM_MISSING';

export type Severity = 'error' | 'warning' | 'info';

/** 該当する入力（画面で飛ぶ先） */
export type IssueTarget =
  | { kind: 'org'; orgId: string }
  | { kind: 'line'; lineId: string }
  | { kind: 'kind'; kindId: string }
  | { kind: 'station'; stationId: string }
  | { kind: 'platform'; stationId: string; platform: number }
  | { kind: 'service'; serviceId: string; kindId?: string; entryIndex?: number }
  | { kind: 'departure'; serviceId: string; kindId: string; entryIndex: number }
  | { kind: 'route'; code: string }
  | { kind: 'formation'; code: string };

export interface Issue {
  code: IssueCode;
  severity: Severity;
  message: string;
  target: IssueTarget;
}

const SEVERITY: Record<IssueCode, Severity> = {
  DEST_DUP: 'error',
  ROUTE_CODE_CONFLICT: 'error',
  FORMATION_CONFLICT: 'error',
  PLATFORM_DIR_MISSING: 'error',
  SERVICE_NO_TERMINAL: 'error',
  SERVICE_TOO_SHORT: 'error',
  KIND_NO_STOP: 'error',
  CODE_CHARS: 'error',
  PLATFORM_MISSING: 'error',
  SKIP_MANUAL: 'warning',
  FOREIGN_FORMATION_MISSING: 'warning',
  FORM_PARITY: 'warning',
  TERMINAL_THROUGH: 'warning',
  MANY_SPAWNS: 'warning',
  FOREIGN_STATION: 'info',
};

const FIELD_LABELS: Partial<Record<keyof FormationDef, string>> = {
  formation: '形式コード',
  route: '経路の中身',
  tag: 'タグ',
  maxSpeed: '最高速度',
  mobCollision: 'mob 衝突',
  playerCollision: 'プレイヤー衝突',
  cars: '両数',
};

/** コードに使える文字：空白以外の半角英数記号 */
/** TC に出るコード：半角の英字と数字だけ（rules §2.0） */
const TC_CODE_RE = /^[A-Za-z0-9]+$/;
/** 表示専用の駅コード・他の鉄道会社の編成名：空白と全角文字以外の半角文字 */
const LOOSE_CODE_RE = /^[\x21-\x7e]+$/;

export function validate(
  project: Project,
  deps: {
    lookup?: Lookup;
    choices?: ChoiceInfo[][];
    routes?: RoutesResult;
    summaries?: PlatformSummary[];
    signs?: SignsResult;
  } = {},
): Issue[] {
  const lookup = deps.lookup ?? createLookup(project);
  const choices = deps.choices ?? computeChoices(project);
  const routes = deps.routes ?? computeRoutes(project, choices, lookup);
  const summaries = deps.summaries ?? summarizePlatforms(project, routes, lookup);
  const signs = deps.signs ?? buildSigns(project, { lookup, choices, routes, summaries });

  const issues: Issue[] = [];
  const add = (code: IssueCode, message: string, target: IssueTarget) =>
    issues.push({ code, severity: SEVERITY[code], message, target });
  const stationName = (id: string) => lookup.station(id)?.name ?? '?';
  const platformName = (stationId: string, n: number) => `${stationName(stationId)} ${n}番`;
  const kindName = (id: string) => lookup.kind(id)?.name ?? '?';
  const selfCode = project.orgs.find((o) => o.id === project.selfOrgId)?.code;

  // ---- コードの文字 ----
  const checkCode = (value: string, what: string, target: IssueTarget, loose = false) => {
    if (value === '') add('CODE_CHARS', `${what}が空です。`, target);
    else if (loose ? !LOOSE_CODE_RE.test(value) : !TC_CODE_RE.test(value)) {
      add(
        'CODE_CHARS',
        loose
          ? `${what}「${value}」に空白や全角文字が含まれています。半角で入力してください。`
          : `${what}「${value}」には半角の英字と数字だけを使えます（記号・空白・全角文字は使えません）。`,
        target,
      );
    }
  };
  for (const o of project.orgs) {
    // 他の鉄道会社の鉄道会社コードは、番号つきの駅コードに使わない限り空でもよい
    if (o.code === '' && o.id !== project.selfOrgId) continue;
    checkCode(o.code, `鉄道会社「${o.name}」の鉄道会社コード`, { kind: 'org', orgId: o.id });
  }
  for (const l of project.lines)
    checkCode(l.code, `路線「${l.name}」の路線コード`, { kind: 'line', lineId: l.id });
  for (const k of project.kinds) {
    const target = { kind: 'kind', kindId: k.id } as const;
    checkCode(k.typeCode, `種別「${k.name}」の種別コード`, target);
    if (k.trainNameCode) checkCode(k.trainNameCode, `種別「${k.name}」の列車名コード`, target);
  }
  for (const s of project.stations) {
    // どののりばも行先に使わない駅コードは表示専用（LM-1 など）なので記号を許す
    const destCodeIds = new Set(s.platforms.map((pf) => pf.codeId));
    for (const c of s.codes) {
      if (c.code.kind === 'free') {
        const target = { kind: 'station', stationId: s.id } as const;
        checkCode(c.code.value, `${s.name} の駅コード`, target, !destCodeIds.has(c.id));
      }
    }
  }
  for (const v of project.services) {
    for (const k of v.kinds) {
      checkCode(k.formation, `${v.name}（${kindName(k.kindId)}）の形式コード`, {
        kind: 'service',
        serviceId: v.id,
        kindId: k.kindId,
      });
    }
  }
  for (const [key, o] of Object.entries(project.overrides.departure)) {
    const [serviceId = '', kindId = '', index = '0'] = key.split('#');
    const target = { kind: 'departure', serviceId, kindId, entryIndex: Number(index) } as const;
    if (o.formation !== undefined) checkCode(o.formation, '各駅発の形式コード', target);
    if (o.foreignName) checkCode(o.foreignName, '他の鉄道会社の編成名', target, true);
  }

  // ---- 行先コードの重複 ----
  const byDest = new Map<string, { stationId: string; platform: number }[]>();
  for (const s of project.stations) {
    for (const pf of s.platforms) {
      const text = lookup.destText(s.id, pf.number);
      byDest.set(text, [...(byDest.get(text) ?? []), { stationId: s.id, platform: pf.number }]);
    }
  }
  for (const [text, list] of byDest) {
    if (list.length < 2) continue;
    const where = list.map((x) => platformName(x.stationId, x.platform)).join('、');
    for (const x of list) {
      add('DEST_DUP', `行先コード ${text} が重複しています（${where}）。`, {
        kind: 'platform',
        ...x,
      });
    }
  }

  // ---- 系統 ----
  project.services.forEach((v) => {
    const m = v.entries.length - 1;
    if (v.entries.length < 2) {
      add('SERVICE_TOO_SHORT', `系統「${v.name}」の経由リストが2駅未満です。`, {
        kind: 'service',
        serviceId: v.id,
      });
    } else if (v.entries[m]?.platform === null) {
      const terminal = stationName(v.entries[m].stationId);
      add('SERVICE_NO_TERMINAL', `系統「${v.name}」の終点（${terminal}）ののりばが未定です。`, {
        kind: 'service',
        serviceId: v.id,
        entryIndex: m,
      });
    }
    v.entries.forEach((e, i) => {
      if (e.platform !== null && !lookup.platform(e.stationId, e.platform)) {
        add(
          'PLATFORM_MISSING',
          `系統「${v.name}」が ${platformName(e.stationId, e.platform)} を通りますが、そののりばがありません。`,
          { kind: 'service', serviceId: v.id, entryIndex: i },
        );
      }
    });

    for (const k of v.kinds) {
      const hasMiddleStop = k.stops.some((s, i) => s && i > 0 && i < m);
      const hasDeparture = routes.departures.some(
        (d) => d.serviceId === v.id && d.kindId === k.kindId,
      );
      if (v.entries.length >= 2 && !hasMiddleStop && !hasDeparture) {
        add(
          'KIND_NO_STOP',
          `系統「${v.name}」の${kindName(k.kindId)}は、途中の停車駅も発駅もありません。入力を確かめてください。`,
          { kind: 'service', serviceId: v.id, kindId: k.kindId },
        );
      }
      const form = parseFormCode(k.formation);
      const parity = formParity(k.formation);
      if (form && form.org === selfCode && parity && parity !== v.direction) {
        const dirName = v.direction === 'up' ? '上り' : '下り';
        add(
          'FORM_PARITY',
          `系統「${v.name}」は${dirName}ですが、${kindName(k.kindId)}の形式 ${k.formation} は${parity === 'up' ? '上り（奇数）' : '下り（偶数）'}の番号です（${dirName}なら ${pairedFormCode(k.formation)}）。`,
          { kind: 'service', serviceId: v.id, kindId: k.kindId },
        );
      }
    }
  });

  // ---- 経路・編成の食い違い ----
  for (const c of routes.routeConflicts) {
    add(
      'ROUTE_CODE_CONFLICT',
      `経路コード ${c.code} に中身の違う経路があります：${c.variants.map((v) => v.join(' ')).join('／')}`,
      { kind: 'route', code: c.code },
    );
  }
  for (const c of routes.formationConflicts) {
    add(
      'FORMATION_CONFLICT',
      `編成 ${c.code} で ${c.fields.map((f) => FIELD_LABELS[f] ?? f).join('・')} が食い違っています。`,
      { kind: 'formation', code: c.code },
    );
  }
  for (const d of routes.departures) {
    if (d.foreign && d.formationCode === undefined) {
      add(
        'FOREIGN_FORMATION_MISSING',
        `${platformName(d.stationId, d.platform)} から出る${kindName(d.kindId)}は他の鉄道会社の編成です。編成名を入れてください（要確認）。`,
        { kind: 'departure', serviceId: d.serviceId, kindId: d.kindId, entryIndex: d.entryIndex },
      );
    }
  }

  // ---- のりば・駅 ----
  const summaryByKey = new Map(summaries.map((s) => [s.key, s]));
  for (const card of signs.platformCards) {
    const target = {
      kind: 'platform',
      stationId: card.stationId,
      platform: card.platform,
    } as const;
    const name = platformName(card.stationId, card.platform);
    if (card.pattern === 'foreign') continue;
    if (!card.dir) add('PLATFORM_DIR_MISSING', `${name} の進む向きが未入力です。`, target);
    if (card.skipManual) {
      const filled = project.overrides.skipCondition[card.id] !== undefined;
      add(
        'SKIP_MANUAL',
        `${name} の skip 条件を自動で決められません。${filled ? '手入力した条件を試運転で確かめてください。' : '3・4行目を手で入れてください。'}`,
        target,
      );
    }
    const s = summaryByKey.get(card.id);
    if (s?.isTerminal && !s.throughTerminal && (card.pattern === 'A' || card.pattern === 'B')) {
      add(
        'TERMINAL_THROUGH',
        `${name} は通り抜けできるのりばですが、終点になっています（乗客が降りない可能性）。`,
        target,
      );
    }
    const spawns = card.signs.filter((x) => x.kind === 'spawn').length;
    if (spawns >= 5) {
      add(
        'MANY_SPAWNS',
        `${name} に spawn 看板が ${spawns} 枚並びます。レールの長さに注意してください。`,
        target,
      );
    }
  }
  const usedStations = new Set(project.services.flatMap((v) => v.entries.map((e) => e.stationId)));
  for (const sc of signs.stationCards) {
    if (sc.foreign && usedStations.has(sc.stationId)) {
      add(
        'FOREIGN_STATION',
        `${sc.name} は相手の鉄道会社の管理です。行先コードとのりばをすり合わせてください。`,
        {
          kind: 'station',
          stationId: sc.stationId,
        },
      );
    }
  }

  const rank: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  return issues
    .map((issue, i) => ({ issue, i }))
    .sort((a, b) => rank[a.issue.severity] - rank[b.issue.severity] || a.i - b.i)
    .map((x) => x.issue);
}
