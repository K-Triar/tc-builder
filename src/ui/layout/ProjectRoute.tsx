import { useEffect, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router';
import { loadProject } from '../../storage/db';
import { useProjectStore } from '../../store/projectStore';

/** URL のプロジェクトを読み込んでから中身（集中モードか、ふだんのレイアウト）を出す */
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

  if (current?.id === id) return <Outlet />;
  return (
    <main className="page-narrow">
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
