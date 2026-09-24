import { NavLink } from 'react-router';
import styles from './TabNav.module.css';

/** 画面の中のタブ（URL で切り替える） */
export function TabNav({
  base,
  tabs,
  label,
}: {
  base: string;
  tabs: readonly { key: string; label: string; badge?: string }[];
  label: string;
}) {
  return (
    <nav aria-label={label} className={`${styles.tabs} no-print`}>
      {tabs.map((t) => (
        <NavLink
          key={t.key}
          to={`${base}/${t.key}`}
          className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}
        >
          {t.label}
          {t.badge && <span className={styles.badge}>{t.badge}</span>}
        </NavLink>
      ))}
    </nav>
  );
}
