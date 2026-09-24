import { useSearchParams } from 'react-router';
import { kindTag } from '../../domain/codes';
import {
  departureKey,
  platformKey,
  type ChoiceOverride,
  type DepartureOverride,
  type Project,
} from '../../domain/model';
import { useProjectStore } from '../../store/projectStore';
import { CheckField, Section, SelectField, TextField } from '../components/Field';
import { useDerived, useProject } from '../hooks/useDerived';
import styles from './editors.module.css';

/** ウィザード 7：自動推定（経路に入れる駅・各駅発）の確認と上書き（R5） */
export function ReviewEditor() {
  return (
    <>
      <ChoiceReview />
      <DepartureReview />
    </>
  );
}

function ChoiceReview() {
  const project = useProject();
  const { derived } = useDerived();
  const update = useProjectStore((s) => s.update);

  // のりばごとに、そこへ入る経由要素の推定をまとめる（始発は除く）
  const rows = new Map<
    string,
    { stationId: string; platform: number; chosen: Set<boolean>; reasons: Set<string> }
  >();
  project.services.forEach((s, si) =>
    s.entries.forEach((e, i) => {
      if (i === 0 || e.platform === null) return;
      const key = platformKey(e.stationId, e.platform);
      const row = rows.get(key) ?? {
        stationId: e.stationId,
        platform: e.platform,
        chosen: new Set<boolean>(),
        reasons: new Set<string>(),
      };
      const c = derived.choices[si]?.[i];
      if (c) {
        row.chosen.add(c.chosen);
        row.reasons.add(c.reason);
      }
      rows.set(key, row);
    }),
  );
  const ordered = project.stations.flatMap((st) =>
    st.platforms.flatMap((pf) => rows.get(platformKey(st.id, pf.number)) ?? []),
  );

  const setChoice = (key: string, v: 'auto' | ChoiceOverride) =>
    update((p) => {
      if (v === 'auto') {
        p.overrides.choice = Object.fromEntries(
          Object.entries(p.overrides.choice).filter(([k]) => k !== key),
        );
      } else p.overrides.choice[key] = v;
    });

  return (
    <Section
      title="経路に入れる駅"
      help="choice"
      lead="のりばを選ぶ必要がある駅は自動で経路に入ります。KT式の実例と違うときだけ上書きしてください（上書きはすべての系統に効きます）。"
    >
      <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="経路に入れる駅の表">
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">のりば</th>
              <th scope="col">経路に</th>
              <th scope="col">理由</th>
              <th scope="col">上書き</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((r) => {
              const key = platformKey(r.stationId, r.platform);
              const override = project.overrides.choice[key];
              const st = project.stations.find((s) => s.id === r.stationId);
              const state =
                r.chosen.size > 1 ? '系統による' : r.chosen.has(true) ? '○ 入れる' : '× 入れない';
              return (
                <tr key={key}>
                  <th scope="row">
                    {st?.name} {r.platform}番
                    <div className="mono muted">
                      {derived.lookup.destText(r.stationId, r.platform)}
                    </div>
                  </th>
                  <td>
                    {state}
                    {override && <span className={styles.badge}>上書き</span>}
                  </td>
                  <td className="muted">{[...r.reasons].join('／')}</td>
                  <td>
                    <SelectField
                      label={`${st?.name} ${r.platform}番を経路に`}
                      hideLabel
                      value={override ?? 'auto'}
                      options={[
                        { value: 'auto', label: '自動' },
                        { value: 'include', label: '入れる' },
                        { value: 'exclude', label: '入れない' },
                      ]}
                      onChange={(v) => setChoice(key, v)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function setDeparture(p: Project, key: string, patch: Partial<DepartureOverride>) {
  const next = Object.fromEntries(
    Object.entries({ ...p.overrides.departure[key], ...patch }).filter(([, v]) => v !== undefined),
  ) as DepartureOverride;
  if (Object.keys(next).length === 0) {
    p.overrides.departure = Object.fromEntries(
      Object.entries(p.overrides.departure).filter(([k]) => k !== key),
    );
  } else p.overrides.departure[key] = next;
}

function DepartureReview() {
  const project = useProject();
  const { derived } = useDerived();
  const update = useProjectStore((s) => s.update);
  const [params] = useSearchParams();
  const only = params.get('service');
  const services = project.services.filter((s) => !only || s.id === only);

  return (
    <Section
      title="各駅発"
      help="departure"
      lead="停車するすべての駅から出す設定になっています。出さない駅はチェックを外します。他の鉄道会社の車両が出る駅では形式コードや編成名を入れます。"
    >
      {services.map((s) => (
        <div key={s.id} className="stack">
          <h3>{s.name || '（名前なし）'}</h3>
          {s.kinds.map((k) => {
            const kind = project.kinds.find((x) => x.id === k.kindId);
            const last = s.entries.length - 1;
            return (
              <div
                key={k.kindId}
                className={styles.tableWrap}
                tabIndex={0}
                role="region"
                aria-label={`${s.name} ${kind?.name ?? ''} の各駅発`}
              >
                <table className={styles.table}>
                  <caption className={styles.caption}>
                    {kind?.name}（{kind ? kindTag(kind) : '?'}）・形式 {k.formation}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">発駅</th>
                      <th scope="col">出す</th>
                      <th scope="col">形式コードの上書き</th>
                      <th scope="col">編成</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.entries.map((e, d) => {
                      if (d === last || e.platform === null || !k.stops[d]) return null;
                      const key = departureKey(s.id, k.kindId, d);
                      const o = project.overrides.departure[key];
                      const st = project.stations.find((x) => x.id === e.stationId);
                      const row = derived.departures.find(
                        (x) => x.serviceId === s.id && x.kindId === k.kindId && x.entryIndex === d,
                      );
                      const foreign = row?.foreign ?? o?.foreignName !== undefined;
                      const label = `${st?.name} ${e.platform}番`;
                      return (
                        <tr key={key}>
                          <th scope="row">
                            {label}
                            {o && <span className={styles.badge}>上書き</span>}
                          </th>
                          <td>
                            <CheckField
                              label={<span className="visually-hidden">{label}から出す</span>}
                              checked={o?.enabled !== false}
                              onChange={(v) =>
                                update((p) =>
                                  setDeparture(p, key, { enabled: v ? undefined : false }),
                                )
                              }
                            />
                          </td>
                          <td>
                            {foreign ? (
                              <TextField
                                label={`${label}の他の鉄道会社の編成名`}
                                help="foreignName"
                                mono
                                value={o?.foreignName ?? ''}
                                placeholder="H3004_KB2NSC_Ra"
                                onChange={(v) =>
                                  update((p) => setDeparture(p, key, { foreignName: v }))
                                }
                              />
                            ) : (
                              <TextField
                                label={`${label}の形式コード`}
                                hideLabel
                                mono
                                value={o?.formation ?? ''}
                                placeholder={k.formation}
                                onChange={(v) =>
                                  update((p) => setDeparture(p, key, { formation: v || undefined }))
                                }
                              />
                            )}
                          </td>
                          <td className="mono">
                            {o?.enabled === false
                              ? '（出さない）'
                              : (row?.formationCode ?? '要確認')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ))}
    </Section>
  );
}
