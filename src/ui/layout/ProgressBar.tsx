import type { ProgressSummary } from '../../domain/progress';
import styles from './ProgressBar.module.css';

const PARTS = [
  ['platforms', 'のりば'],
  ['routes', '経路'],
  ['formations', '編成'],
  ['trials', '試運転'],
] as const;

/** 全体の進捗（R10.3） */
export function ProgressBar({ progress }: { progress: ProgressSummary }) {
  const done = PARTS.reduce((n, [k]) => n + progress[k].done, 0);
  const total = PARTS.reduce((n, [k]) => n + progress[k].total, 0);
  const stale = PARTS.reduce((n, [k]) => n + progress[k].stale, 0);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const detail = PARTS.map(
    ([k, label]) => `${label} ${progress[k].done}/${progress[k].total}`,
  ).join('・');
  return (
    <div className={styles.wrap} title={detail}>
      <div
        className={styles.bar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`進捗 ${pct}%（${detail}）`}
      >
        <span className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.text}>
        {pct}%{stale > 0 && <span className={styles.stale}>・要更新 {stale}</span>}
      </span>
    </div>
  );
}
