import { useId } from 'react';
import { useWork } from '../hooks/useWork';
import styles from './work.module.css';

/** 作業のチェック（設置した・試運転した・実行した）。内容が変わると「要更新」 */
export function WorkCheck({ id, label }: { id: string; label: string }) {
  const { status, exists, toggle } = useWork(id);
  const inputId = useId();
  if (!exists) return null;
  return (
    <span className={`${styles.check} ${status === 'done' ? styles.checkDone : ''}`}>
      <input
        id={inputId}
        type="checkbox"
        checked={status === 'done'}
        onChange={toggle}
        aria-describedby={status === 'stale' ? `${inputId}-stale` : undefined}
      />
      <label htmlFor={inputId}>{label}</label>
      {status === 'stale' && (
        <span id={`${inputId}-stale`} className={styles.stale}>
          ⟳ 要更新（内容が変わりました）
        </span>
      )}
    </span>
  );
}
