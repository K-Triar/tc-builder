import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '../components/Button';
import { Section } from '../components/Field';
import { Stepper, type StepMark } from '../components/Stepper';
import { KindEditor } from '../editors/KindEditor';
import { LineEditor, OrgEditor } from '../editors/OrgEditor';
import { ReviewEditor } from '../editors/ReviewEditor';
import { ServiceEditor } from '../editors/ServiceEditor';
import { StationEditor } from '../editors/StationEditor';
import { useDerived, useProject } from '../hooks/useDerived';
import { issueCounts } from '../issues';
import type { IssueTarget } from '../../domain/validate';
import styles from './WizardPage.module.css';

const WIZARD_STEPS = ['団体', '路線', '種別', '駅', 'のりば', '系統', '確認', '完成'] as const;

const INTRO: Record<number, string> = {
  0: 'まず、自分の団体と、直通する相手の団体を登録します。',
  1: '路線と路線コードを確かめます。K のプリセットなら入力済みです。',
  2: '使う種別を確かめます。愛称のある列車（新快速 LSR、特急みかり MKR など）は列車名コードを足します。',
  3: '駅を登録します。通過する駅や、他団体の駅（直通先）も入れます。',
  4: 'のりばごとに、ホームに立って線路を見たときの列車の進む向きを選びます。',
  5: '系統ごとに、列車が通る駅とのりばを順に並べ、種別ごとの停車駅を ○/× で入れます。',
  6: '自動で決めた「経路に入れる駅」と「各駅発」を確かめます。ふつうはそのままで大丈夫です。',
  7: '入力はここまでです。',
};

/** 検証の対象を、それを直すウィザードのステップに対応させる */
const STEP_OF: Record<IssueTarget['kind'], number> = {
  org: 0,
  line: 1,
  kind: 2,
  station: 3,
  platform: 4,
  service: 5,
  formation: 5,
  departure: 6,
  route: 6,
};

/** ウィザード（design §6.2）。どのステップにも戻れ、途中でも自動保存される */
export function WizardPage() {
  const project = useProject();
  const navigate = useNavigate();
  const step = Math.min(Math.max(Number(useParams().step) || 0, 0), WIZARD_STEPS.length - 1);
  const go = (n: number) => void navigate(`/p/${project.id}/setup/${n}`);
  const { derived } = useDerived();
  const marks: StepMark[] = WIZARD_STEPS.map(() => undefined);
  for (const issue of derived.issues) {
    const i = STEP_OF[issue.target.kind];
    if (issue.severity === 'error') marks[i] = 'error';
    else if (issue.severity === 'warning' && marks[i] !== 'error') marks[i] = 'warning';
  }

  return (
    <div>
      <h1>ウィザード：{WIZARD_STEPS[step]}</h1>
      <Stepper steps={WIZARD_STEPS} current={step} onSelect={go} marks={marks} />
      <p className={styles.intro}>{INTRO[step]}</p>
      {step === 0 && <OrgEditor />}
      {step === 1 && <LineEditor />}
      {step === 2 && <KindEditor />}
      {step === 3 && <StationEditor part="basic" />}
      {step === 4 && <StationEditor part="platforms" />}
      {step === 5 && <ServiceEditor />}
      {step === 6 && <ReviewEditor />}
      {step === 7 && <Finish />}
      <nav className={`${styles.moveBar} no-print`} aria-label="ウィザードの移動">
        <Button disabled={step === 0} onClick={() => go(step - 1)}>
          ← 戻る
        </Button>
        <Link to={`/p/${project.id}/edit/org`} className={styles.tableLink}>
          表形式でまとめて編集する
        </Link>
        {step < WIZARD_STEPS.length - 1 ? (
          <Button variant="primary" onClick={() => go(step + 1)}>
            次へ →
          </Button>
        ) : (
          <Button variant="primary" onClick={() => void navigate(`/p/${project.id}/work/signs`)}>
            作業を始める →
          </Button>
        )}
      </nav>
    </div>
  );
}

function Finish() {
  const project = useProject();
  const { derived } = useDerived();
  const counts = issueCounts(derived.issues);
  return (
    <Section title="完成">
      {counts.error > 0 ? (
        <p role="alert" className={styles.finishError}>
          ✖ エラーが {counts.error}{' '}
          件あります。検証の一覧から該当する入力を直してください。エラーがあると、その部分の看板やコマンドが正しく出ません。
        </p>
      ) : (
        <p className={styles.finishOk}>
          ✓ エラーはありません。
          {counts.warning > 0 &&
            `警告が ${counts.warning} 件あるので、検証の一覧で確かめてください。`}
        </p>
      )}
      <ul>
        <li>
          経路 {derived.routes.length}・編成 {derived.formations.filter((f) => !f.foreign).length}
          ・看板を置くのりば {derived.platformCards.filter((c) => c.pattern !== 'foreign').length}
        </li>
      </ul>
      <p>次は「作業」で、駅ごとの看板カードとコマンドの手順を見ながら進めます。</p>
      <div className={styles.nextLinks}>
        <Link to={`/p/${project.id}/work/commands`}>コマンドの手順</Link>
        <Link to={`/p/${project.id}/work/signs`}>駅の看板</Link>
        <Link to={`/p/${project.id}/docs/routes`}>資料（経路・編成の一覧）</Link>
      </div>
    </Section>
  );
}
