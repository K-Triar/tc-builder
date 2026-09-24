import { useSearchParams } from 'react-router';
import { workIds } from '../../domain/progress';
import { PATTERN_LABELS, type PlatformCard, type StationCard } from '../../domain/signs';
import { SelectField } from '../components/Field';
import { Help } from '../components/Help';
import { useDerived, useProject } from '../hooks/useDerived';
import { stationLabel } from '../editors/common';
import { ErrorsStop } from './CommandsView';
import { PlatformDiagram } from './PlatformDiagram';
import { SignView } from './SignView';
import { WorkCheck } from './WorkCheck';
import styles from './work.module.css';

/** 作業「駅の看板」：駅ごとにのりばカード＋C＋switcher（design §6.3） */
export function SignsView() {
  const project = useProject();
  const { derived } = useDerived();
  const [params, setParams] = useSearchParams();
  const only = params.get('station') ?? '';
  const cards = derived.stationCards.filter((s) => !only || s.stationId === only);
  if (derived.hasErrors) return <ErrorsStop />;

  return (
    <div>
      <div className={styles.toolbar}>
        <SelectField
          label="駅"
          value={only}
          options={[
            { value: '', label: `すべての駅（${derived.stationCards.length}）` },
            ...derived.stationCards.map((s) => ({
              value: s.stationId,
              label: stationLabel(project, s.stationId),
            })),
          ]}
          onChange={(v) =>
            setParams(
              (prev) => {
                const next = new URLSearchParams(prev);
                if (v) next.set('station', v);
                else next.delete('station');
                return next;
              },
              { replace: true },
            )
          }
        />
      </div>
      <p className={styles.caution}>
        看板は「ホームから線路を見て文字面が正面に見える向き」（線路と直角、文字面はホーム側）に付けます。
        spawn
        の向きはソースから調べた決まり方で、ゲーム内では未確認です。設置したら必ず試運転で向きを確かめてください。
      </p>
      {cards.map((s) => (
        <StationCardView key={s.stationId} card={s} />
      ))}
    </div>
  );
}

function StationCardView({ card }: { card: StationCard }) {
  const project = useProject();
  return (
    <section
      className={styles.station}
      id={`signs-${card.stationId}`}
      aria-labelledby={`st-${card.stationId}`}
    >
      <h2 id={`st-${card.stationId}`} className={styles.stationTitle}>
        {stationLabel(project, card.stationId)}
        {card.foreign && <span className={styles.pill}>相手団体の設定に従う</span>}
      </h2>
      {card.notes.map((n) => (
        <p key={n} className="muted">
          {n}
        </p>
      ))}
      {card.platformCards.map((pc) => (
        <PlatformCardView key={pc.id} card={pc} />
      ))}
      {card.cleanups.map((c) => (
        <div key={c.towardStationId} className={styles.extra}>
          <h3>
            C 空車削除：{project.stations.find((s) => s.id === c.towardStationId)?.name}方面の出口
            <Help>
              誰も乗らずに発車した列車を消す看板です。skip destroy は「人が乗っていれば次の destroy
              を飛ばす」、destroy は列車を消します。必ずこの順（進行方向順）に置きます。
            </Help>
          </h3>
          <p>{c.text}</p>
          <div className={styles.signRow}>
            {c.signs.map((s, i) => (
              <SignView key={i} sign={s} index={i + 1} />
            ))}
          </div>
        </div>
      ))}
      {card.switcher && (
        <div className={styles.extra}>
          <h3>
            switcher（ポイント）
            <Help topic="switcher" />
          </h3>
          <p>{card.switcher.text}</p>
          <ul>
            {card.switcher.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className={styles.signRow}>
            <SignView sign={card.switcher.sign} />
          </div>
        </div>
      )}
    </section>
  );
}

function PlatformCardView({ card }: { card: PlatformCard }) {
  const project = useProject();
  const station = project.stations.find((s) => s.id === card.stationId);
  const pf = station?.platforms.find((p) => p.number === card.platform);
  const isForeign = card.pattern === 'foreign';
  return (
    <article
      className={styles.platformCard}
      aria-label={`${station?.name} ${card.platform}番のりば`}
    >
      <header className={styles.platformHead}>
        <h3 className={styles.platformTitle}>
          {card.platform}番のりば
          {pf?.label && <span className="muted">（{pf.label}）</span>}
          <span className={styles.dest}>{card.destCode}</span>
        </h3>
        <span className={styles.pattern}>{PATTERN_LABELS[card.pattern]}</span>
      </header>
      {!isForeign && card.signs.length > 0 && (
        <>
          <PlatformDiagram card={card} />
          <p className={styles.order}>
            進行方向順：
            {card.signs
              .map(
                (s, i) =>
                  `${i + 1}枚目 ${s.lines[1]
                    .split(' ')
                    .slice(0, s.kind === 'skipDestroy' ? 2 : 1)
                    .join(' ')}`,
              )
              .join(' → ')}
            {card.dir && `（ホームから見て${card.dir === 'right' ? '左から右' : '右から左'}へ）`}
          </p>
          <div className={styles.signRow}>
            {card.signs.map((s, i) => (
              <SignView key={i} sign={s} index={i + 1} />
            ))}
          </div>
        </>
      )}
      {card.notes.length > 0 && (
        <ul className={styles.notes}>
          {card.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {!isForeign && (
        <div className={styles.checks}>
          <WorkCheck id={workIds.install(card.id)} label="設置した" />
          <WorkCheck id={workIds.trialPlatform(card.id)} label="試運転した" />
        </div>
      )}
    </article>
  );
}
