import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { GUIDE_URL, HELP, type HelpEntry, type HelpKey } from '../../content/help';
import styles from './Help.module.css';

export interface HelpProps {
  /** content/help.ts のキー。children があればそちらを出す */
  topic?: HelpKey;
  children?: ReactNode;
  /** ボタンの読み上げ名（既定は項目名から作る） */
  label?: string;
}

/** 「？」ボタンで短い説明を出す（R11）。Esc と外側クリックで閉じる */
export function Help({ topic, children, label }: HelpProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const entry: HelpEntry | undefined = topic ? HELP[topic] : undefined;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <span className={styles.root} ref={root}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={id}
        aria-label={label ?? `${entry?.title ?? ''}の説明`}
        onClick={() => setOpen((v) => !v)}
      >
        ？
      </button>
      {open && (
        <span id={id} role="note" className={styles.popover}>
          {entry && <strong className={styles.title}>{entry.title}</strong>}
          <span className={styles.body}>{children ?? entry?.body}</span>
          {entry?.guide !== false && (
            <a href={GUIDE_URL} target="_blank" rel="noreferrer" className={styles.link}>
              入門ガイドで詳しく見る
            </a>
          )}
        </span>
      )}
    </span>
  );
}
