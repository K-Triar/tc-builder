import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import {
  prepareExport,
  exportFileName,
  hasUnexportedChanges,
  saveTextFile,
} from '../../storage/file';
import { now, useProjectStore } from '../../store/projectStore';
import { Button } from '../components/Button';
import { useDerived, useProject } from '../hooks/useDerived';
import { nextTheme, THEME_LABELS, useTheme } from '../hooks/useTheme';
import { issueCounts, SEVERITY_MARK } from '../issues';
import { IssuesPanel } from './IssuesPanel';
import { ProgressBar } from './ProgressBar';
import styles from './ProjectLayout.module.css';

const NAV = [
  { to: 'setup/0', match: 'setup', label: 'ウィザード', icon: '①' },
  { to: 'edit/org', match: 'edit', label: '編集', icon: '✎' },
  { to: 'work/signs', match: 'work', label: '作業', icon: '⚒' },
  { to: 'docs/routes', match: 'docs', label: '資料', icon: '☰' },
] as const;

/** プロジェクト内の共通レイアウト（design §6.1）。PC は左ナビ＋右検証、スマホは下タブ＋下部シート */
export function ProjectLayout() {
  const project = useProject();
  const { derived, progress } = useDerived();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const { pathname } = useLocation();
  const counts = issueCounts(derived.issues);
  const unexported = hasUnexportedChanges(project);

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

  const base = `/p/${project.id}`;
  return (
    <div className={styles.shell}>
      <header className={`${styles.header} no-print`}>
        <Link to="/" className={styles.home} aria-label="ホームへ戻る">
          ←
        </Link>
        <div className={styles.titleBox}>
          <span className={styles.projectName}>{project.name || '（名前なし）'}</span>
          <ProgressBar progress={progress} />
        </div>
        <button
          type="button"
          className={`${styles.badge} ${counts.error > 0 ? styles.badgeError : ''}`}
          onClick={() => setSheetOpen((v) => !v)}
          aria-expanded={sheetOpen}
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
          {unexported ? '● ファイルに書き出す' : 'ファイルに書き出す'}
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
      {unexported && (
        <p className={`${styles.unsaved} no-print`} role="status">
          ファイルに未保存の変更があります。ブラウザのデータが消えたときに備えて、ときどき書き出してください。
        </p>
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
      </main>

      <aside
        id="issues-sheet"
        className={`${styles.aside} ${sheetOpen ? styles.sheetOpen : ''} no-print`}
        aria-label="検証結果"
      >
        <div className={styles.sheetHandle}>
          <Button variant="ghost" size="sm" onClick={() => setSheetOpen(false)}>
            閉じる
          </Button>
        </div>
        <IssuesPanel
          projectId={project.id}
          issues={derived.issues}
          onNavigate={() => setSheetOpen(false)}
        />
      </aside>
    </div>
  );
}
