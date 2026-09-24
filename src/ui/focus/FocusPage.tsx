import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router';
import { useProjectStore } from '../../store/projectStore';
import { ToastHost } from '../components/ToastHost';
import { useProject } from '../hooks/useDerived';
import { SetupCard } from './SetupCards';
import { PlatformCard, StationsCard } from './StationCards';
import { isSetupQuestion, isTrainQuestion } from './steps';
import { NewTrainCard, TrainCard, TrainListCard } from './TrainCards';

/**
 * はじめての質問（集中モード、redesign2 §2）。1問ごとに URL を持つ画面にする（§5 P1）。
 * 開いた質問は project.guide.at に覚えておき、ホームの「続きから」で同じ質問に戻る。
 */
export function FocusPage() {
  const project = useProject();
  const setGuide = useProjectStore((s) => s.setGuide);
  const splat = useParams()['*'] ?? '';
  const { search, pathname } = useLocation();
  const parts = splat.split('/').filter(Boolean);
  const at = parts.join('/') + search;

  useEffect(() => {
    setGuide((g) => (g.at === at ? g : { ...g, at }));
  }, [at, setGuide]);

  // 質問が変わったら：上へ戻し、見出しを読み上げる。タブのタイトルも質問にする
  useEffect(() => {
    window.scrollTo?.(0, 0);
    const h1 = document.querySelector<HTMLElement>('h1');
    if (h1) {
      h1.tabIndex = -1;
      h1.focus({ preventScroll: true });
      document.title = [h1.textContent, project.name, 'KT式 TC ビルダー']
        .filter(Boolean)
        .join(' – ');
    }
    // 名前を打つたびには動かさない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const [q = '', sub, leaf] = parts;
  const page = (() => {
    if (isSetupQuestion(q) && !sub) return <SetupCard key={q} q={q} />;
    if (q === 'stations' && !sub) return <StationsCard />;
    if (q === 'platforms') return <PlatformCard key={sub ?? ''} stationId={sub} />;
    if (q === 'trains') {
      if (!sub) return <TrainListCard />;
      if (sub === 'new') return <NewTrainCard />;
      if (leaf && isTrainQuestion(leaf)) {
        return <TrainCard key={`${sub}/${leaf}${search}`} serviceId={sub} q={leaf} />;
      }
    }
    return null;
  })();

  if (!page) {
    const fallback = project.guide?.at && project.guide.at !== at ? project.guide.at : 'name';
    return <Navigate to={`/p/${project.id}/start/${fallback}`} replace />;
  }
  return (
    <>
      <main id="main">{page}</main>
      <ToastHost />
    </>
  );
}
