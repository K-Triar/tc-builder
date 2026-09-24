import { Link } from 'react-router';
import type { Issue } from '../../domain/validate';
import { ISSUE_HINTS, issueCounts, issueLink, SEVERITY_MARK } from '../issues';
import styles from './IssuesPanel.module.css';

export interface IssuesPanelProps {
  projectId: string;
  issues: readonly Issue[];
  onNavigate?: () => void;
}

const ORDER = ['error', 'warning', 'info'] as const;

const GROUP_TITLE = {
  error: '直すところ（直すまで看板とコマンドは出ません）',
  warning: '確かめてほしいこと（このままでも出力はできます）',
  info: 'お知らせ',
} as const;

/** 検証の一覧（R9）。何が問題か・どう直すか・直しに行くリンク */
export function IssuesPanel({ projectId, issues, onNavigate }: IssuesPanelProps) {
  const counts = issueCounts(issues);
  return (
    <section className={styles.panel} aria-labelledby="issues-title">
      <h2 id="issues-title" className={styles.title} tabIndex={-1}>
        入力のチェック
      </h2>
      {counts.error + counts.warning === 0 ? (
        <p className={styles.ok}>
          <span aria-hidden="true">✓</span> 設定に問題はありません
        </p>
      ) : null}
      {ORDER.map((sev) => {
        const list = issues.filter((i) => i.severity === sev);
        if (list.length === 0) return null;
        const body = (
          <ul className={styles.list}>
            {list.map((issue, i) => (
              <li key={`${issue.code}-${i}`} className={`${styles.item} ${styles[issue.severity]}`}>
                <span className={styles.mark} aria-hidden="true">
                  {SEVERITY_MARK[issue.severity].mark}
                </span>
                <div className={styles.text}>
                  <span className="visually-hidden">{SEVERITY_MARK[issue.severity].label}：</span>
                  <span className={styles.message}>{issue.message}</span>
                  <span className={styles.hint}>{ISSUE_HINTS[issue.code]}</span>
                  <Link
                    to={issueLink(projectId, issue.target)}
                    className={styles.link}
                    onClick={onNavigate}
                  >
                    直しに行く<span aria-hidden="true"> →</span>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        );
        return sev === 'info' ? (
          <details key={sev} className={styles.group}>
            <summary className={styles.groupTitle}>
              {GROUP_TITLE[sev]}（{list.length}）
            </summary>
            {body}
          </details>
        ) : (
          <div key={sev} className={styles.group}>
            <h3 className={styles.groupTitle}>
              {GROUP_TITLE[sev]}（{list.length}）
            </h3>
            {body}
          </div>
        );
      })}
    </section>
  );
}
