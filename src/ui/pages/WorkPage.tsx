import { useParams } from 'react-router';
import { useJourney, useProject } from '../hooks/useDerived';
import { stageIndex } from '../journey';
import { CommandsView } from '../work/CommandsView';
import { SignsView } from '../work/StationCards';
import { TrialView } from '../work/TrialView';
import { TabNav } from './TabNav';
import styles from './WorkPage.module.css';

/** 手順ごとの「何を・どこで・何を確かめる」（docs/redesign.md §5 作業画面） */
const TASKS = {
  commands: {
    stage: 'commands',
    title: 'コマンドを打つ',
    what: '経路（列車が通る駅の順番）と編成（列車の種類ごとの速さ・行き先）を、コマンドで保存します。',
    where:
      'Minecraft のチャット。「0. 準備」で列車を出して乗り、降りずに上から順に1行ずつ貼り付けます。',
    check: 'まとまりを打ち終えるごとに「実行した」に印を付けます。',
  },
  signs: {
    stage: 'signs',
    title: '看板を置く',
    what: '各のりばに、決まった順番で看板を並べて置きます。',
    where: '各駅のホーム。ホームに立って線路を見たとき、左から図の順に置きます。',
    check: '置いたら「設置した」、列車を出して向きを確かめたら「試運転した」に印を付けます。',
  },
  trial: {
    stage: 'trial',
    title: '試運転する',
    what: '列車を始発から終点まで走らせて、路線全体を確かめます。',
    where: 'Minecraft の路線全体。',
    check: '止まる駅で止まり、通過する駅を通過し、分かれ道で正しい方へ進むか。',
  },
} as const;

type TabKey = keyof typeof TASKS;

/** 設置する：① コマンドを打つ ② 看板を置く ③ 試運転する（design §6.1） */
export function WorkPage() {
  const project = useProject();
  const j = useJourney();
  const raw = useParams().tab ?? 'signs';
  const tab: TabKey = raw in TASKS ? (raw as TabKey) : 'signs';
  const task = TASKS[tab];
  const count = (key: TabKey) => {
    const c = j.stages[stageIndex(TASKS[key].stage)]?.count;
    if (!c || c.total === 0) return undefined;
    return c.done === c.total ? '✓ 済み' : `${c.done} / ${c.total}`;
  };

  return (
    <div>
      <TabNav
        base={`/p/${project.id}/work`}
        label="設置の手順"
        tabs={[
          { key: 'commands', label: '① コマンドを打つ', badge: count('commands') },
          { key: 'signs', label: '② 看板を置く', badge: count('signs') },
          { key: 'trial', label: '③ 試運転する', badge: count('trial') },
        ]}
      />
      <header className={`${styles.task} no-print`}>
        <h1 className={styles.title}>{task.title}</h1>
        <dl className={styles.taskList}>
          <dt>何をする</dt>
          <dd>{task.what}</dd>
          <dt>どこで</dt>
          <dd>{task.where}</dd>
          <dt>確かめる</dt>
          <dd>{task.check}</dd>
        </dl>
      </header>
      {tab === 'commands' && <CommandsView />}
      {tab === 'signs' && <SignsView />}
      {tab === 'trial' && <TrialView />}
    </div>
  );
}
