import { useId } from 'react';
import type { Dir } from '../../domain/model';
import { Help } from '../components/Help';
import styles from './editors.module.css';

/** ホームから線路を見た図（奥が線路、手前がホーム）。列車の進む向きを矢印で描く */
export function DirDiagram({ dir, title }: { dir: Dir; title?: string }) {
  const toRight = dir === 'right';
  return (
    <svg
      viewBox="0 0 180 96"
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      {/* 線路 */}
      <rect x="4" y="18" width="172" height="26" rx="3" fill="var(--surface-3)" />
      <line x1="4" y1="24" x2="176" y2="24" stroke="var(--text-muted)" strokeWidth="2" />
      <line x1="4" y1="38" x2="176" y2="38" stroke="var(--text-muted)" strokeWidth="2" />
      {Array.from({ length: 11 }, (_, i) => (
        <line
          key={i}
          x1={10 + i * 16}
          y1="20"
          x2={10 + i * 16}
          y2="42"
          stroke="var(--border)"
          strokeWidth="3"
        />
      ))}
      {/* 列車の向き */}
      <g transform={toRight ? undefined : 'translate(180 0) scale(-1 1)'}>
        <line x1="30" y1="31" x2="140" y2="31" stroke="var(--accent)" strokeWidth="5" />
        <polygon points="140,21 162,31 140,41" fill="var(--accent)" />
      </g>
      {/* ホーム */}
      <rect
        x="4"
        y="56"
        width="172"
        height="36"
        rx="3"
        fill="var(--surface-2)"
        stroke="var(--border)"
      />
      <text x="90" y="79" textAnchor="middle" fontSize="13" fill="var(--text)">
        ホーム（ここに立つ）
      </text>
    </svg>
  );
}

export function DirPicker({
  value,
  onChange,
  name,
}: {
  value: Dir | undefined;
  onChange: (d: Dir) => void;
  name: string;
}) {
  const id = useId();
  return (
    <fieldset className={styles.dirPicker}>
      <legend>
        列車はどちらへ進みますか？
        <Help topic="dir" />
        {!value && <span className={styles.badge}>未入力</span>}
      </legend>
      {(['right', 'left'] as const).map((d) => (
        <label key={d} className={styles.dirOption}>
          <input
            type="radio"
            name={`${name}-${id}`}
            className="visually-hidden"
            checked={value === d}
            onChange={() => onChange(d)}
          />
          <DirDiagram dir={d} />
          <span>{d === 'right' ? '左から右へ（right）' : '右から左へ（left）'}</span>
        </label>
      ))}
    </fieldset>
  );
}
