import styles from './Stepper.module.css';

export type StepMark = 'error' | 'warning' | undefined;

export interface StepperProps {
  steps: readonly string[];
  /** 0 始まり */
  current: number;
  onSelect?: (index: number) => void;
  /** ステップごとの検証結果（エラー・警告があるステップに印を付ける） */
  marks?: readonly StepMark[];
}

const MARK_TEXT = { error: '（エラーあり）', warning: '（警告あり）' } as const;

/** ウィザードの手順（どのステップにも戻れる） */
export function Stepper({ steps, current, onSelect, marks }: StepperProps) {
  return (
    <nav aria-label="手順">
      <ol className={styles.list}>
        {steps.map((label, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo';
          const mark = marks?.[i];
          const num =
            mark === 'error' ? '✖' : mark === 'warning' ? '⚠' : state === 'done' ? '✓' : i + 1;
          return (
            <li
              key={label}
              className={`${styles.item} ${styles[state]} ${mark ? styles[mark] : ''}`}
            >
              <button
                type="button"
                className={styles.button}
                aria-current={i === current ? 'step' : undefined}
                onClick={() => onSelect?.(i)}
              >
                <span className={styles.num} aria-hidden="true">
                  {num}
                </span>
                <span className={styles.label}>{label}</span>
                <span className="visually-hidden">
                  {state === 'done' ? '（済み）' : ''}
                  {mark ? MARK_TEXT[mark] : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
