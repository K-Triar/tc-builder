import { useId, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { useProject } from '../hooks/useDerived';
import { SECTION_LABEL, type FocusSection } from './steps';
import styles from './Focus.module.css';

export interface FocusMove {
  label?: ReactNode;
  onClick: () => void;
}

/**
 * 集中モードの共通の枠（redesign2 §2-0）。出すのは「やめる」「n / N」「戻る」「次へ」だけ。
 * 中身は質問1つ。フォームなので、入力欄で Enter を押すと「次へ」になる。
 */
export function FocusFrame({
  section,
  pos,
  total,
  progress,
  title,
  lead,
  children,
  back,
  next,
  footer,
  quitTo,
  quitLabel,
}: {
  section: FocusSection;
  /** 段の中の何問目か（出さないときは省く） */
  pos?: number;
  total?: number;
  /** 進み具合（0〜1） */
  progress: number;
  /** 質問（そのまま画面の見出し） */
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  back?: FocusMove | null;
  next?: FocusMove | null;
  /** 戻る／次へのかわりに置くボタン */
  footer?: ReactNode;
  /** やめたときに行く先（プロジェクトの中のパス。既定は集中モード中ならホーム、そうでなければいまここ） */
  quitTo?: string;
  quitLabel?: string;
}) {
  const project = useProject();
  const navigate = useNavigate();
  const titleId = useId();
  const quit = () =>
    void navigate(
      quitTo !== undefined
        ? `/p/${project.id}/${quitTo}`
        : project.guide
          ? '/'
          : `/p/${project.id}`,
    );
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    next?.onClick();
  };
  const percent = Math.round(progress * 100);

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit} aria-labelledby={titleId} noValidate>
        <header className={styles.top}>
          <Button variant="ghost" size="sm" onClick={quit}>
            ✕ {quitLabel ?? (project.guide ? 'やめる（保存されます）' : 'やめる')}
          </Button>
          <span className={styles.where}>
            {section} {SECTION_LABEL[section]}
            {pos !== undefined && total !== undefined && (
              <span className={styles.count}>
                {pos} / {total}
              </span>
            )}
          </span>
        </header>
        <div
          className={styles.bar}
          role="progressbar"
          aria-label="はじめての質問の進み具合"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className={styles.body}>
          <h1 id={titleId} className={styles.question}>
            {title}
          </h1>
          {lead && <p className={styles.lead}>{lead}</p>}
          {children}
        </div>
        <footer className={styles.moves}>
          {footer ?? (
            <>
              {back ? <Button onClick={back.onClick}>{back.label ?? '← 戻る'}</Button> : <span />}
              {next && (
                <Button variant="primary" type="submit">
                  {next.label ?? '次へ →'}
                </Button>
              )}
            </>
          )}
        </footer>
      </form>
    </div>
  );
}

/** 質問の答えが足りないときの知らせ */
export function FocusError({ children }: { children: ReactNode }) {
  return (
    <p className="field-error" role="alert">
      {children}
    </p>
  );
}
