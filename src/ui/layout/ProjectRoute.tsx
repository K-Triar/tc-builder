import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { loadProject } from '../../storage/db';
import { useProjectStore } from '../../store/projectStore';
import { ProjectLayout } from './ProjectLayout';

/** URL のプロジェクトを読み込んでからレイアウトを出す */
export function ProjectRoute() {
  const { id = '' } = useParams();
  const current = useProjectStore((s) => s.project);
  const open = useProjectStore((s) => s.open);
  const [state, setState] = useState<'loading' | 'missing' | { error: string }>('loading');

  useEffect(() => {
    if (current?.id === id) return;
    let cancelled = false;
    loadProject(id)
      .then((p) => {
        if (cancelled) return;
        if (p) open(p);
        else setState('missing');
      })
      .catch((e: Error) => !cancelled && setState({ error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [id, current?.id, open]);

  if (current?.id === id) return <ProjectLayout />;
  return (
    <main style={{ padding: 'var(--space-6) var(--space-4)', maxWidth: 720, margin: '0 auto' }}>
      {state === 'loading' ? (
        <p className="muted">読み込み中…</p>
      ) : (
        <>
          <h1>プロジェクトを開けませんでした</h1>
          <p>
            {state === 'missing'
              ? 'このブラウザにこのプロジェクトはありません。書き出したファイルがあれば、ホームから開いてください。'
              : state.error}
          </p>
          <Link to="/">ホームへ戻る</Link>
        </>
      )}
    </main>
  );
}
