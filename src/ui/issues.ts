// 検証結果の表示：記号・件数と、該当する入力の画面へのリンク（R9.1）。

import type { Issue, IssueTarget, Severity } from '../domain/validate';

export function issueLink(projectId: string, t: IssueTarget): string {
  const base = `/p/${projectId}`;
  switch (t.kind) {
    case 'org':
    case 'line':
      return `${base}/edit/org`;
    case 'kind':
      return `${base}/edit/kinds`;
    case 'station':
      return `${base}/edit/stations?station=${encodeURIComponent(t.stationId)}`;
    case 'platform':
      return `${base}/edit/stations?station=${encodeURIComponent(t.stationId)}&platform=${t.platform}`;
    case 'service':
      return `${base}/edit/services?service=${encodeURIComponent(t.serviceId)}`;
    case 'departure':
      return `${base}/setup/6?service=${encodeURIComponent(t.serviceId)}`;
    case 'route':
      return `${base}/docs/routes`;
    case 'formation':
      return `${base}/docs/formations`;
  }
}

export const SEVERITY_MARK: Record<Severity, { mark: string; label: string }> = {
  error: { mark: '✖', label: 'エラー' },
  warning: { mark: '⚠', label: '警告' },
  info: { mark: 'ℹ', label: '情報' },
};

export function issueCounts(issues: readonly Issue[]) {
  return {
    error: issues.filter((i) => i.severity === 'error').length,
    warning: issues.filter((i) => i.severity === 'warning').length,
    info: issues.filter((i) => i.severity === 'info').length,
  };
}
