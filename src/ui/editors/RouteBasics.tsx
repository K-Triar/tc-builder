import { useSearchParams } from 'react-router';
import { kindTag } from '../../domain/codes';
import { useProjectStore } from '../../store/projectStore';
import { Disclosure } from '../components/Disclosure';
import { Section, TextField } from '../components/Field';
import { useJourney, useProject } from '../hooks/useDerived';
import { KindEditor } from './KindEditor';
import { LineEditor, OrgEditor } from './OrgEditor';
import styles from './editors.module.css';

/**
 * ウィザード「路線について」：名前と、どの団体の決まりで作るか。
 * 団体・路線・種別のコードはプリセットで入っているので、要約だけを見せて詳しい設定にしまう。
 */
export function RouteBasics() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const [params] = useSearchParams();
  const j = useJourney();
  const self = project.orgs.find((o) => o.id === project.selfOrgId);
  const lines = project.lines.filter((l) => l.orgId === project.selfOrgId && l.code);
  const kinds = project.kinds.filter((k) => k.typeCode);
  const lineStage = j.stages[0];
  // 未入力や直すところがあるとき・検証から飛んできたときは、最初から開いておく
  const openDetails =
    params.has('details') || !lineStage?.done || (lineStage?.issues.error ?? 0) > 0;
  const example = self?.code && lines[0] ? `${self.code}${lines[0].code}01` : null;

  return (
    <>
      <Section title="この路線の名前は？">
        <TextField
          label="路線の名前"
          value={project.name}
          placeholder="例：瑠璃線系統"
          hint="自分が見分けるための名前です。看板やコマンドには出ません。"
          onChange={(v) => update((p) => void (p.name = v))}
        />
      </Section>

      <Section
        title="どの団体の決まりで作りますか？"
        lead="駅コードや列車の種類の名前は、団体ごとに決まっています。ふつうは下の内容のままで大丈夫です。"
      >
        {self?.code ? (
          <dl className={styles.summaryList}>
            <dt>団体</dt>
            <dd>
              {self.name || '（名前なし）'} <span className="code-tag">{self.code}</span>
            </dd>
            <dt>路線</dt>
            <dd>
              {lines.length === 0
                ? 'まだありません'
                : lines.map((l) => (
                    <span key={l.id} className={styles.summaryItem}>
                      {l.name || '（名前なし）'} <span className="code-tag">{l.code}</span>
                    </span>
                  ))}
            </dd>
            <dt>列車の種類</dt>
            <dd>
              {kinds.length === 0
                ? 'まだありません'
                : kinds.map((k) => (
                    <span key={k.id} className={styles.summaryItem}>
                      {k.name || kindTag(k)}
                    </span>
                  ))}
            </dd>
          </dl>
        ) : (
          <p>自分の団体の名前とコードを、下の詳しい設定で入れてください。</p>
        )}
        {example && (
          <p className="field-hint">
            駅コードは「<span className="code-tag">{example}</span>
            」のように、団体・路線・駅の番号から自動で付きます。
          </p>
        )}
        <Disclosure summary="詳しい設定（団体・路線・列車の種類のコード）" open={openDetails}>
          <OrgEditor />
          <LineEditor />
          <KindEditor />
        </Disclosure>
      </Section>
    </>
  );
}
