import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { Project } from '../../domain/model';
import { workIds, workStatus } from '../../domain/progress';
import { PATTERN_LABELS, type PlatformCard, type StationCard } from '../../domain/signs';
import { StationLinks, type StationLinkItem } from '../components/StationLine';
import { Help } from '../components/Help';
import { useDerived, useProject } from '../hooks/useDerived';
import { stationCodesText } from '../editors/common';
import { ErrorsStop } from './CommandsView';
import { PlatformDiagram } from './PlatformDiagram';
import { SignView } from './SignView';
import { WorkCheck } from './WorkCheck';
import styles from './work.module.css';

/** 駅の駅コードの表示 */
function codesOf(project: Project, stationId: string): string {
  const st = project.stations.find((x) => x.id === stationId);
  return st ? stationCodesText(project, st) : '';
}

/** 開く駅：指定がなければ、まだ看板を置き終えていない最初の駅 */
function pickStation(cards: readonly StationCard[], done: (id: string) => boolean) {
  return (
    cards.find((c) => c.platformCards.some((pc) => pc.pattern !== 'foreign' && !done(pc.id))) ??
    cards[0]
  );
}

/** 作業「看板を置く」：左に駅の路線図、右にその駅ののりばごとの看板（design §6.3） */
export function SignsView() {
  const project = useProject();
  const { derived } = useDerived();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get('station');
  const isDone = (cardId: string) =>
    workStatus(project.progress, {
      id: workIds.install(cardId),
      hash: derived.platformCards.find((c) => c.id === cardId)?.hash ?? '',
    }) === 'done';
  const cards = derived.stationCards;
  const showAll = requested === 'all';
  const selected = showAll
    ? undefined
    : (cards.find((c) => c.stationId === requested) ?? pickStation(cards, isDone));
  const base = `/p/${project.id}/work/signs`;

  // 開いた駅を URL に固定する（チェックを付けるたびに次の駅へ移ってしまわないように）
  const pin = !requested && selected ? selected.stationId : undefined;
  useEffect(() => {
    if (pin) void navigate(`${base}?station=${encodeURIComponent(pin)}`, { replace: true });
  }, [pin, base, navigate]);

  if (derived.hasErrors) return <ErrorsStop />;

  const items: StationLinkItem[] = cards.map((c) => {
    const own = c.platformCards.filter((pc) => pc.pattern !== 'foreign');
    const done = own.filter((pc) => isDone(pc.id)).length;
    return {
      key: c.stationId,
      label: c.name || '（名前なし）',
      sub: c.foreign ? '相手の鉄道会社' : `${done} / ${own.length}`,
      state: own.length > 0 && done === own.length ? 'done' : 'todo',
      to: `${base}?station=${encodeURIComponent(c.stationId)}`,
      selected: c.stationId === selected?.stationId,
    };
  });

  return (
    <div className={styles.split}>
      <div className={`${styles.splitSide} no-print`}>
        <StationLinks items={items} label="看板を置く駅" />
        <p className={styles.allLink}>
          <Link to={`${base}?station=all`} replace>
            すべての駅を並べて見る（印刷用）
          </Link>
        </p>
      </div>
      <div className={styles.splitMain}>
        <p className={styles.caution}>
          看板は、ホームから線路を見て文字が正面に読める向き（線路と直角、文字面はホーム側）に付けます。
          列車の出る向きはゲーム内で未確認のルールから決めているので、置いたら必ず列車を出して確かめてください。
        </p>
        {showAll
          ? cards.map((s) => <StationCardView key={s.stationId} card={s} />)
          : selected && <StationCardView card={selected} />}
      </div>
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
        {card.name || '（名前なし）'}
        <span className={styles.stationCodes}>
          {codesOf(project, card.stationId)
            .split('・')
            .filter(Boolean)
            .map((c) => (
              <span key={c} className="code-tag">
                {c}
              </span>
            ))}
        </span>
        {card.foreign && <span className={styles.pill}>相手の鉄道会社の設定に従う</span>}
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
          {pf?.label && <span className={styles.platformLabel}>{pf.label}</span>}
        </h3>
        <span className={styles.destBox}>
          <span className="muted text-xs">行先コード</span>
          <span className="code-tag">{card.destCode}</span>
        </span>
      </header>
      <p className={styles.pattern}>{PATTERN_LABELS[card.pattern]}</p>
      {!isForeign && card.signs.length > 0 && (
        <>
          <p className={styles.step}>
            <span className={styles.stepNum}>1</span>
            ホームに立って線路を見たとき、
            {card.dir === 'left'
              ? '列車は右から左へ出ていきます。'
              : '列車は左から右へ出ていきます。'}
            左からこの順に看板を置きます。
          </p>
          <PlatformDiagram card={card} />
          <p className={styles.step}>
            <span className={styles.stepNum}>2</span>
            看板に書く文字（列車が進む順。番号は図と同じ）。1行ずつコピーできます。
          </p>
          <div className={styles.signRow}>
            {card.signs.map((s, i) => (
              <SignView key={i} sign={s} index={i + 1} />
            ))}
          </div>
          <p className={styles.order}>
            進む順：
            {card.signs
              .map(
                (s, i) =>
                  `${i + 1}枚目 ${s.lines[1]
                    .split(' ')
                    .slice(0, s.kind === 'skipDestroy' ? 2 : 1)
                    .join(' ')}`,
              )
              .join(' → ')}
          </p>
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
