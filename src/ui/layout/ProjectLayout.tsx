import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useSaveStatus } from '../../storage/autosave';
import {
  prepareExport,
  exportFileName,
  hasUnexportedChanges,
  saveTextFile,
} from '../../storage/file';
import { now, useProjectStore } from '../../store/projectStore';
import { Button } from '../components/Button';
import { ToastHost } from '../components/ToastHost';
import { useDerived, useJourney, useProject } from '../hooks/useDerived';
import { nextTheme, THEME_LABELS, useTheme } from '../hooks/useTheme';
import { issueCounts } from '../issues';
import { SETUP_STAGE_COUNT, STAGES } from '../journey';
import { redoWithToast, undoWithToast } from '../toast';
import { IssuesPanel } from './IssuesPanel';
import styles from './ProjectLayout.module.css';

/** 画面（利用者の言葉で。docs/redesign.md §4 B） */
const NAV = [
  { key: 'overview', match: null, label: 'いまここ', icon: '◉' },
  { key: 'setup', match: 'setup', label: '質問に答える', icon: '？' },
  { key: 'work', match: 'work', label: '設置する', icon: '⚒' },
  { key: 'edit', match: 'edit', label: '詳しく編集', icon: '☷' },
  { key: 'docs', match: 'docs', label: '資料', icon: '☰' },
] as const;

/** 書き出しを促す帯を、最後の書き出しからこれだけたったら出す */
export const EXPORT_REMIND_MS = 24 * 60 * 60 * 1000;

const SAVE_TEXT = {
  idle: '✓ 自動で保存済み',
  saved: '✓ 自動で保存済み',
  pending: '保存中…',
  error: '⚠ このブラウザに保存できません。ファイルに書き出してください',
} as const;

/** 文字を入れる欄の中では、ブラウザ自身の取り消しに任せる */
const isTextInput = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  !!el.closest(
    'input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]',
  );

/** プロジェクト内の共通レイアウト（design §6.1）。PC は左ナビ＋右検証、スマホは下タブ＋下部シート */
export function ProjectLayout() {
  const project = useProject();
  const { derived } = useDerived();
  const j = useJourney();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [theme, setTheme] = useTheme();
  const { pathname, search } = useLocation();
  const saveStatus = useSaveStatus((s) => s.status);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const badgeRef = useRef<HTMLButtonElement>(null);
  const counts = issueCounts(derived.issues);
  const unexported = hasUnexportedChanges(project);
  const exportAge = project.lastExportedAt
    ? now.current().getTime() - Date.parse(project.lastExportedAt)
    : Number.POSITIVE_INFINITY;
  const showReminder = unexported && dismissedFor !== project.id && exportAge > EXPORT_REMIND_MS;

  const onExport = async () => {
    const { project: exported, text } = prepareExport(project, now.current());
    const saved = await saveTextFile(text, exportFileName(project));
    if (saved && exported.lastExportedAt) {
      const at = exported.lastExportedAt;
      useProjectStore.setState((s) => {
        if (s.project) s.project.lastExportedAt = at;
      });
    }
  };

  // 画面が変わったら：見出しをタブのタイトルにし、読み上げのためにフォーカスを見出しへ移す
  const firstPath = useRef(true);
  useEffect(() => {
    const h1 = document.querySelector<HTMLElement>('main h1');
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    // 検証から特定の駅へ飛んだときは、その駅までのスクロールを優先する
    if (!new URLSearchParams(search).has('station')) window.scrollTo?.(0, 0);
    if (h1) {
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
    }
    // search は駅の判定にだけ使う（タブ内の選び直しでは動かさない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  useEffect(() => {
    const h1 = document.querySelector<HTMLElement>('main h1');
    document.title = [h1?.textContent, project.name, 'KT式 TC ビルダー']
      .filter(Boolean)
      .join(' – ');
  }, [pathname, project.name]);

  // Ctrl+Z／Ctrl+Shift+Z（Ctrl+Y）で元に戻す／やり直す
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const undo = key === 'z' && !e.shiftKey;
      const redo = (key === 'z' && e.shiftKey) || key === 'y';
      if (!undo && !redo) return;
      if (isTextInput(e.target) || document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      if (undo) undoWithToast();
      else redoWithToast();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // 下部シート：開いたら見出しへ、Esc で閉じて元のボタンへ
  const closeSheet = () => {
    setSheetOpen(false);
    badgeRef.current?.focus();
  };
  useEffect(() => {
    if (!sheetOpen) return;
    document.getElementById('issues-title')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setSheetOpen(false);
      badgeRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  const onBadge = () => setSheetOpen((v) => !v);

  // 開いた段へのリンク：入力が終わっていなければ次の質問、作業中なら次の作業
  const setupPath =
    j.current < SETUP_STAGE_COUNT ? (STAGES[j.current]?.path ?? 'setup/0') : 'setup/0';
  const workPath =
    j.current >= SETUP_STAGE_COUNT && j.stages[j.current]?.key !== 'done'
      ? (STAGES[j.current]?.path ?? 'setup/0')
      : 'work/commands';
  const navTo = {
    overview: '',
    setup: setupPath,
    work: workPath,
    edit: 'edit/org',
    docs: 'docs/routes',
  };

  const base = `/p/${project.id}`;
  return (
    <div className={styles.shell}>
      <header className={`${styles.header} no-print`}>
        <Link to="/" className={styles.home} aria-label="ホームへ戻る" title="ホームへ戻る">
          ←
        </Link>
        <div className={styles.titleBox}>
          <Link to={base} className={styles.projectName}>
            {project.name || '（名前なし）'}
          </Link>
          <span
            className={`${styles.saveStatus} ${saveStatus === 'error' ? styles.saveError : ''}`}
            role={saveStatus === 'error' ? 'alert' : undefined}
          >
            {SAVE_TEXT[saveStatus]}
          </span>
        </div>
        <div className={styles.historyButtons}>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canUndo}
            aria-label="元に戻す"
            title="元に戻す（Ctrl+Z）"
            onClick={undoWithToast}
          >
            {'↶︎'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canRedo}
            aria-label="やり直す"
            title="やり直す（Ctrl+Shift+Z）"
            onClick={redoWithToast}
          >
            {'↷︎'}
          </Button>
        </div>
        <button
          ref={badgeRef}
          type="button"
          className={`${styles.badge} ${counts.error > 0 ? styles.badgeError : counts.warning > 0 ? styles.badgeWarn : styles.badgeOk}`}
          onClick={onBadge}
          aria-expanded={sheetOpen}
          aria-controls="issues-sheet"
          aria-label={`入力のチェック：直すところ ${counts.error} 件、確認 ${counts.warning} 件`}
        >
          <span aria-hidden="true">
            {counts.error > 0
              ? `✖ 直すところ ${counts.error}`
              : counts.warning > 0
                ? `⚠ 確認 ${counts.warning}`
                : '✓ 問題なし'}
          </span>
        </button>
        <Button
          variant={unexported ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => void onExport()}
          title={unexported ? 'ファイルに未保存の変更があります' : 'ファイルに保存済み'}
        >
          <span>
            {unexported && '● '}
            <span className={styles.wideOnly}>ファイルに</span>書き出す
          </span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={styles.themeButton}
          onClick={() => setTheme(nextTheme(theme))}
        >
          {THEME_LABELS[theme]}
        </Button>
      </header>
      {showReminder && (
        <div className={`${styles.unsaved} no-print`}>
          <p>
            {project.lastExportedAt
              ? '最後にファイルに書き出してから1日以上たっています。'
              : 'このプロジェクトはまだファイルに書き出していません。'}
            ブラウザのデータが消えたときに備えて、書き出しておくと安心です。
          </p>
          <Button size="sm" onClick={() => void onExport()}>
            いま書き出す
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissedFor(project.id)}>
            今は閉じる
          </Button>
        </div>
      )}

      <nav className={`${styles.nav} no-print`} aria-label="画面">
        <ul>
          {NAV.map((n) => {
            const active = n.match
              ? pathname.includes(`/${n.match}/`)
              : pathname.replace(/\/$/, '') === base;
            return (
              <li key={n.key}>
                <Link
                  to={`${base}/${navTo[n.key]}`}
                  className={`${styles.navLink} ${active ? styles.active : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span aria-hidden="true" className={styles.navIcon}>
                    {n.icon}
                  </span>
                  <span className={styles.navLabel}>{n.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <main className={styles.main} id="main">
        <Outlet />
        {/* スマホではヘッダーに入りきらない操作をここに置く */}
        <div className={`${styles.mobileTools} no-print`}>
          <Button size="sm" disabled={!canUndo} onClick={undoWithToast}>
            ↶ 元に戻す
          </Button>
          <Button size="sm" disabled={!canRedo} onClick={redoWithToast}>
            ↷ やり直す
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setTheme(nextTheme(theme))}>
            {THEME_LABELS[theme]}
          </Button>
        </div>
      </main>

      <aside
        id="issues-sheet"
        className={`${styles.aside} ${sheetOpen ? styles.sheetOpen : ''} no-print`}
        aria-label="入力のチェック"
      >
        <div className={styles.sheetHandle}>
          <Button variant="ghost" size="sm" onClick={closeSheet}>
            閉じる ✕
          </Button>
        </div>
        <IssuesPanel
          projectId={project.id}
          issues={derived.issues}
          onNavigate={() => setSheetOpen(false)}
        />
      </aside>
      <ToastHost />
    </div>
  );
}
