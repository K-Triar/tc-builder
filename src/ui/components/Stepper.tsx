import styles from './Stepper.module.css';

export interface StepperProps {
  steps: readonly string[];
  /** 0 始まり */
  current: number;
  onSelect?: (index: number) => void;
}

/** ウィザードの手順（どのステップにも戻れる） */
export function Stepper({ steps, current, onSelect }: StepperProps) {
  return (
    <nav aria-label="手順">
      <ol className={styles.list}>
        {steps.map((label, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo';
          return (
            <li key={label} className={`${styles.item} ${styles[state]}`}>
              <button
                type="button"
                className={styles.button}
                aria-current={i === current ? 'step' : undefined}
                onClick={() => onSelect?.(i)}
              >
                <span className={styles.num} aria-hidden="true">
                  {state === 'done' ? '✓' : i + 1}
                </span>
                <span className={styles.label}>{label}</span>
                <span className="visually-hidden">{state === 'done' ? '（済み）' : ''}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
