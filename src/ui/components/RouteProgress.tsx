import { Link } from 'react-router';
import type { Stage } from '../journey';
import styles from './RouteProgress.module.css';

/** 入力の段と作業の段の境目（この添字から作業） */
const WORK_FROM = 5;

export interface RouteProgressProps {
  projectId: string;
  stages: readonly Stage[];
  /** 最初のまだ済んでいない段 */
  current: number;
  /** 今見ている画面の段（なければ印を付けない） */
  here?: number;
}

/**
 * 路線ができるまでを、路線図の駅として並べる（docs/redesign.md §7 ウィザード）。
 * 済んだ駅は塗り、次にやる駅は黄色の輪、今いる画面は二重丸。駅を押すとその段へ移る。
 */
export function RouteProgress({ projectId, stages, current, here }: RouteProgressProps) {
  const at = stages[here ?? current];
  return (
    <nav className={`${styles.wrap} no-print`} aria-label="路線ができるまで">
      <p className={styles.caption} aria-hidden="true">
        <span className={styles.captionHere}>{at?.label}</span>
        <span>
          {(here ?? current) + 1} / {stages.length}
        </span>
      </p>
      <ol className={styles.line}>
        {stages.map((s, i) => {
          const cls = [
            styles.stop,
            s.done ? styles.done : '',
            i === current && !s.done ? styles.next : '',
            i === here ? styles.here : '',
            i === WORK_FROM ? styles.workFrom : '',
            s.key === 'done' ? styles.terminal : '',
            i > 0 && stages[i - 1]?.done ? styles.reached : '',
          ]
            .filter(Boolean)
            .join(' ');
          const state = s.done ? '済み' : i === current ? '次にやる' : 'まだ';
          const warn = s.issues.error > 0;
          return (
            <li key={s.key} className={cls}>
              <Link
                to={`/p/${projectId}/${s.path}`}
                className={styles.link}
                aria-current={i === here ? 'step' : undefined}
              >
                <span className={styles.dot} aria-hidden="true">
                  {warn ? '!' : s.done ? '✓' : ''}
                </span>
                <span className={styles.label}>{s.label}</span>
                <span className="visually-hidden">
                  （{state}
                  {warn ? `、直すところ ${s.issues.error} 件` : ''}）
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
