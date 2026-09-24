import { Link } from 'react-router';
import { GENERAL_CHECKS, workIds, workStatus } from '../../domain/progress';
import { TROUBLESHOOTING } from '../../content/help';
import { useDerived, useJourney, useProject } from '../hooks/useDerived';
import { WorkCheck } from './WorkCheck';
import styles from './work.module.css';

/** 作業「試運転」：仕上げの確認項目と系統ごとの試運転（R10、入門ガイドのチェックリスト） */
export function TrialView() {
  const project = useProject();
  const { derived, workItems } = useDerived();
  const j = useJourney();
  const platformTrials = workItems.filter((i) => i.id.startsWith('trial:') && i.id.includes('#'));
  const doneTrials = platformTrials.filter(
    (i) => workStatus(project.progress, i) === 'done',
  ).length;

  return (
    <div>
      {j.next.stage === 'done' && (
        <section className={styles.complete} aria-labelledby="complete-title">
          <span className={styles.completeMark} aria-hidden="true" />
          <div>
            <h2 id="complete-title">路線が完成しました</h2>
            <p>
              看板・コマンド・試運転がすべて済みました。入力を変えたときは、変わったところに「要更新」の印が付きます。
            </p>
          </div>
        </section>
      )}
      <section className={styles.extra}>
        <h2>仕上げの確認</h2>
        <div className="stack">
          {GENERAL_CHECKS.map((c) => (
            <div key={c.id}>
              <WorkCheck id={c.id} label={c.label} />
            </div>
          ))}
          <div>
            <WorkCheck id={workIds.trialSwitchers} label="全ポイントに switcher を置いた" />
          </div>
        </div>
      </section>

      <section className={styles.extra}>
        <h2>系統ごとの試運転</h2>
        <p className="muted">
          始発から終点まで走らせ、停車駅で止まり、通過駅を通過し、分岐で正しい方へ行くことを確かめます。
        </p>
        <div className="stack">
          {project.services.map((s) => {
            const codes = [
              ...new Set(
                derived.departures
                  .filter((d) => d.serviceId === s.id && d.formationCode)
                  .map((d) => d.formationCode),
              ),
            ];
            return (
              <div key={s.id}>
                <WorkCheck id={workIds.trialService(s.id)} label={s.name || '（名前なし）'} />
                {codes.length > 0 && (
                  <div className={`muted mono text-xs ${styles.checkNote}`}>{codes.join('、')}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.extra}>
        <h2>のりばごとの試運転</h2>
        <p>
          {doneTrials}/{platformTrials.length} のりば確認済み。のりばごとのチェックは
          <Link to={`/p/${project.id}/work/signs`}>駅の看板</Link>のカードで付けます。
        </p>
      </section>

      <section className={styles.extra}>
        <h2>うまくいかないとき</h2>
        <div
          className={styles.scrollX}
          tabIndex={0}
          role="region"
          aria-label="うまくいかないときの表"
        >
          <table className={styles.trouble}>
            <thead>
              <tr>
                <th scope="col">症状</th>
                <th scope="col">原因と対処</th>
              </tr>
            </thead>
            <tbody>
              {TROUBLESHOOTING.map((t) => (
                <tr key={t.symptom}>
                  <th scope="row">{t.symptom}</th>
                  <td>{t.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
