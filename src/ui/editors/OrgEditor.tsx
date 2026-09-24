import { useState } from 'react';
import { COMPANIES } from '../../domain/presets';
import { useProjectStore } from '../../store/projectStore';
import { Button } from '../components/Button';
import { NumberField, Section, SelectField, TextField } from '../components/Field';
import { RemoveButton } from '../components/RemoveButton';
import { useProject } from '../hooks/useDerived';
import { removeWithUndo } from '../toast';
import { must, newId } from './common';
import styles from './editors.module.css';

/** ウィザード 1：鉄道会社（自分の鉄道会社と他の鉄道会社） */
export function OrgEditor() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const self = project.orgs.find((o) => o.id === project.selfOrgId);
  const others = project.orgs.filter((o) => o.id !== project.selfOrgId);
  const [adding, setAdding] = useState('');
  // 一覧の会社のうち、まだ登録していないもの
  const addable = COMPANIES.filter((c) => !project.orgs.some((o) => o.code === c.code));
  const addOrg = (name: string, code: string) =>
    update((p) => void p.orgs.push({ id: newId(), name, code }), { checkpoint: true });
  const usedOrgIds = new Set([
    ...project.stations.map((s) => s.managerOrgId),
    ...project.lines.map((l) => l.orgId),
  ]);

  return (
    <>
      <Section title="自分の鉄道会社" help="orgCode">
        <div className={styles.grid2}>
          <TextField
            label="鉄道会社名"
            value={self?.name ?? ''}
            placeholder="例：Kトライア"
            onChange={(v) =>
              update((p) => void (must(p.orgs.find((o) => o.id === p.selfOrgId)).name = v))
            }
          />
          <TextField
            label="鉄道会社コード"
            mono
            value={self?.code ?? ''}
            placeholder="例：K"
            hint="半角の英字・数字だけ（記号は不可）。駅コード・形式コードの先頭に付きます"
            onChange={(v) =>
              update((p) => void (must(p.orgs.find((o) => o.id === p.selfOrgId)).code = v))
            }
          />
        </div>
      </Section>

      <Section
        title="他の鉄道会社"
        lead="直通する相手の鉄道会社（HRA・翠鉄など）を登録すると、その鉄道会社の駅や編成を扱えます。"
      >
        <div className={styles.addOrg}>
          {addable.length > 0 && (
            <>
              <SelectField
                label="一覧から足す"
                value={adding}
                options={[
                  { value: '', label: '選んでください' },
                  ...addable.map((c) => ({ value: c.code, label: `${c.name}（${c.code}）` })),
                ]}
                onChange={setAdding}
              />
              <Button
                size="sm"
                disabled={!adding}
                onClick={() => {
                  const c = COMPANIES.find((x) => x.code === adding);
                  if (c) addOrg(c.name, c.code);
                  setAdding('');
                }}
              >
                ＋ 足す
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => addOrg('', '')}>
            ＋ 一覧にない鉄道会社を足す
          </Button>
        </div>
        {others.length === 0 ? (
          <p className="muted">まだありません。</p>
        ) : (
          <ul className={styles.rows}>
            {others.map((o) => (
              <li key={o.id} className={styles.rowItem}>
                <TextField
                  label="鉄道会社名"
                  value={o.name}
                  onChange={(v) =>
                    update((p) => void (must(p.orgs.find((x) => x.id === o.id)).name = v))
                  }
                />
                <TextField
                  label="鉄道会社コード"
                  mono
                  value={o.code}
                  hint="分からなければ空でかまいません"
                  onChange={(v) =>
                    update((p) => void (must(p.orgs.find((x) => x.id === o.id)).code = v))
                  }
                />
                <RemoveButton
                  describe={`${o.name || '鉄道会社'}を消す`}
                  blocked={usedOrgIds.has(o.id) && 'この鉄道会社の駅・路線あり'}
                  onRemove={() =>
                    removeWithUndo(
                      `鉄道会社「${o.name || o.code || '名前なし'}」を消しました`,
                      (p) => void (p.orgs = p.orgs.filter((x) => x.id !== o.id)),
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

/** ウィザード 2：路線 */
export function LineEditor() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const usedLineIds = new Set(
    project.stations.flatMap((s) =>
      s.codes.flatMap((c) => (c.code.kind === 'numbered' ? [c.code.lineId] : [])),
    ),
  );
  return (
    <Section
      title="路線"
      help="lineCode"
      lead="自分の鉄道会社の路線と、その路線コード（英字1文字）を入れます。"
      actions={
        <Button
          size="sm"
          onClick={() =>
            update(
              (p) => void p.lines.push({ id: newId(), orgId: p.selfOrgId, code: '', name: '' }),
              { checkpoint: true },
            )
          }
        >
          ＋ 路線を足す
        </Button>
      }
    >
      <ul className={styles.rows}>
        {project.lines.map((l) => (
          <li key={l.id} className={styles.rowItem}>
            <TextField
              label="路線コード"
              mono
              value={l.code}
              placeholder="L"
              onChange={(v) =>
                update((p) => void (must(p.lines.find((x) => x.id === l.id)).code = v))
              }
            />
            <TextField
              label="路線名"
              value={l.name}
              placeholder="瑠璃本線"
              onChange={(v) =>
                update((p) => void (must(p.lines.find((x) => x.id === l.id)).name = v))
              }
            />
            <RemoveButton
              describe={`${l.name || l.code || '路線'}を消す`}
              blocked={usedLineIds.has(l.id) && '駅コードで使用中'}
              onRemove={() =>
                removeWithUndo(
                  `路線「${l.name || l.code || '名前なし'}」を消しました`,
                  (p) => void (p.lines = p.lines.filter((x) => x.id !== l.id)),
                )
              }
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** 看板の数値と用途番号（編集画面の「鉄道会社・路線」タブに出す） */
export function SettingsEditor() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const st = project.settings;
  return (
    <>
      <Section title="看板の数値" lead="のりばごとに変えることもできます（駅とのりばの画面）。">
        <div className={styles.grid3}>
          <NumberField
            label="spawn の初速"
            required
            value={st.spawnSpeed}
            min={0}
            onChange={(v) => v !== undefined && update((p) => void (p.settings.spawnSpeed = v))}
          />
          <NumberField
            label="station の加速距離"
            required
            value={st.stationLaunchDistance}
            min={0}
            onChange={(v) =>
              v !== undefined && update((p) => void (p.settings.stationLaunchDistance = v))
            }
          />
          <NumberField
            label="停車秒数"
            required
            value={st.stationDwellSeconds}
            min={0}
            onChange={(v) =>
              v !== undefined && update((p) => void (p.settings.stationDwellSeconds = v))
            }
          />
        </div>
      </Section>
      <Section
        title="用途番号"
        help="formationCode"
        lead="形式コードの2文字目。種別を系統に載せるときの最高速度の初期値になります。"
        actions={
          <Button
            size="sm"
            onClick={() =>
              update(
                (p) => void p.settings.usages.push({ digit: '', label: '', defaultMaxSpeed: 1 }),
                { checkpoint: true },
              )
            }
          >
            ＋ 用途を足す
          </Button>
        }
      >
        <ul className={styles.rows}>
          {st.usages.map((u, i) => (
            <li key={i} className={styles.rowItem}>
              <TextField
                label="用途番号"
                mono
                value={u.digit}
                onChange={(v) => update((p) => void (must(p.settings.usages[i]).digit = v))}
              />
              <TextField
                label="意味"
                value={u.label}
                onChange={(v) => update((p) => void (must(p.settings.usages[i]).label = v))}
              />
              <NumberField
                label="標準最高速度"
                required
                value={u.defaultMaxSpeed}
                min={0}
                onChange={(v) =>
                  v !== undefined &&
                  update((p) => void (must(p.settings.usages[i]).defaultMaxSpeed = v))
                }
              />
              <RemoveButton
                describe={`用途 ${u.digit || u.label}を消す`}
                onRemove={() =>
                  removeWithUndo(
                    `用途「${u.digit} ${u.label}」を消しました`,
                    (p) => void p.settings.usages.splice(i, 1),
                  )
                }
              />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
