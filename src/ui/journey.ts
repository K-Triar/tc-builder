// 路線ができるまでの道のり（docs/redesign.md §5・§8）。
// 入力5段（路線・駅・のりば・列車・自動生成）と作業3段（コマンド・看板・試運転）、完成までを
// 1本の路線図として扱い、どこまで済んだか・次に何をするかを入力と出力から決める。
// React を使わない純粋な関数にしてテストする。

import type { Derived } from '../domain/derive';
import type { Project, Station } from '../domain/model';
import { workStatus, type WorkItem } from '../domain/progress';
import type { IssueTarget, Severity } from '../domain/validate';

export type StageKey =
  | 'line'
  | 'stations'
  | 'platforms'
  | 'trains'
  | 'generate'
  | 'commands'
  | 'signs'
  | 'trial'
  | 'done';

export interface StageDef {
  key: StageKey;
  /** 路線図の駅名（短い） */
  label: string;
  /** 画面の見出し */
  title: string;
  /** プロジェクトの中のパス（`/p/:id/` のあと） */
  path: string;
}

export const STAGES: readonly StageDef[] = [
  { key: 'line', label: '路線', title: '路線について', path: 'setup/0' },
  { key: 'stations', label: '駅', title: '駅を登録する', path: 'setup/1' },
  { key: 'platforms', label: 'のりば', title: 'のりばを設定する', path: 'setup/2' },
  { key: 'trains', label: '列車', title: '列車の走り方を決める', path: 'setup/3' },
  { key: 'generate', label: '自動生成', title: '設定を自動でつくる', path: 'setup/4' },
  { key: 'commands', label: 'コマンド', title: 'コマンドを打つ', path: 'work/commands' },
  { key: 'signs', label: '看板', title: '看板を置く', path: 'work/signs' },
  { key: 'trial', label: '試運転', title: '試運転する', path: 'work/trial' },
  { key: 'done', label: '完成', title: '完成', path: '' },
];

/** 質問に答える段（ウィザード）の数 */
export const SETUP_STAGE_COUNT = 5;

export const stageIndex = (key: StageKey) => STAGES.findIndex((s) => s.key === key);

/** 検証の対象を、それを直す段に対応させる */
export const STAGE_OF_TARGET: Record<IssueTarget['kind'], StageKey> = {
  org: 'line',
  line: 'line',
  kind: 'line',
  station: 'stations',
  platform: 'platforms',
  service: 'trains',
  formation: 'trains',
  departure: 'generate',
  route: 'generate',
};

export interface Count {
  done: number;
  total: number;
}

export interface Stage extends StageDef {
  done: boolean;
  /** 作業の段の件数 */
  count?: Count;
  /** この段で直すべき問題 */
  issues: Record<Severity, number>;
}

export interface NextAction {
  stage: StageKey;
  /** 「瑠璃中央 ののりばの向きを決める」のような、次にやることの文 */
  title: string;
  /** なぜ・どうやって（1文） */
  detail: string;
  /** プロジェクトの中のパス（検索条件つき） */
  path: string;
  /** ボタンの文字 */
  cta: string;
}

export interface Journey {
  stages: Stage[];
  /** 最初のまだ済んでいない段（すべて済めば「完成」） */
  current: number;
  next: NextAction;
  /** 作業（コマンド・看板・試運転）全体の件数 */
  work: Count;
}

const q = (key: string, value: string) => `?${key}=${encodeURIComponent(value)}`;

/** 看板を自分で置く駅（向きなどを入れる必要がある） */
export function needsSigns(project: Project, s: Station): boolean {
  return s.managerOrgId === project.selfOrgId || s.signsBySelf;
}

/** 看板を置く駅で、向きが決まっていないのりばがあるか */
export function stationNeedsDirs(project: Project, s: Station): boolean {
  return needsSigns(project, s) && s.platforms.some((p) => !p.dir);
}

function countOf(project: Project, items: readonly WorkItem[]): Count {
  return {
    done: items.filter((i) => workStatus(project.progress, i) === 'done').length,
    total: items.length,
  };
}

const complete = (c: Count) => c.total > 0 && c.done === c.total;

export function journey(
  project: Project,
  derived: Derived,
  workItems: readonly WorkItem[],
): Journey {
  const issues = Object.fromEntries(
    STAGES.map((s) => [s.key, { error: 0, warning: 0, info: 0 }]),
  ) as Record<StageKey, Record<Severity, number>>;
  for (const issue of derived.issues) issues[STAGE_OF_TARGET[issue.target.kind]][issue.severity]++;
  const noErrors = (k: StageKey) => issues[k].error === 0;

  const selfOrg = project.orgs.find((o) => o.id === project.selfOrgId);
  const selfLines = project.lines.filter((l) => l.orgId === project.selfOrgId && l.code);
  const lineDone =
    !!selfOrg?.code &&
    selfLines.length > 0 &&
    project.kinds.some((k) => k.typeCode) &&
    noErrors('line');

  const unnamed = project.stations.find((s) => !s.name.trim());
  const stationsDone = project.stations.length >= 2 && !unnamed && noErrors('stations');

  const dirMissing = project.stations.find((s) => stationNeedsDirs(project, s));
  const platformsDone = project.stations.length >= 2 && !dirMissing && noErrors('platforms');

  const unfinishedService = project.services.find(
    (s) => s.entries.length < 2 || s.kinds.length === 0,
  );
  const trainsDone = project.services.length > 0 && !unfinishedService && noErrors('trains');

  const inputsDone = lineDone && stationsDone && platformsDone && trainsDone;
  const generateDone = inputsDone && !derived.hasErrors;

  const commandItems = workItems.filter((i) => i.category === 'command');
  const installItems = workItems.filter((i) => i.category === 'install');
  const trialItems = workItems.filter((i) => i.category === 'trial');
  const counts = {
    commands: countOf(project, commandItems),
    signs: countOf(project, installItems),
    trial: countOf(project, trialItems),
  };
  const commandsDone = generateDone && complete(counts.commands);
  // 看板を置くのりばがない（すべて他団体）なら、看板の段は済みとみなす
  const signsDone = generateDone && (installItems.length === 0 || complete(counts.signs));
  const trialDone = generateDone && complete(counts.trial);

  const doneOf: Record<StageKey, boolean> = {
    line: lineDone,
    stations: stationsDone,
    platforms: platformsDone,
    trains: trainsDone,
    generate: generateDone,
    commands: commandsDone,
    signs: signsDone,
    trial: trialDone,
    done: generateDone && commandsDone && signsDone && trialDone,
  };

  const stages: Stage[] = STAGES.map((def) => ({
    ...def,
    done: doneOf[def.key],
    issues: issues[def.key],
    count:
      def.key === 'commands' || def.key === 'signs' || def.key === 'trial'
        ? counts[def.key]
        : undefined,
  }));
  const current = Math.max(
    0,
    stages.findIndex((s) => !s.done),
  );
  const firstUndone = (items: readonly WorkItem[]) =>
    items.find((i) => workStatus(project.progress, i) !== 'done');

  const next = ((): NextAction => {
    const stage = stages[current]?.key ?? 'done';
    if (stages.every((s) => s.done)) {
      return {
        stage: 'done',
        title: '路線が完成しました',
        detail: '入力を変えたときは、変わった看板やコマンドに「要更新」の印が付きます。',
        path: 'work/trial',
        cta: '試運転の記録を見る',
      };
    }
    switch (stage) {
      case 'line':
        return {
          stage,
          title: '路線の名前と、使う設定を決める',
          detail: 'どの団体の路線か、どんな種類の列車が走るかを確かめます。',
          path: 'setup/0',
          cta: '始める',
        };
      case 'stations':
        return {
          stage,
          title: unnamed ? '名前のない駅に名前を付ける' : '列車が通る駅を登録する',
          detail: '通過するだけの駅や、直通先の他団体の駅も入れます。',
          path: 'setup/1',
          cta: '駅を登録する',
        };
      case 'platforms':
        return {
          stage,
          title: dirMissing
            ? `${dirMissing.name || '名前のない駅'} ののりばの向きを決める`
            : 'のりばを確かめる',
          detail: 'ホームに立って線路を見たとき、列車がどちらへ出ていくかを選びます。',
          path: `setup/2${dirMissing ? q('station', dirMissing.id) : ''}`,
          cta: 'のりばを設定する',
        };
      case 'trains':
        return {
          stage,
          title: unfinishedService
            ? `「${unfinishedService.name || '名前のない系統'}」の通る駅と列車の種類を決める`
            : project.services.length === 0
              ? 'どこからどこへ列車が走るかを決める'
              : '列車の走り方を直す',
          detail: '始発から終点まで、列車が通る駅とのりば、止まる駅を選びます。',
          path: `setup/3${unfinishedService ? q('service', unfinishedService.id) : ''}`,
          cta: '列車の走り方を決める',
        };
      case 'generate':
        return {
          stage,
          title: `直すところが ${derived.issues.filter((i) => i.severity === 'error').length} 件あります`,
          detail: '直すと、看板とコマンドが自動でできあがります。',
          path: 'setup/4',
          cta: '直すところを見る',
        };
      case 'commands': {
        const item = firstUndone(commandItems);
        return {
          stage,
          title: 'ゲーム内のチャットで、経路と編成を登録する',
          detail: `コマンドを1行ずつコピーして打ちます。次は「${item?.label ?? ''}」。`,
          path: 'work/commands',
          cta: 'コマンドを打つ',
        };
      }
      case 'signs': {
        const item = firstUndone(installItems);
        const stationId = item?.id.slice('install:'.length).split('#')[0];
        return {
          stage,
          title: `${item?.label ?? ''}のりばに看板を置く`,
          detail: 'ホームから見て左からこの順に、看板に書く文字を1行ずつコピーして置きます。',
          path: `work/signs${stationId ? q('station', stationId) : ''}`,
          cta: '看板を置く',
        };
      }
      case 'trial':
      default: {
        const item = firstUndone(trialItems);
        const id = item?.id ?? '';
        if (id.startsWith('trial:service:')) {
          const service = project.services.find((s) => s.id === id.slice('trial:service:'.length));
          return {
            stage: 'trial',
            title: `「${service?.name || '名前のない系統'}」を始発から終点まで走らせる`,
            detail:
              '止まる駅で止まり、通過する駅を通過し、分かれ道で正しい方へ進むかを確かめます。',
            path: 'work/trial',
            cta: '試運転する',
          };
        }
        if (id.startsWith('trial:') && id.includes('#')) {
          const cardId = id.slice('trial:'.length);
          return {
            stage: 'trial',
            title: `${item?.label ?? ''}のりばで列車を出して確かめる`,
            detail: '列車が正しい向きに出て、行先どおりに走るかを確かめます。',
            path: `work/signs${q('station', cardId.split('#')[0] ?? '')}`,
            cta: '試運転する',
          };
        }
        return {
          stage: 'trial',
          title: '仕上げの確認をする',
          detail: `次は「${item?.label ?? ''}」。`,
          path: 'work/trial',
          cta: '試運転する',
        };
      }
    }
  })();

  const all = [counts.commands, counts.signs, counts.trial];
  return {
    stages,
    current: stages.every((s) => s.done) ? stages.length - 1 : current,
    next,
    work: {
      done: all.reduce((n, c) => n + c.done, 0),
      total: all.reduce((n, c) => n + c.total, 0),
    },
  };
}
