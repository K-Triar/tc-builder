import { useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { Project } from '../../domain/model';
import { Button } from '../components/Button';
import { Disclosure } from '../components/Disclosure';
import { Section } from '../components/Field';
import { RouteProgress } from '../components/RouteProgress';
import { StationLinks } from '../components/StationLine';
import { ValidationSummary } from '../components/ValidationSummary';
import { codeText, must, stationCodesText } from '../editors/common';
import { ReviewEditor } from '../editors/ReviewEditor';
import { RouteBasics } from '../editors/RouteBasics';
import { ServiceEditor } from '../editors/ServiceEditor';
import { GuidedStations, StationPlatforms } from '../editors/StationEditor';
import { useDerived, useJourney, useProject } from '../hooks/useDerived';
import {
  needsSigns,
  SETUP_STAGE_COUNT,
  STAGE_OF_TARGET,
  STAGES,
  stationNeedsDirs,
} from '../journey';
import styles from './WizardPage.module.css';

/** 段ごとの「今やること」と「なぜ」（docs/redesign.md §6 Level 1・2） */
const INTRO: readonly string[] = [
  'この路線の名前と、どの鉄道会社の路線かを確かめます。会社のコードと列車の種類は入力済みです。路線のコードがまだなければ、ここで入れます。',
  '列車が通る駅を、路線の端から順に登録します。止まらずに通過するだけの駅や、直通先の他団体の駅も入れます。駅コードは自動で付きます。',
  'ホームに立って線路を見たとき、列車が左右どちらへ出ていくかを、駅ごとに選びます。これで看板を並べる順番が決まります。',
  '列車がどこからどこへ、どの駅を通って走るかを決めます。列車の種類（各停・快速など）ごとに、止まる駅に ○ を付けます。',
  '入力した内容から、看板に書く文字と、ゲーム内で打つコマンドを自動でつくりました。問題がなければ Minecraft での設置に進みます。',
];

/** 「詳しく編集」の対応するタブ */
const EDIT_TAB = ['org', 'stations', 'stations', 'services', 'review'] as const;

/** のりばの段で開いている駅（指定がなければ、向きが決まっていない最初の駅） */
function platformStation(project: Project, requested: string | null) {
  return (
    project.stations.find((s) => s.id === requested) ??
    project.stations.find((s) => stationNeedsDirs(project, s)) ??
    project.stations[0]
  );
}

/** 質問に答える画面（design §6.2 を 5 段に再編）。どの段にも戻れ、途中でも自動保存される */
export function WizardPage() {
  const project = useProject();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { derived } = useDerived();
  const j = useJourney();
  const step = Math.min(Math.max(Number(useParams().step) || 0, 0), SETUP_STAGE_COUNT - 1);
  const stage = must(STAGES[step]);
  const nextStage = must(STAGES[step + 1]);
  const base = `/p/${project.id}`;
  const go = (path: string) => void navigate(`${base}/${path}`);
  const stageIssues = derived.issues.filter((i) => STAGE_OF_TARGET[i.target.kind] === stage.key);

  // のりばの段は1駅ずつ。次へは次の駅へ、最後の駅から次の段へ
  const pfStation = step === 2 ? platformStation(project, params.get('station')) : undefined;
  const pfIndex = pfStation ? project.stations.indexOf(pfStation) : -1;
  const nextStation = step === 2 ? project.stations[pfIndex + 1] : undefined;

  // 開いた駅を URL に固定する（答えるたびに「向きが未入力の最初の駅」へ移ってしまわないように）
  const pinStation = step === 2 && !params.get('station') ? pfStation?.id : undefined;
  useEffect(() => {
    if (pinStation) {
      void navigate(`${base}/setup/2?station=${encodeURIComponent(pinStation)}`, {
        replace: true,
      });
    }
  }, [pinStation, base, navigate]);

  const primary = (() => {
    if (step === 2 && nextStation) {
      return {
        label: `次の駅：${nextStation.name || '名前のない駅'} →`,
        onClick: () => go(`setup/2?station=${encodeURIComponent(nextStation.id)}`),
      };
    }
    if (step === SETUP_STAGE_COUNT - 1) {
      return derived.hasErrors
        ? { label: 'いまここへ戻る', onClick: () => go('') }
        : { label: '設置を始める →', onClick: () => go('work/commands') };
    }
    return { label: `次へ：${nextStage.label} →`, onClick: () => go(nextStage.path) };
  })();

  return (
    <div>
      <RouteProgress projectId={project.id} stages={j.stages} current={j.current} here={step} />
      <header className={styles.head}>
        <span className="eyebrow">
          質問 {step + 1} / {SETUP_STAGE_COUNT}
          {step < SETUP_STAGE_COUNT - 1 && `・次は「${nextStage.label}」`}
        </span>
        <h1>{stage.title}</h1>
        <p className={styles.intro}>{INTRO[step]}</p>
      </header>

      {step !== SETUP_STAGE_COUNT - 1 && (
        <ValidationSummary projectId={project.id} issues={stageIssues} hideOk />
      )}

      {step === 0 && <RouteBasics />}
      {step === 1 && <GuidedStations />}
      {step === 2 && <PlatformStep stationId={pfStation?.id} />}
      {step === 3 && <ServiceEditor guided />}
      {step === 4 && <GenerateStep />}

      <nav className={`${styles.moveBar} no-print`} aria-label="質問の移動">
        {step === 0 ? (
          <Button onClick={() => go('')}>← いまここ</Button>
        ) : (
          <Button onClick={() => go(must(STAGES[step - 1]).path)}>← 戻る</Button>
        )}
        <Link to={`${base}/edit/${EDIT_TAB[step]}`} className={styles.tableLink}>
          表でまとめて直す（詳しく編集）
        </Link>
        <Button variant="primary" onClick={primary.onClick}>
          {primary.label}
        </Button>
      </nav>
    </div>
  );
}

function PlatformStep({ stationId }: { stationId?: string }) {
  const project = useProject();
  const base = `/p/${project.id}/setup/2`;
  const station = project.stations.find((s) => s.id === stationId);
  if (project.stations.length === 0) {
    return <p className="muted">先に「駅」の段で駅を登録してください。</p>;
  }
  const items = project.stations.map((s) => {
    const signs = needsSigns(project, s);
    const missing = s.platforms.filter((p) => !p.dir).length;
    return {
      key: s.id,
      label: s.name || '（名前なし）',
      sub: !signs
        ? '相手の団体'
        : missing > 0
          ? `向き未入力 ${missing}`
          : `${s.platforms.length} のりば`,
      state: (signs && missing > 0 ? 'warn' : 'done') as 'warn' | 'done',
      to: `${base}?station=${encodeURIComponent(s.id)}`,
      selected: s.id === stationId,
    };
  });
  return (
    <div className={styles.split}>
      <div className={styles.splitSide}>
        <StationLinks items={items} label="のりばを設定する駅" />
      </div>
      <section className={`card ${styles.splitMain}`} aria-labelledby="pf-station">
        {station && (
          <>
            <h2 id="pf-station" className={styles.stationTitle}>
              {station.name || '（名前なし）'}
              <span className={styles.stationCodes}>
                {stationCodesText(project, station)
                  .split('・')
                  .filter(Boolean)
                  .map((c) => (
                    <span key={c} className="code-tag">
                      {c}
                    </span>
                  ))}
              </span>
            </h2>
            {station.platforms.length > 1 && (
              <p className="section-lead">
                のりば {station.platforms.map((p) => `${p.number}番`).join('・')}（行先コード{' '}
                {station.platforms
                  .map((p) => `${codeText(project, station, p.codeId)}-${p.number}`)
                  .join('・')}
                ）
              </p>
            )}
            <StationPlatforms key={station.id} stationId={station.id} />
          </>
        )}
      </section>
    </div>
  );
}

function GenerateStep() {
  const project = useProject();
  const { derived } = useDerived();
  const cards = derived.platformCards.filter((c) => c.pattern !== 'foreign');
  const signCount = cards.reduce((n, c) => n + c.signs.length, 0);
  const made = [
    { n: derived.routes.length, unit: '経路', what: '列車が通る駅の順番（コマンドで登録）' },
    {
      n: derived.formations.filter((f) => !f.foreign).length,
      unit: '編成',
      what: '列車の種類ごとの速さ・行き先（コマンドで登録）',
    },
    { n: cards.length, unit: 'のりば', what: `看板を置く場所（看板 ${signCount} 枚）` },
  ];
  return (
    <>
      <ValidationSummary
        projectId={project.id}
        issues={derived.issues}
        okText="設定に問題はありません。Minecraft での設置に進めます。"
        max={8}
      />
      <Section title="自動でできたもの">
        <ul className={styles.made}>
          {made.map((m) => (
            <li key={m.unit}>
              <span className={styles.madeNum}>
                {m.n}
                <small>{m.unit}</small>
              </span>
              <span className="muted">{m.what}</span>
            </li>
          ))}
        </ul>
        <p className="field-hint">
          一覧は <Link to={`/p/${project.id}/docs/routes`}>資料</Link> で見られます。
        </p>
        <Disclosure summary="自動で決めた内容を直す（詳しい人向け：経路に入れる駅・各駅発）">
          <ReviewEditor />
        </Disclosure>
      </Section>
    </>
  );
}
