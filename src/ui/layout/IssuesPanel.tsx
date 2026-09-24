import { Link } from 'react-router';
import type { Issue } from '../../domain/validate';
import { issueCounts, issueLink, SEVERITY_MARK } from '../issues';
import styles from './IssuesPanel.module.css';

export interface IssuesPanelProps {
  projectId: string;
  issues: readonly Issue[];
  onNavigate?: () => void;
}

/** 検証の一覧（R9）。クリックで該当する入力へ */
export function IssuesPanel({ projectId, issues, onNavigate }: IssuesPanelProps) {
  const counts = issueCounts(issues);
  return (
    <section className={styles.panel} aria-labelledby="issues-title">
      <h2 id="issues-title" className={styles.title} tabIndex={-1}>
        検証
      </h2>
      <p className={styles.summary}>
        {(['error', 'warning', 'info'] as const).map((s) => (
          <span key={s} className={`${styles.count} ${styles[s]}`}>
            <span aria-hidden="true">{SEVERITY_MARK[s].mark}</span> {SEVERITY_MARK[s].label}{' '}
            {counts[s]}
          </span>
        ))}
      </p>
      {issues.length === 0 ? (
        <p className="muted">問題は見つかっていません。</p>
      ) : (
        <ul className={styles.list}>
          {issues.map((issue, i) => (
            <li
              key={`${issue.code}-${i}`}
              className={`${styles.item} ${styles[issue.severity]}`}
              title={`検証コード：${issue.code}`}
            >
              <Link
                to={issueLink(projectId, issue.target)}
                className={styles.link}
                onClick={onNavigate}
              >
                <span className={styles.mark} aria-hidden="true">
                  {SEVERITY_MARK[issue.severity].mark}
                </span>
                <span>
                  <span className="visually-hidden">{SEVERITY_MARK[issue.severity].label}：</span>
                  {issue.message}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
