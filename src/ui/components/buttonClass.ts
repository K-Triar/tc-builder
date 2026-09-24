import styles from './Button.module.css';

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerQuiet';
export type Size = 'md' | 'sm' | 'lg';

/** ボタンの見た目のクラス（リンクをボタンの見た目にするときにも使う） */
export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra?: string) {
  return [styles.button, styles[variant], size !== 'md' ? styles[size] : '', extra]
    .filter(Boolean)
    .join(' ');
}
