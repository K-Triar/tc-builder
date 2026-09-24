import { useEffect, useRef, useState } from 'react';
import { useToast } from '../toast';
import { Button } from './Button';
import styles from './ToastHost.module.css';

/** 表示している時間。指しているあいだ・フォーカスがあるあいだは消さない */
export const TOAST_MS = 7000;

/** お知らせの置き場所。読み上げのために、中身がなくても枠は常に置いておく */
export function ToastHost() {
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);
  const [hold, setHold] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast || hold) return;
    const timer = setTimeout(() => hide(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast, hold, hide]);

  return (
    <div className={`${styles.host} no-print`} role="status" aria-live="polite">
      {toast && (
        <div
          ref={box}
          key={toast.id}
          className={styles.toast}
          onMouseEnter={() => setHold(true)}
          onMouseLeave={() => setHold(false)}
          onFocus={() => setHold(true)}
          onBlur={(e) => {
            if (!box.current?.contains(e.relatedTarget as Node)) setHold(false);
          }}
        >
          <span className={styles.message}>{toast.message}</span>
          {toast.action && (
            <Button
              size="sm"
              className={styles.action}
              onClick={() => {
                const run = toast.action?.run;
                hide(toast.id);
                setHold(false);
                run?.();
              }}
            >
              {toast.action.label}
            </Button>
          )}
          <button
            type="button"
            className={styles.close}
            aria-label="お知らせを閉じる"
            onClick={() => {
              hide(toast.id);
              setHold(false);
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
