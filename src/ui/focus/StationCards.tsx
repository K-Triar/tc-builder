import { useState } from 'react';
import { GuidedStations, StationPlatforms } from '../editors/StationEditor';
import { codeText } from '../editors/common';
import { useProject } from '../hooks/useDerived';
import { needsSigns } from '../journey';
import { FocusError, FocusFrame } from './FocusFrame';
import { useFocusNav } from './useFocusNav';
import { focusProgress } from './steps';

/** B 駅（redesign2 §2-2） */
export function StationsCard() {
  const project = useProject();
  const { go } = useFocusNav();
  const [error, setError] = useState<string | null>(null);
  return (
    <FocusFrame
      section="B"
      progress={focusProgress('B', 0, 1)}
      title="列車が通る駅を、端から順に入れてください"
      lead="止まらずに通過するだけの駅や、直通先の他の鉄道会社の駅も入れます。駅コードは自動で付きます。"
      back={{ onClick: () => go('check') }}
      next={{
        label: 'のりばの設定へ進む →',
        onClick: () => {
          const first = project.stations[0];
          if (project.stations.length < 2 || !first) {
            setError('駅を2つ以上入れてください。');
            return;
          }
          if (project.stations.some((s) => !s.name.trim())) {
            setError('名前のない駅があります。名前を入れてください。');
            return;
          }
          go(`platforms/${first.id}`);
        },
      }}
    >
      <GuidedStations />
      {error && <FocusError>{error}</FocusError>}
    </FocusFrame>
  );
}

/** C のりば：1駅＝1カード（redesign2 §2-3）。左右の絵で向きを選ぶ今の部品を使う */
export function PlatformCard({ stationId }: { stationId?: string }) {
  const project = useProject();
  const { go } = useFocusNav();
  const stations = project.stations;
  const index = Math.max(
    0,
    stations.findIndex((s) => s.id === stationId),
  );
  const station = stations[index];
  if (!station) {
    return (
      <FocusFrame
        section="C"
        progress={focusProgress('C', 0, 1)}
        title="先に駅を登録してください"
        back={{ onClick: () => go('stations') }}
      />
    );
  }
  const prev = stations[index - 1];
  const next = stations[index + 1];
  const signs = needsSigns(project, station);
  return (
    <FocusFrame
      section="C"
      pos={index + 1}
      total={stations.length}
      progress={focusProgress('C', index, stations.length)}
      title={
        signs
          ? `${station.name || '名前のない駅'}：列車はどちらへ進みますか？`
          : `${station.name || '名前のない駅'}ののりば`
      }
      lead={
        signs
          ? 'ホームに立って線路を見たとき、列車が左右どちらへ出ていくかを、のりばごとに選びます。'
          : `看板は相手の鉄道会社が置く駅です。行先に使う、のりばの番号だけ確かめます（行先コード ${station.platforms
              .map((p) => `${codeText(project, station, p.codeId)}-${p.number}`)
              .join('・')}）。`
      }
      back={{ onClick: () => go(prev ? `platforms/${prev.id}` : 'stations') }}
      next={{
        label: next ? `次の駅：${next.name || '名前のない駅'} →` : '列車の走り方へ進む →',
        onClick: () => go(next ? `platforms/${next.id}` : 'trains'),
      }}
    >
      <StationPlatforms stationId={station.id} />
    </FocusFrame>
  );
}
