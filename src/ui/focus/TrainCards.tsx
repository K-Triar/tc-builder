import { useId, useState, type ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { kindTag } from '../../domain/codes';
import type { Project, Service } from '../../domain/model';
import {
  autoServiceName,
  defaultServiceKind,
  formationForDirection,
  platformQuestionIndexes,
  reverseForGuide,
  suggestEntries,
  suggestPlatform,
} from '../../domain/suggest';
import * as ops from '../../store/projectOps';
import { useProjectStore } from '../../store/projectStore';
import { useToast } from '../toast';
import { Button } from '../components/Button';
import { Disclosure } from '../components/Disclosure';
import { SelectField, TextField } from '../components/Field';
import { must, newId } from '../editors/common';
import { useProject } from '../hooks/useDerived';
import { needsSigns } from '../journey';
import { FocusError, FocusFrame, type FocusMove } from './FocusFrame';
import { useFocusNav } from './useFocusNav';
import { focusProgress, TRAIN_MARK, TRAIN_QUESTIONS, type TrainQuestion } from './steps';
import styles from './Focus.module.css';

const stationName = (p: Project, id: string | undefined) =>
  p.stations.find((s) => s.id === id)?.name || '名前のない駅';

const kindNames = (p: Project, s: Service) =>
  s.kinds.map((k) => p.kinds.find((x) => x.id === k.kindId)?.name ?? '？').join('・');

const dirLabel = (s: Service) => (s.direction === 'up' ? '上り' : '下り');

const ends = (p: Project, s: Service) =>
  s.entries.length === 0
    ? '通る駅がまだありません'
    : `${stationName(p, s.entries[0]?.stationId)} → ${stationName(p, s.entries.at(-1)?.stationId)}`;

/** 列車の走り方の一覧と、作り終えたあとの戻り先 */
function useTrainNav() {
  const project = useProject();
  const nav = useFocusNav();
  return {
    ...nav,
    /** 集中モード中は一覧へ、そうでなければ質問に答える画面（表の画面）へ */
    toList: (serviceId?: string) =>
      project.guide
        ? nav.go('trains')
        : nav.leave(`setup/3${serviceId ? `?service=${encodeURIComponent(serviceId)}` : ''}`),
    quitTo: project.guide ? undefined : 'setup/3',
  };
}

/** D 列車の走り方の一覧（redesign2 §2-4）。操作は「作る」「直す」だけ */
export function TrainListCard() {
  const project = useProject();
  const setGuide = useProjectStore((s) => s.setGuide);
  const show = useToast((s) => s.show);
  const { go, leave } = useFocusNav();
  const [error, setError] = useState(false);
  const last = project.stations.at(-1);
  return (
    <FocusFrame
      section="D"
      progress={focusProgress('D', 0, TRAIN_QUESTIONS.length + 1)}
      title="列車の走り方"
      lead="どこからどこへ走るかを、向きごとに1つずつ作ります。"
      back={{ onClick: () => go(last ? `platforms/${last.id}` : 'stations') }}
      next={
        project.guide
          ? {
              label: '質問を終えて「いまここ」へ →',
              onClick: () => {
                if (project.services.length === 0) {
                  setError(true);
                  return;
                }
                setGuide(() => undefined);
                show('はじめての質問はここまでです。ここからは、次にやることを1つずつ案内します。');
                leave('');
              },
            }
          : { label: '質問に答える画面へ →', onClick: () => leave('setup/3') }
      }
    >
      {project.services.length === 0 ? (
        <p className="muted">まだありません。下のボタンから作ります。</p>
      ) : (
        <ul className={styles.services} aria-label="作った列車の走り方">
          {project.services.map((s) => {
            const unfinished = s.entries.length < 2 || s.kinds.length === 0;
            return (
              <li key={s.id}>
                <div className={styles.serviceHead}>
                  <strong>{ends(project, s)}</strong>
                  <span className="muted text-sm">
                    {dirLabel(s)}・{unfinished ? '作りかけ' : kindNames(project, s)}
                  </span>
                </div>
                <MiniLine service={s} />
                <div className="row">
                  {unfinished && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        go(`trains/${s.id}/${s.entries.length < 2 ? 'ends' : 'kinds'}`)
                      }
                    >
                      続きを答える
                    </Button>
                  )}
                  <Button
                    size="sm"
                    aria-label={`${s.name || ends(project, s)}を直す`}
                    onClick={() => leave(`setup/3?service=${encodeURIComponent(s.id)}`)}
                  >
                    直す
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Button
        variant={project.services.length === 0 ? 'primary' : 'secondary'}
        onClick={() => go('trains/new')}
      >
        ＋ 列車の走り方を作る
      </Button>
      {error && <FocusError>列車の走り方を1つ以上作ってください。</FocusError>}
    </FocusFrame>
  );
}

/** 始発から終点までの小さな路線図。どの種別も止まらない駅は小さく描く */
function MiniLine({ service }: { service: Service }) {
  return (
    <div className={styles.miniLine} aria-hidden="true">
      {service.entries.map((e, i) => (
        <span
          key={`${i}-${e.stationId}`}
          className={
            service.kinds.length > 0 && !service.kinds.some((k) => k.stops[i]) ? styles.pass : ''
          }
        />
      ))}
    </div>
  );
}

/** ①〜⑦ に共通の枠 */
function TrainFrame({
  q,
  title,
  lead,
  children,
  back,
  next,
  footer,
}: {
  q: TrainQuestion;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  back?: FocusMove | null;
  next?: FocusMove | null;
  footer?: ReactNode;
}) {
  const { quitTo } = useTrainNav();
  const pos = TRAIN_QUESTIONS.indexOf(q) + 1;
  return (
    <FocusFrame
      section="D"
      pos={pos}
      total={TRAIN_QUESTIONS.length}
      progress={focusProgress('D', pos, TRAIN_QUESTIONS.length + 1)}
      title={
        <>
          <span aria-hidden="true">{TRAIN_MARK[pos - 1]} </span>
          {title}
        </>
      }
      lead={lead}
      back={back}
      next={next}
      footer={footer}
      quitTo={quitTo}
    >
      {children}
    </FocusFrame>
  );
}

// ---- ① どこから、どこまで？ ----

/** ① 始発と終点。まだ作っていないとき（trains/new）と、作ったあとに選び直すときの両方 */
export function NewTrainCard({ service }: { service?: Service }) {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const { go, toList } = useTrainNav();
  const stations = project.stations;
  const [from, setFrom] = useState(service?.entries[0]?.stationId ?? stations[0]?.id ?? '');
  const [to, setTo] = useState(service?.entries.at(-1)?.stationId ?? stations.at(-1)?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const options = stations.map((s) => ({ value: s.id, label: s.name || '名前のない駅' }));

  const onNext = () => {
    if (stations.length < 2) {
      setError('先に駅を2つ以上登録してください。');
      return;
    }
    if (from === to) {
      setError('始発駅と終点駅は別の駅にしてください。');
      return;
    }
    const sameEnds =
      service?.entries[0]?.stationId === from && service?.entries.at(-1)?.stationId === to;
    if (service && sameEnds) {
      go(`trains/${service.id}/route`);
      return;
    }
    const entries = suggestEntries(project, from, to);
    const id = service?.id ?? newId();
    update(
      (p) => {
        const existing = p.services.find((s) => s.id === id);
        if (!existing) {
          p.services.push({ id, name: '', direction: 'down', entries, kinds: [] });
          return;
        }
        // 始発と終点を選び直したら、通る駅を並べ直し、止まる駅は全部停車に戻す
        existing.entries = entries;
        for (const k of existing.kinds) k.stops = entries.map(() => true);
        p.overrides.departure = Object.fromEntries(
          Object.entries(p.overrides.departure).filter(([key]) => !key.startsWith(`${id}#`)),
        );
      },
      { checkpoint: true },
    );
    go(`trains/${id}/route`);
  };

  return (
    <TrainFrame
      q="ends"
      title="列車はどの駅から、どの駅まで走りますか？"
      back={{ label: service ? '← 一覧へ' : '← やめる', onClick: () => toList(service?.id) }}
      next={{ onClick: onNext }}
    >
      <SelectField
        label="始発駅"
        value={from}
        options={options}
        onChange={(v) => {
          setFrom(v);
          setError(null);
        }}
      />
      <SelectField
        label="終点駅"
        value={to}
        options={options}
        hint="他の鉄道会社の線へ直通するときは、直通先の駅を選べます。"
        onChange={(v) => {
          setTo(v);
          setError(null);
        }}
      />
      {service && <p className="field-hint">選び直すと、通る駅と止まる駅は並べ直しになります。</p>}
      {error && <FocusError>{error}</FocusError>}
    </TrainFrame>
  );
}

/** ②〜⑦（作った列車の走り方について聞く） */
export function TrainCard({ serviceId, q }: { serviceId: string; q: TrainQuestion }) {
  const project = useProject();
  const service = project.services.find((s) => s.id === serviceId);
  if (!service) return <Navigate to={`/p/${project.id}/start/trains`} replace />;
  switch (q) {
    case 'ends':
      return <NewTrainCard service={service} />;
    case 'route':
      return <RouteCard service={service} />;
    case 'platforms':
      return <PlatformChoiceCard service={service} />;
    case 'kinds':
      return <KindsCard service={service} />;
    case 'stops':
      return <StopsCard service={service} />;
    case 'name':
      return <NameCard service={service} />;
    case 'reverse':
      return <ReverseCard service={service} />;
  }
}

/** のりばの質問のあと（④）と前（②）へのパス */
function afterRoute(project: Project, service: Service) {
  return platformQuestionIndexes(project, service).length > 0
    ? `trains/${service.id}/platforms?i=0`
    : `trains/${service.id}/kinds`;
}

function beforeKinds(project: Project, service: Service) {
  const n = platformQuestionIndexes(project, service).length;
  return n > 0 ? `trains/${service.id}/platforms?i=${n - 1}` : `trains/${service.id}/route`;
}

// ---- ② 通る駅を確かめる ----

function RouteCard({ service }: { service: Service }) {
  const project = useProject();
  const store = useProjectStore();
  const { go } = useTrainNav();
  const [adding, setAdding] = useState('');
  const [error, setError] = useState(false);
  const last = service.entries.length - 1;

  const add = () => {
    if (!adding) return;
    // 終点の手前に入れる（順番は上へ・下へで直す）
    const at = Math.max(1, last);
    const prev = service.entries[at - 1]?.stationId;
    const platform = suggestPlatform(project, prev, adding);
    store.insertEntry(service.id, at, { stationId: adding, platform });
    setAdding('');
  };

  return (
    <TrainFrame
      q="route"
      title="この順に通りますか？"
      lead="止まらずに通過する駅も入れます。分かれ道がある路線網では、足りない駅を足し、違う駅を外してください。"
      back={{ onClick: () => go(`trains/${service.id}/ends`) }}
      next={{
        label: 'この順でよい →',
        onClick: () => {
          if (service.entries.length < 2) {
            setError(true);
            return;
          }
          go(afterRoute(project, service));
        },
      }}
    >
      <ol className={styles.stops} aria-label="通る駅">
        {service.entries.map((e, i) => {
          const name = stationName(project, e.stationId);
          const role = i === 0 ? '（始発）' : i === last ? '（終点）' : '';
          return (
            <li key={`${i}-${e.stationId}`}>
              <span className={styles.stopDot} aria-hidden="true" />
              <span className={styles.stopName}>
                {name}
                {role && <span className={styles.stopRole}> {role}</span>}
              </span>
              {i > 0 && i < last && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`${name}を上へ`}
                    disabled={i <= 1}
                    onClick={() => store.moveEntry(service.id, i, i - 1)}
                  >
                    {'↑︎'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`${name}を下へ`}
                    disabled={i >= last - 1}
                    onClick={() => store.moveEntry(service.id, i, i + 1)}
                  >
                    {'↓︎'}
                  </Button>
                  <Button
                    size="sm"
                    aria-label={`${name}を外す`}
                    onClick={() => store.removeEntry(service.id, i)}
                  >
                    外す
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ol>
      <div className="add-row">
        <SelectField
          label="駅を足す（終点の手前に入ります）"
          value={adding}
          options={[
            { value: '', label: '駅を選ぶ…' },
            ...project.stations.map((s) => ({ value: s.id, label: s.name || '名前のない駅' })),
          ]}
          onChange={setAdding}
        />
        <Button disabled={!adding} onClick={add}>
          ＋ 足す
        </Button>
      </div>
      {error && <FocusError>駅を2つ以上にしてください。</FocusError>}
    </TrainFrame>
  );
}

// ---- ③ のりば（候補が1つに決まらない駅だけ聞く） ----

function PlatformChoiceCard({ service }: { service: Service }) {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const show = useToast((s) => s.show);
  const { go, toList } = useTrainNav();
  const [params] = useSearchParams();
  const [error, setError] = useState(false);
  const reversing = params.get('rev') === '1';
  const asked = platformQuestionIndexes(project, service);
  const i = Math.min(Math.max(Number(params.get('i')) || 0, 0), Math.max(asked.length - 1, 0));
  const entryIndex = asked[i];
  const entry = entryIndex === undefined ? undefined : service.entries[entryIndex];
  const station = project.stations.find((s) => s.id === entry?.stationId);
  const q = (n: number) => `trains/${service.id}/platforms?i=${n}${reversing ? '&rev=1' : ''}`;
  const finish = () => {
    if (reversing) {
      show(`反対向き「${service.name}」も作りました。`);
      toList(service.id);
    } else go(`trains/${service.id}/kinds`);
  };

  if (entry === undefined || entryIndex === undefined || !station) {
    return <Navigate to={`/p/${project.id}/start/trains/${service.id}/kinds`} replace />;
  }
  const signs = needsSigns(project, station);
  const auto = service.entries.filter((_, n) => !asked.includes(n));
  const choose = (platform: number | null) => {
    setError(false);
    update(
      (p) =>
        void (must(must(p.services.find((s) => s.id === service.id)).entries[entryIndex]).platform =
          platform),
    );
  };
  const position = entryIndex === 0 ? '出る' : '着く';

  return (
    <TrainFrame
      q="platforms"
      title={`${station.name || '名前のない駅'}では、何番のりばに${position}？`}
      lead={`のりばが2つ以上ある駅だけ聞きます（${i + 1} / ${asked.length} 駅目）。${
        entry.platform !== null && !reversing
          ? 'ほかの走り方から選んでおきました。違えば押し直してください。'
          : ''
      }`}
      back={{
        onClick: () =>
          i > 0 ? go(q(i - 1)) : reversing ? toList(service.id) : go(`trains/${service.id}/route`),
      }}
      next={{
        onClick: () => {
          if (entry.platform === null && signs) {
            setError(true);
            return;
          }
          if (i + 1 < asked.length) go(q(i + 1));
          else finish();
        },
      }}
    >
      <div className={styles.platformButtons} role="group" aria-label="のりば">
        {station.platforms.map((pf) => (
          <Button
            key={pf.number}
            size="lg"
            aria-pressed={entry.platform === pf.number}
            onClick={() => choose(pf.number)}
          >
            {pf.number}番{pf.label ? `（${pf.label}）` : ''}
          </Button>
        ))}
        {!signs && (
          <Button size="lg" aria-pressed={entry.platform === null} onClick={() => choose(null)}>
            未定（他の鉄道会社の区間）
          </Button>
        )}
      </div>
      {i === 0 && auto.length > 0 && (
        <Disclosure summary={`ほかの ${auto.length} 駅は、のりばが1つなので自動で決めました`}>
          <ul>
            {auto.map((e, n) => (
              <li key={`${n}-${e.stationId}`}>
                {stationName(project, e.stationId)}：
                {e.platform === null ? '未定' : `${e.platform}番`}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
      {error && <FocusError>のりばを選んでください。</FocusError>}
    </TrainFrame>
  );
}

// ---- ④ 走る種別 ----

function KindsCard({ service }: { service: Service }) {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const { go } = useTrainNav();
  const [error, setError] = useState(false);
  const toggle = (kindId: string, on: boolean) =>
    update(
      (p) => {
        const s = must(p.services.find((x) => x.id === service.id));
        if (!on) {
          ops.removeServiceKind(p, service.id, kindId);
          return;
        }
        if (s.kinds.some((k) => k.kindId === kindId)) return;
        // 種別の登録順（看板の並び順）に合わせて入れる
        const order = (id: string) => p.kinds.findIndex((k) => k.id === id);
        s.kinds.push(defaultServiceKind(p, kindId, s.direction, s.entries.length));
        s.kinds.sort((a, b) => order(a.kindId) - order(b.kindId));
      },
      { checkpoint: true },
    );
  return (
    <TrainFrame
      q="kinds"
      title="この区間を走る種別は？"
      back={{ onClick: () => go(beforeKinds(project, service)) }}
      next={{
        onClick: () => {
          if (service.kinds.length === 0) {
            setError(true);
            return;
          }
          go(`trains/${service.id}/stops?k=0`);
        },
      }}
    >
      <ul className={styles.choices}>
        {project.kinds.map((k) => (
          <li key={k.id}>
            <label className={styles.choice}>
              <input
                type="checkbox"
                checked={service.kinds.some((x) => x.kindId === k.id)}
                onChange={(e) => {
                  setError(false);
                  toggle(k.id, e.target.checked);
                }}
              />
              <span className={styles.choiceText}>{k.name || kindTag(k)}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="field-hint">形式コードや最高速度は自動で入ります。</p>
      {error && <FocusError>種別を1つ以上選んでください。</FocusError>}
    </TrainFrame>
  );
}

// ---- ⑤ 止まる駅（種別ごとに1画面） ----

function StopsCard({ service }: { service: Service }) {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const { go } = useTrainNav();
  const [params] = useSearchParams();
  const name = useId();
  const n = service.kinds.length;
  const k = Math.min(Math.max(Number(params.get('k')) || 0, 0), Math.max(n - 1, 0));
  const sk = service.kinds[k];
  const kind = project.kinds.find((x) => x.id === sk?.kindId);
  const last = service.entries.length - 1;
  const allStop = !!sk && sk.stops.every(Boolean);
  // 普通は先に「全部の駅に止まる？」と聞く
  const [mode, setMode] = useState<'all' | 'pick'>(
    kind?.typeCode === 'Lo' && allStop ? 'all' : 'pick',
  );
  if (!sk || !kind)
    return <Navigate to={`/p/${project.id}/start/trains/${service.id}/kinds`} replace />;
  const kindName = kind.name || kindTag(kind);

  const setStops = (fn: (i: number, now: boolean) => boolean) =>
    update(
      (p) => {
        const x = must(must(p.services.find((s) => s.id === service.id)).kinds[k]);
        x.stops = x.stops.map((v, i) => (i === 0 || i === last ? true : fn(i, v)));
      },
      { checkpoint: true },
    );

  return (
    <TrainFrame
      q="stops"
      title={`${kindName}が止まる駅を選んでください`}
      lead={n > 1 ? `種別ごとに聞きます（${kindName} ${k + 1} / ${n}）。` : undefined}
      back={{
        onClick: () =>
          go(k > 0 ? `trains/${service.id}/stops?k=${k - 1}` : `trains/${service.id}/kinds`),
      }}
      next={{
        onClick: () => {
          if (k + 1 < n) {
            go(`trains/${service.id}/stops?k=${k + 1}`);
            return;
          }
          // 名前がまだなければ、自動の名前を入れておく（次の質問で変えられる）
          update((p) => {
            const s = must(p.services.find((x) => x.id === service.id));
            if (!s.name.trim()) s.name = autoServiceName(p, s);
          });
          go(`trains/${service.id}/name`);
        },
      }}
    >
      {kind.typeCode === 'Lo' && (
        <fieldset className={styles.fieldset}>
          <legend className="visually-hidden">{kindName}は全部の駅に止まりますか</legend>
          <ul className={styles.choices}>
            {(
              [
                ['all', '全部の駅に止まる'],
                ['pick', '止まる駅を選ぶ'],
              ] as const
            ).map(([value, label]) => (
              <li key={value}>
                <label className={styles.choice}>
                  <input
                    type="radio"
                    name={name}
                    checked={mode === value}
                    onChange={() => {
                      setMode(value);
                      if (value === 'all') setStops(() => true);
                    }}
                  />
                  <span className={styles.choiceText}>{label}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      {mode === 'pick' && (
        <>
          <ul className={styles.stops} aria-label={`${kindName}の止まる駅`}>
            {service.entries.map((e, i) => {
              const stName = stationName(project, e.stationId);
              const fixed = i === 0 || i === last;
              const stops = fixed || !!sk.stops[i];
              return (
                <li key={`${i}-${e.stationId}`}>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={stops}
                      disabled={fixed}
                      onChange={() => setStops((j, now) => (j === i ? !now : now))}
                    />
                    <span className={styles.stopName}>{stName}</span>
                  </label>
                  <span className={styles.stopRole}>
                    {i === 0
                      ? '始発は必ず止まる'
                      : i === last
                        ? '終点は必ず止まる'
                        : stops
                          ? '停車'
                          : '通過'}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="row">
            <Button size="sm" onClick={() => setStops(() => true)}>
              全部止まる
            </Button>
            <Button size="sm" onClick={() => setStops(() => false)}>
              全部通過にする
            </Button>
          </div>
        </>
      )}
    </TrainFrame>
  );
}

// ---- ⑥ 名前と向き ----

function NameCard({ service }: { service: Service }) {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const { go } = useTrainNav();
  const name = useId();
  const auto = autoServiceName(project, service);
  const mut = (fn: (s: Service) => void) =>
    update((p) => fn(must(p.services.find((x) => x.id === service.id))));
  return (
    <TrainFrame
      q="name"
      title="この走り方の名前と向き"
      back={{
        onClick: () => go(`trains/${service.id}/stops?k=${Math.max(service.kinds.length - 1, 0)}`),
      }}
      next={{
        onClick: () => {
          if (!service.name.trim()) mut((s) => void (s.name = auto));
          go(`trains/${service.id}/reverse`);
        },
      }}
    >
      <TextField
        label="名前"
        value={service.name}
        placeholder={auto}
        hint={
          service.name === auto
            ? '自動で付けました。変えてもかまいません。'
            : '自分が見分けるための名前です。'
        }
        onChange={(v) => mut((s) => void (s.name = v))}
      />
      <fieldset className={styles.fieldset}>
        <legend className="label-row">向き</legend>
        <ul className={styles.choices}>
          {(
            [
              ['up', '上り'],
              ['down', '下り'],
            ] as const
          ).map(([value, label]) => (
            <li key={value}>
              <label className={styles.choice}>
                <input
                  type="radio"
                  name={name}
                  checked={service.direction === value}
                  onChange={() =>
                    update(
                      (p) => {
                        const s = must(p.services.find((x) => x.id === service.id));
                        s.direction = value;
                        // 形式番号の一の位を向きに合わせる（上りは奇数、下りは偶数）
                        for (const k of s.kinds)
                          k.formation = formationForDirection(k.formation, value);
                      },
                      { checkpoint: true },
                    )
                  }
                />
                <span className={styles.choiceText}>{label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <Disclosure summary="上り・下りの決め方">
        <p>
          上り・下りは、鉄道会社や路線ごとの決まりで選びます（ツールは推測しません）。形式番号の一の位が、上りは奇数、下りは偶数になります。
        </p>
      </Disclosure>
    </TrainFrame>
  );
}

// ---- ⑦ 反対向き ----

function ReverseCard({ service }: { service: Service }) {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const show = useToast((s) => s.show);
  const { go, toList } = useTrainNav();
  const first = stationName(project, service.entries[0]?.stationId);
  const lastName = stationName(project, service.entries.at(-1)?.stationId);

  const makeReverse = () => {
    const id = newId();
    const reversed = reverseForGuide(project, service, id);
    update((p) => void p.services.push(reversed), { checkpoint: true });
    if (platformQuestionIndexes(project, reversed).length > 0) {
      go(`trains/${id}/platforms?i=0&rev=1`);
    } else {
      show(`反対向き「${reversed.name}」も作りました。`);
      toList(id);
    }
  };

  return (
    <TrainFrame
      q="reverse"
      title="できました！"
      footer={
        <div className={styles.twoButtons}>
          <Button onClick={() => toList(service.id)}>作らない</Button>
          <Button variant="primary" onClick={makeReverse}>
            反対向きも作る（おすすめ）
          </Button>
        </div>
      }
    >
      <p className={styles.note}>
        <strong>{service.name || ends(project, service)}</strong>
        <br />
        {first} → {lastName}（{dirLabel(service)}） {kindNames(project, service)}
      </p>
      <MiniLine service={service} />
      <h2 className={styles.subQuestion}>
        反対向き（{lastName} → {first}）も作りますか？
      </h2>
      <p className="muted">
        通る駅と止まる駅を逆にして写します。のりばが決まらない駅だけ、もう一度聞きます。
      </p>
      <p>
        <Button size="sm" variant="ghost" onClick={() => go(`trains/${service.id}/name`)}>
          ← 名前と向きに戻る
        </Button>
      </p>
    </TrainFrame>
  );
}
