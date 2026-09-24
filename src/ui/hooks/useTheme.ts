import { useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'kt-tc-builder:theme';

function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

/** ライト／ダーク。既定はシステム設定に従う（端末ごとの好みなので localStorage に置く） */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  useEffect(() => {
    applyTheme(theme);
    try {
      if (theme === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      // 保存できなくても表示は切り替わる
    }
  }, [theme]);
  return [theme, setTheme] as const;
}

export const THEME_LABELS: Record<ThemeChoice, string> = {
  system: '表示：自動',
  light: '表示：ライト',
  dark: '表示：ダーク',
};

export const nextTheme = (t: ThemeChoice): ThemeChoice =>
  t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system';
