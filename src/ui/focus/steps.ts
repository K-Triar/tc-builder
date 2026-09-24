// はじめての質問（集中モード、docs/redesign2.md §2）の順番。React を使わない純粋な関数。
// パスはすべて `/p/:id/start/` のあと。

import type { Guide } from '../../domain/model';

/** 大きな段（A 路線網の準備・B 駅・C のりば・D 列車の走り方） */
export type FocusSection = 'A' | 'B' | 'C' | 'D';

export const SECTION_LABEL: Record<FocusSection, string> = {
  A: '路線網の準備',
  B: '駅',
  C: 'のりば',
  D: '列車の走り方',
};

/** A 路線網の準備の質問（through-orgs は「乗り入れる」と答えたときだけ） */
export const SETUP_QUESTIONS = [
  'name',
  'company',
  'through',
  'through-orgs',
  'lines',
  'kinds',
  'named',
  'check',
] as const;

export type SetupQuestion = (typeof SETUP_QUESTIONS)[number];

export const isSetupQuestion = (q: string): q is SetupQuestion =>
  (SETUP_QUESTIONS as readonly string[]).includes(q);

/** 答えによって出す質問 */
export function setupQuestions(guide: Guide | undefined): SetupQuestion[] {
  return SETUP_QUESTIONS.filter((q) => q !== 'through-orgs' || guide?.through === 'yes');
}

/** 次の質問（最後なら駅の登録） */
export function nextSetup(q: SetupQuestion, guide: Guide | undefined): string {
  const list = setupQuestions(guide);
  return list[list.indexOf(q) + 1] ?? 'stations';
}

/** 前の質問（最初なら undefined） */
export function prevSetup(q: SetupQuestion, guide: Guide | undefined): SetupQuestion | undefined {
  const list = setupQuestions(guide);
  const i = list.indexOf(q);
  return i > 0 ? list[i - 1] : undefined;
}

/** 列車の走り方を作る小さな質問（①〜⑦。① は作る前なので trains/new） */
export const TRAIN_QUESTIONS = [
  'ends',
  'route',
  'platforms',
  'kinds',
  'stops',
  'name',
  'reverse',
] as const;

export type TrainQuestion = (typeof TRAIN_QUESTIONS)[number];

export const TRAIN_MARK = ['①', '②', '③', '④', '⑤', '⑥', '⑦'] as const;

export const isTrainQuestion = (q: string): q is TrainQuestion =>
  (TRAIN_QUESTIONS as readonly string[]).includes(q);

const SECTION_START: Record<FocusSection, number> = { A: 0, B: 0.3, C: 0.4, D: 0.65 };
const SECTION_END: Record<FocusSection, number> = { A: 0.3, B: 0.4, C: 0.65, D: 1 };

/** 進み具合のバー（0〜1）。段の中の位置 pos / total で段の幅を埋める */
export function focusProgress(section: FocusSection, pos: number, total: number): number {
  const start = SECTION_START[section];
  const width = SECTION_END[section] - start;
  const ratio = total > 0 ? Math.min(Math.max(pos / total, 0), 1) : 0;
  return start + width * ratio;
}
