import { Link } from 'react-router';
import type { Issue } from '../../domain/validate';
import { ISSUE_HINTS, issueCounts, issueLink, SEVERITY_MARK } from '../issues';
import styles from './ValidationSummary.module.css';

/**
 * 検証の要約（docs/redesign.md §7 バリデーション）。
 * 問題がなければ1行の ✓ だけ。あれば「何が問題か」「どう直すか」「直しに行く」を並べる。
 */
export function ValidationSummary({
  projectId,
  issues,
  okText = '設定に問題はありません',
  max = 5,
  hideOk,
}: {
  projectId: string;
  issues: readonly Issue[];
  okText?: string;
  max?: number;
  /** 問題がないときは何も出さない */
  hideOk?: boolean;
}) {
  const shown = issues.filter((i) => i.severity !== 'info');
  const counts = issueCounts(shown);
  if (shown.length === 0) {
    return hideOk ? null : (
      <p className={styles.ok}>
        <span aria-hidden="true">✓</span> {okText}
      </p>
    );
  }
  const sorted = [...shown].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1,
  );
  return (
    <div className={`${styles.box} ${counts.error > 0 ? styles.error : styles.warning}`}>
      <p className={styles.title}>
        {counts.error > 0
          ? `直すところが ${counts.error} 件あります`
          : `確かめてほしいことが ${counts.warning} 件あります`}
        {counts.error > 0 && counts.warning > 0 && (
          <span className={styles.sub}>（ほかに確認 {counts.warning} 件）</span>
        )}
      </p>
      <ul className={styles.list}>
        {sorted.slice(0, max).map((issue, i) => (
          <li key={`${issue.code}-${i}`} className={styles[issue.severity]}>
            <span className={styles.mark} aria-hidden="true">
              {SEVERITY_MARK[issue.severity].mark}
            </span>
            <div className={styles.text}>
              <span className="visually-hidden">{SEVERITY_MARK[issue.severity].label}：</span>
              <span className={styles.message}>{issue.message}</span>
              <span className={styles.hint}>{ISSUE_HINTS[issue.code]}</span>
            </div>
            <Link to={issueLink(projectId, issue.target)} className={styles.fix}>
              直しに行く<span aria-hidden="true"> →</span>
            </Link>
          </li>
        ))}
      </ul>
      {sorted.length > max && (
        <p className={styles.more}>
          ほか {sorted.length - max} 件は、画面上の「直すところ」から見られます。
        </p>
      )}
    </div>
  );
}
