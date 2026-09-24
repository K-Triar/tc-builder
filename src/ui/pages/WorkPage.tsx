import { useParams } from 'react-router';
import { useDerived, useProject } from '../hooks/useDerived';
import { CommandsView } from '../work/CommandsView';
import { SignsView } from '../work/StationCards';
import { TrialView } from '../work/TrialView';
import { TabNav } from './TabNav';

/** 作業画面：①コマンド ②駅の看板 ③試運転（design §6.1） */
export function WorkPage() {
  const project = useProject();
  const { progress } = useDerived();
  const tab = useParams().tab ?? 'signs';
  const count = (c: { done: number; total: number }) => `${c.done}/${c.total}`;
  const cmd = {
    done: progress.routes.done + progress.formations.done,
    total: progress.routes.total + progress.formations.total,
  };
  return (
    <div>
      <h1 className="no-print">作業</h1>
      <TabNav
        base={`/p/${project.id}/work`}
        label="作業の種類"
        tabs={[
          { key: 'commands', label: '① コマンド', badge: count(cmd) },
          { key: 'signs', label: '② 駅の看板', badge: count(progress.platforms) },
          { key: 'trial', label: '③ 試運転', badge: count(progress.trials) },
        ]}
      />
      {tab === 'commands' && <CommandsView />}
      {tab === 'signs' && <SignsView />}
      {tab === 'trial' && <TrialView />}
    </div>
  );
}
