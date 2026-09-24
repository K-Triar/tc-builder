import type { ReactNode } from 'react';
import styles from './Matrix.module.css';

export type MatrixValue = boolean | 'fixed';

export interface MatrixProps {
  caption: string;
  rows: readonly { key: string; label: ReactNode; note?: ReactNode }[];
  columns: readonly { key: string; label: ReactNode }[];
  /** true＝○（停車）、false＝×（通過）、'fixed'＝○で変えられない（始発・終点） */
  value: (row: number, col: number) => MatrixValue;
  onToggle: (row: number, col: number) => void;
  /** セルの読み上げ名（例「オット 普通」） */
  cellLabel: (row: number, col: number) => string;
}

/** 停車 ○/× のマトリクス（Excel 種別表と同じ見た目）。記号でも示す */
export function Matrix({ caption, rows, columns, value, onToggle, cellLabel }: MatrixProps) {
  return (
    <div className={styles.wrap} tabIndex={0} role="region" aria-label={caption}>
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">駅</th>
            {columns.map((c) => (
              <th scope="col" key={c.key}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r.key}>
              <th scope="row" className={styles.rowHead}>
                {r.label}
                {r.note && <span className={styles.note}>{r.note}</span>}
              </th>
              {columns.map((c, ci) => {
                const v = value(ri, ci);
                const on = v !== false;
                return (
                  <td key={c.key}>
                    <button
                      type="button"
                      className={`${styles.cell} ${on ? styles.on : styles.off}`}
                      aria-pressed={on}
                      aria-label={`${cellLabel(ri, ci)}：${on ? '停車' : '通過'}${v === 'fixed' ? '（始発・終点は停車で固定）' : ''}`}
                      disabled={v === 'fixed'}
                      onClick={() => onToggle(ri, ci)}
                    >
                      {on ? '○' : '×'}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
