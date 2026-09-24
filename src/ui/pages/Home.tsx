import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Project } from '../../domain/model';
import { createProject, K_PRESET, PRESETS, type Preset } from '../../domain/presets';
import {
  deleteProject,
  listProjects,
  loadProject,
  projectExists,
  saveProject,
  type ProjectMeta,
} from '../../storage/db';
import { asCopy, hasUnexportedChanges, readProjectFile } from '../../storage/file';
import { createSampleProject } from '../../storage/sample';
import { now, useProjectStore } from '../../store/projectStore';
import { GUIDE_URL } from '../../content/help';
import { Button } from '../components/Button';
import { ConfirmDialog, Dialog } from '../components/Dialog';
import { useFileDrop } from '../hooks/useFileDrop';
import { nextTheme, THEME_LABELS, useTheme } from '../hooks/useTheme';
import styles from './Home.module.css';

const newId = () => globalThis.crypto.randomUUID();

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
}

/** ホーム（design §6.1）：一覧・新規作成・サンプル・ファイルを開く */
export function Home() {
  const navigate = useNavigate();
  const open = useProjectStore((s) => s.open);
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ProjectMeta | null>(null);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);
  const [conflict, setConflict] = useState<Project | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sampleExists, setSampleExists] = useState<ProjectMeta | null>(null);
  const [theme, setTheme] = useTheme();
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    listProjects()
      .then(setProjects)
      .catch(() => {
        setProjects([]);
        setLoadError(
          'ブラウザ内の保存領域を読めませんでした（プライベートモードなど）。ファイルの書き出しで保存してください。',
        );
      });
  }, []);

  useEffect(refresh, [refresh]);
  useEffect(() => {
    document.title = 'KT式 TC ビルダー';
  }, []);

  const openAndGo = async (p: Project, path: string) => {
    await saveProject(p);
    open(p);
    await navigate(`/p/${p.id}/${path}`);
  };

  const openNewSample = () => void openAndGo(createSampleProject(newId(), now.current()), '');
  /** サンプルがもうあれば、それを開くか新しく作るか聞く（押すたびに増えないように） */
  const onSample = () => {
    const name = createSampleProject('probe', now.current()).name;
    const existing = projects?.find((m) => m.name === name);
    if (existing) setSampleExists(existing);
    else openNewSample();
  };

  const onFile = useCallback(async (file: File) => {
    const r = await readProjectFile(file);
    if (!r.ok) {
      setImportErrors(r.errors);
      return;
    }
    if (await projectExists(r.project.id)) setConflict(r.project);
    else await openAndGo(r.project, '');
    // openAndGo は描画ごとに変わらない処理だけを使う
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { dragging, dropProps } = useFileDrop((f) => void onFile(f));

  const onDuplicate = async (meta: ProjectMeta) => {
    const p = await loadProject(meta.id);
    if (!p) return;
    await saveProject(asCopy(p, newId(), now.current()));
    refresh();
  };

  return (
    <div className={`${styles.page} ${dragging ? styles.dragging : ''}`} {...dropProps}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>KT式 TC ビルダー</h1>
          <p className={styles.lead}>
            質問に答えていくだけで、TrainCarts の KT式（経路コード方式）の看板とコマンドが作れます。
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setTheme(nextTheme(theme))}>
          {THEME_LABELS[theme]}
        </Button>
      </header>

      <section className={styles.actions} aria-label="はじめる">
        <Button variant="primary" onClick={() => setCreating(true)}>
          ＋ 新しいプロジェクト
        </Button>
        <Button onClick={onSample}>サンプル（瑠璃線系統）を開く</Button>
        <Button onClick={() => fileInput.current?.click()}>ファイルを開く</Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          aria-label="プロジェクトファイルを選ぶ"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void onFile(f);
          }}
        />
      </section>
      <p className={`${styles.dropHint} muted`}>
        .ktc.json ファイルをこの画面にドラッグ＆ドロップしても開けます。
      </p>

      <section aria-labelledby="list-title">
        <h2 id="list-title">このブラウザのプロジェクト</h2>
        {loadError && <p role="alert">{loadError}</p>}
        {projects === null ? (
          <p className="muted">読み込み中…</p>
        ) : projects.length === 0 ? (
          <p className="muted">まだありません。新しく作るか、サンプルを開いてみてください。</p>
        ) : (
          <ul className={styles.list}>
            {projects.map((m) => (
              <li key={m.id} className={styles.item}>
                <div className={styles.itemMain}>
                  {/* 名前のリンクをカード全体に広げて、どこを押しても開けるようにする */}
                  <a
                    href={`#/p/${m.id}`}
                    className={styles.itemName}
                    onClick={(e) => {
                      e.preventDefault();
                      void navigate(`/p/${m.id}`);
                    }}
                  >
                    {m.name || '（名前なし）'}
                  </a>
                  <span className={styles.itemMeta}>
                    更新 {formatDate(m.updatedAt)}
                    {hasUnexportedChanges(m) && (
                      <span className={styles.unsaved}>・ファイルに未保存</span>
                    )}
                  </span>
                </div>
                <div className={styles.itemActions}>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`${m.name || '名前なし'}を複製`}
                    onClick={() => void onDuplicate(m)}
                  >
                    複製
                  </Button>
                  <Button
                    size="sm"
                    variant="dangerQuiet"
                    aria-label={`${m.name || '名前なし'}を消す`}
                    onClick={() => setDeleting(m)}
                  >
                    消す
                  </Button>
                  <span className={styles.chevron} aria-hidden="true">
                    ›
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className={styles.footer}>
        <a href={GUIDE_URL} target="_blank" rel="noreferrer">
          入門ガイド（KT式 経路コード方式）
        </a>
        <span className="muted">データはこのブラウザの中だけに保存され、外部へ送られません。</span>
      </footer>

      <NewProjectDialog
        open={creating}
        onCancel={() => setCreating(false)}
        onCreate={(preset, name) => {
          setCreating(false);
          void openAndGo(createProject(preset, name), 'setup/0');
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="プロジェクトを消しますか？"
        message={
          <p>
            「{deleting?.name}
            」をこのブラウザから消します。書き出したファイルは消えません。
            <strong>元には戻せません。</strong>
          </p>
        }
        confirmLabel="消す"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void deleteProject(target.id).then(refresh);
        }}
      />

      <Dialog
        open={importErrors !== null}
        title="ファイルを読み込めませんでした"
        onClose={() => setImportErrors(null)}
        actions={<Button onClick={() => setImportErrors(null)}>閉じる</Button>}
      >
        <ul className={styles.errors}>
          {importErrors?.slice(0, 20).map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        {importErrors && importErrors.length > 20 && (
          <p className="muted">ほか {importErrors.length - 20} 件</p>
        )}
      </Dialog>

      <Dialog
        open={sampleExists !== null}
        title="サンプルはすでにあります"
        onClose={() => setSampleExists(null)}
        actions={
          <>
            <Button
              onClick={() => {
                setSampleExists(null);
                openNewSample();
              }}
            >
              もう1つ作る
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const m = sampleExists;
                setSampleExists(null);
                if (m) void navigate(`/p/${m.id}`);
              }}
            >
              今あるサンプルを開く
            </Button>
          </>
        }
      >
        <p>
          「{sampleExists?.name}」はこのブラウザにあります（更新{' '}
          {sampleExists ? formatDate(sampleExists.updatedAt) : ''}
          ）。手を加えていても、そのまま開けます。
        </p>
      </Dialog>

      <Dialog
        open={conflict !== null}
        title="同じプロジェクトがすでにあります"
        onClose={() => setConflict(null)}
        actions={
          <>
            <Button onClick={() => setConflict(null)}>やめる</Button>
            <Button
              onClick={() => {
                const p = conflict;
                setConflict(null);
                if (p) void openAndGo(asCopy(p, newId(), now.current()), '');
              }}
            >
              別名で開く
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const p = conflict;
                setConflict(null);
                if (p) void openAndGo(p, '');
              }}
            >
              上書きする
            </Button>
          </>
        }
      >
        <p>
          「{conflict?.name}
          」はこのブラウザにもあります。ファイルの内容で上書きするか、別のプロジェクトとして開くか選んでください。
        </p>
      </Dialog>
    </div>
  );
}

function NewProjectDialog({
  open,
  onCancel,
  onCreate,
}: {
  open: boolean;
  onCancel: () => void;
  onCreate: (preset: Preset, name: string) => void;
}) {
  const [name, setName] = useState('');
  const [presetId, setPresetId] = useState<Preset['id']>('K');
  const preset = PRESETS.find((p) => p.id === presetId) ?? K_PRESET;
  const create = () => onCreate(preset, name.trim() || '新しい路線');
  return (
    <Dialog
      open={open}
      title="新しいプロジェクト"
      onClose={onCancel}
      actions={
        <>
          <Button onClick={onCancel}>やめる</Button>
          <Button variant="primary" onClick={create}>
            作ってウィザードへ
          </Button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="new-name">プロジェクト名</label>
        <input
          id="new-name"
          data-autofocus
          value={name}
          placeholder="例：瑠璃線系統"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) create();
          }}
        />
      </div>
      <fieldset className={styles.presets}>
        <legend>団体のプリセット</legend>
        {PRESETS.map((p) => (
          <label key={p.id} className={styles.presetOption}>
            <input
              type="radio"
              name="preset"
              value={p.id}
              checked={presetId === p.id}
              onChange={() => setPresetId(p.id)}
            />
            <span>
              {p.label}
              <span className="field-hint">
                {p.id === 'K'
                  ? '団体コード K、路線 L/B/Q/U/Y、種別 Lo/Ra/SR/EX/ET/Te、用途番号が入っています'
                  : '団体・路線・種別を自分で入力します'}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}
