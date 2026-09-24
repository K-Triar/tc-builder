import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useMediaQuery } from '../hooks/useMediaQuery';
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

/** これより狭いと、駅の一覧を「駅を選ぶ」の中にしまう（中身を先に見せるため） */
const NARROW = '(max-width: 900px)';

/** 縦の路線図で駅を選ぶ（のりばの設定・看板を置く画面） */
export function StationLinks({
  items,
  label,
}: {
  items: readonly StationLinkItem[];
  label: string;
}) {
  const narrow = useMediaQuery(NARROW);
  const selectedRef = useRef<HTMLAnchorElement>(null);
  const index = items.findIndex((i) => i.selected);
  const selected = items[index];

  // 選んでいる駅が一覧の下のほうでも見えるように
  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [selected?.key]);

  const list = (
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
                ref={it.selected ? selectedRef : undefined}
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
  if (!narrow) return list;
  return (
    <details className="disclosure">
      <summary>
        駅を選ぶ
        {selected && (
          <span className={styles.pickerNow}>
            いま：{selected.label}（{index + 1} / {items.length}）
          </span>
        )}
      </summary>
      {list}
    </details>
  );
}
