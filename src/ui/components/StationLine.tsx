import { Link } from 'react-router';
import styles from './StationLine.module.css';

export interface StationLinkItem {
  key: string;
  label: string;
  /** 右に小さく出す（「2/3 済み」「向きが未入力」など） */
  sub?: string;
  state: 'done' | 'todo' | 'warn';
  to: string;
  selected?: boolean;
}

/** 縦の路線図で駅を選ぶ（のりばの設定・看板を置く画面） */
export function StationLinks({
  items,
  label,
}: {
  items: readonly StationLinkItem[];
  label: string;
}) {
  return (
    <nav aria-label={label}>
      <ol className={styles.line}>
        {items.map((it) => (
          <li key={it.key} className={styles.stop}>
            <span
              className={`${styles.dot} ${it.state === 'done' ? styles.doneDot : it.state === 'warn' ? styles.warnDot : ''}`}
              aria-hidden="true"
            />
            <div className={styles.body}>
              <Link
                to={it.to}
                replace
                className={`${styles.link} ${it.selected ? styles.selected : ''}`}
                aria-current={it.selected ? 'location' : undefined}
              >
                <span>{it.label}</span>
                {it.sub && (
                  <span className={`${styles.sub} ${it.state === 'warn' ? styles.warnText : ''}`}>
                    {it.sub}
                  </span>
                )}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
