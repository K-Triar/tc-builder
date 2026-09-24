import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
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
import { useDerived, useProject } from '../hooks/useDerived';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { nextTheme, THEME_LABELS, useTheme } from '../hooks/useTheme';
import { issueCounts, SEVERITY_MARK } from '../issues';
import { redoWithToast, undoWithToast } from '../toast';
import { IssuesPanel } from './IssuesPanel';
import { ProgressBar } from './ProgressBar';
import styles from './ProjectLayout.module.css';

const NAV = [
  { to: 'setup/0', match: 'setup', label: 'ウィザード', icon: '①' },
  { to: 'edit/org', match: 'edit', label: '編集', icon: '✎' },
  { to: 'work/signs', match: 'work', label: '作業', icon: '⚒' },
  { to: 'docs/routes', match: 'docs', label: '資料', icon: '☰' },
] as const;

/** 書き出しを促す帯を、最後の書き出しからこれだけたったら出す */
export const EXPORT_REMIND_MS = 24 * 60 * 60 * 1000;

/** 検証パネルが横に常に出ている幅（ProjectLayout.module.css の 1100px と合わせる） */
const WIDE = '(min-width: 1101px)';

const SAVE_TEXT = {
  idle: '✓ このブラウザに保存済み',
  saved: '✓ このブラウザに保存済み',
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
  const { derived, progress } = useDerived();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [theme, setTheme] = useTheme();
  const { pathname, search } = useLocation();
  const wide = useMediaQuery(WIDE);
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
    if (!sheetOpen || wide) return;
    document.getElementById('issues-title')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setSheetOpen(false);
      badgeRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen, wide]);

  const onBadge = () => {
    if (wide) {
      // 広い画面では検証パネルは常に出ているので、そこへ移る
      const title = document.getElementById('issues-title');
      title?.scrollIntoView?.({ block: 'nearest' });
      title?.focus();
    } else setSheetOpen((v) => !v);
  };

  const base = `/p/${project.id}`;
  return (
    <div className={styles.shell}>
      <header className={`${styles.header} no-print`}>
        <Link to="/" className={styles.home} aria-label="ホームへ戻る" title="ホームへ戻る">
          ←
        </Link>
        <div className={styles.titleBox}>
          <span className={styles.projectName}>{project.name || '（名前なし）'}</span>
          <div className={styles.statusRow}>
            <ProgressBar progress={progress} />
            <span
              className={`${styles.saveStatus} ${saveStatus === 'error' ? styles.saveError : ''}`}
              role={saveStatus === 'error' ? 'alert' : undefined}
            >
              {SAVE_TEXT[saveStatus]}
            </span>
          </div>
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
          className={`${styles.badge} ${counts.error > 0 ? styles.badgeError : ''}`}
          onClick={onBadge}
          aria-expanded={wide ? undefined : sheetOpen}
          aria-controls="issues-sheet"
          aria-label={`検証：エラー ${counts.error} 件、警告 ${counts.warning} 件`}
        >
          <span aria-hidden="true">
            {SEVERITY_MARK.error.mark} {counts.error}
          </span>
          <span aria-hidden="true" className={styles.badgeWarn}>
            {SEVERITY_MARK.warning.mark} {counts.warning}
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
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink
                to={`${base}/${n.to}`}
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive || pathname.includes(`/${n.match}/`) ? styles.active : ''}`
                }
              >
                <span aria-hidden="true" className={styles.navIcon}>
                  {n.icon}
                </span>
                {n.label}
              </NavLink>
            </li>
          ))}
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
        aria-label="検証結果"
      >
        <div className={styles.sheetHandle}>
          <Button variant="ghost" size="sm" onClick={closeSheet}>
            閉じる
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
