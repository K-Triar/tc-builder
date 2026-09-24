import { useNavigate, useSearchParams } from 'react-router';
import { useProject } from '../hooks/useDerived';

/** 集中モードの中の移動（`/p/:id/start/` のあとのパスで指す） */
export function useFocusNav() {
  const project = useProject();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const base = `/p/${project.id}`;
  return {
    base,
    /** こたえの確認の「変える」から来たとき */
    fromCheck: params.get('from') === 'check',
    go: (path: string) => void navigate(`${base}/start/${path}`),
    /** 集中モードの外（いまここ・質問に答える画面など） */
    leave: (path: string) => void navigate(`${base}/${path}`),
  };
}
