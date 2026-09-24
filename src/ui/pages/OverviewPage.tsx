import { Link } from 'react-router';
import { buttonClass } from '../components/buttonClass';
import { RouteProgress } from '../components/RouteProgress';
import { ValidationSummary } from '../components/ValidationSummary';
import { useDerived, useJourney, useProject } from '../hooks/useDerived';
import { SETUP_STAGE_COUNT, splitIssues } from '../journey';
import styles from './OverviewPage.module.css';

/** 作業の段の説明（何を・どこで） */
const WORK_NOTE = {
  commands: 'Minecraft のチャットで、経路と編成を登録する',
  signs: '各駅のホームに看板を並べて置く',
  trial: '列車を走らせて、止まる駅・向き・行先を確かめる',
} as const;

/** いまここ（docs/redesign.md §8）：現在位置・次にやること・完成までの残り */
export function OverviewPage() {
  const project = useProject();
  const { derived } = useDerived();
  const j = useJourney();
  const base = `/p/${project.id}`;
  const finished = j.next.stage === 'done';
  const inputsDone = j.stages.slice(0, SETUP_STAGE_COUNT).every((s) => s.done);
  const workStages = j.stages.slice(SETUP_STAGE_COUNT, SETUP_STAGE_COUNT + 3);

  return (
    <div>
      <RouteProgress projectId={project.id} stages={j.stages} current={j.current} />

      <section className={`${styles.next} ${finished ? styles.finished : ''}`}>
        <span className="eyebrow">{finished ? '完成' : '次にやること'}</span>
        <h1 className={styles.nextTitle}>{j.next.title}</h1>
        <p className={styles.nextDetail}>{j.next.detail}</p>
        <Link to={`${base}/${j.next.path}`} className={buttonClass('primary', 'lg')}>
          {j.next.cta} <span aria-hidden="true">→</span>
        </Link>
      </section>

      <ValidationSummary
        projectId={project.id}
        issues={splitIssues(derived.issues, j.current).now}
        hideOk
      />

      <section className={styles.sheet} aria-labelledby="remain-title">
        <h2 id="remain-title" className={styles.sheetTitle}>
          完成までの道のり
        </h2>
        <ol className={styles.rows}>
          <li className={styles.row}>
            <span
              className={`${styles.mark} ${inputsDone ? styles.markDone : ''}`}
              aria-hidden="true"
            >
              {inputsDone ? '✓' : '1'}
            </span>
            <div className={styles.rowBody}>
              <Link to={`${base}/setup/0`} className={styles.rowTitle}>
                質問に答えて路線を入力する
              </Link>
              <span className={styles.rowNote}>
                {inputsDone
                  ? `済み（駅 ${project.stations.length}・系統 ${project.services.length}）`
                  : `いま：${j.stages[Math.min(j.current, SETUP_STAGE_COUNT - 1)]?.title}`}
              </span>
            </div>
            <span className={styles.rowCount}>
              {j.stages.slice(0, SETUP_STAGE_COUNT).filter((s) => s.done).length} /{' '}
              {SETUP_STAGE_COUNT}
            </span>
          </li>
          {workStages.map((s, i) => {
            const c = s.count ?? { done: 0, total: 0 };
            const pct = c.total === 0 ? 0 : Math.round((c.done / c.total) * 100);
            return (
              <li key={s.key} className={styles.row}>
                <span
                  className={`${styles.mark} ${s.done ? styles.markDone : ''}`}
                  aria-hidden="true"
                >
                  {s.done ? '✓' : i + 2}
                </span>
                <div className={styles.rowBody}>
                  {inputsDone ? (
                    <Link to={`${base}/${s.path}`} className={styles.rowTitle}>
                      {s.title}
                    </Link>
                  ) : (
                    <span className={styles.rowTitle}>{s.title}</span>
                  )}
                  <span className={styles.rowNote}>
                    {WORK_NOTE[s.key as keyof typeof WORK_NOTE]}
                  </span>
                  {inputsDone && c.total > 0 && (
                    <span className={styles.meter} aria-hidden="true">
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  )}
                </div>
                <span className={styles.rowCount}>
                  {inputsDone ? `${c.done} / ${c.total}` : '入力のあと'}
                </span>
              </li>
            );
          })}
        </ol>
        {inputsDone && (
          <p className={styles.total}>
            作業 {j.work.done} / {j.work.total} 済み
          </p>
        )}
      </section>

      <p className={styles.more}>
        入力を見直す：<Link to={`${base}/setup/0`}>質問に答える</Link>・
        <Link to={`${base}/edit/org`}>詳しく編集</Link>・
        <Link to={`${base}/docs/routes`}>資料（経路・編成の一覧）</Link>
      </p>
    </div>
  );
}
