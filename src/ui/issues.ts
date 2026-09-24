// 検証結果の表示：記号・件数と、直し方、該当する入力の画面へのリンク（R9.1、docs/redesign.md §7）。

import type { Issue, IssueCode, IssueTarget, Severity } from '../domain/validate';

/**
 * 直す画面。初心者は質問に答える画面（setup）で直せるものはそこへ、
 * 自動推定の上書きや表でしか直せないものは詳しく編集・資料へ送る。
 */
export function issueLink(projectId: string, t: IssueTarget): string {
  const base = `/p/${projectId}`;
  switch (t.kind) {
    case 'org':
    case 'line':
    case 'kind':
      return `${base}/setup/0?details=1`;
    case 'station':
      return `${base}/setup/1?station=${encodeURIComponent(t.stationId)}`;
    case 'platform':
      return `${base}/setup/2?station=${encodeURIComponent(t.stationId)}&platform=${t.platform}`;
    case 'service':
      return `${base}/setup/3?service=${encodeURIComponent(t.serviceId)}`;
    case 'departure':
      return `${base}/edit/review?service=${encodeURIComponent(t.serviceId)}`;
    case 'route':
      return `${base}/docs/routes`;
    case 'formation':
      return `${base}/docs/formations`;
  }
}

/** 検証コードごとの「どう直すか」。メッセージ（何が問題か）の下に出す */
export const ISSUE_HINTS: Record<IssueCode, string> = {
  DEST_DUP:
    '同じ行先コードが2つののりばに付いています。のりば番号か、行先に使う駅コードを変えてください。',
  ROUTE_CODE_CONFLICT:
    '同じ区間でも通るのりばが違う系統があります。系統の経由リストののりばを見直すか、「経路に入れる駅」の上書きで揃えてください。',
  FORMATION_CONFLICT:
    '同じ形式コードの列車に違う設定（最高速度など）が付いています。系統ごとの形式コードか設定を揃えてください。',
  PLATFORM_DIR_MISSING:
    'ホームに立って線路を見たとき、列車が左右どちらへ出ていくかを選んでください。',
  SERVICE_NO_TERMINAL:
    '終点の駅で列車が入るのりばを選んでください。終点に看板を置かないと列車が止まりません。',
  SERVICE_TOO_SHORT: '始発と終点を含めて、列車が通る駅を2つ以上並べてください。',
  KIND_NO_STOP:
    'この種類の列車は、どこからも出発しない設定になっています。停車駅の表で ○ を付けるか、この系統から外してください。',
  SKIP_MANUAL:
    '止まる列車と通過する列車の組み合わせが複雑で、看板の条件を自動で決められません。試運転で確かめながら手で調整してください。',
  FOREIGN_FORMATION_MISSING:
    '直通先の団体が決めた編成名を聞いて入れてください。空のままだとこの列車のコマンドは出ません。',
  FOREIGN_STATION:
    '相手の団体の駅です。行先コードとのりば番号が相手の設定と合っているか確かめてください（直さなくても看板とコマンドは出ます）。',
  FORM_PARITY:
    'KT式では下りは偶数、上りは奇数の形式番号を使います。系統の方向か形式コードを見直してください。',
  TERMINAL_THROUGH:
    '通り抜けできるのりばが終点です。折り返す線路なら「行き止まり」に印を付けてください。',
  MANY_SPAWNS:
    '列車を出す看板が多く並ぶので、ホームのレールが足りるか確かめてください（このままでも出力はできます）。',
  CODE_CHARS: 'コードには半角の英字と数字だけを使えます。全角文字・空白・記号を消してください。',
  PLATFORM_MISSING:
    '系統が通るのりばが駅にありません。駅にのりばを足すか、系統ののりばを選び直してください。',
};

export const SEVERITY_MARK: Record<Severity, { mark: string; label: string }> = {
  error: { mark: '✖', label: '直すところ' },
  warning: { mark: '⚠', label: '確認' },
  info: { mark: 'ℹ', label: 'お知らせ' },
};

export function issueCounts(issues: readonly Issue[]) {
  return {
    error: issues.filter((i) => i.severity === 'error').length,
    warning: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
  };
}
