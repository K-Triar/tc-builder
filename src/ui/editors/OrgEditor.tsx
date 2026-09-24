import { useProjectStore } from '../../store/projectStore';
import { Button } from '../components/Button';
import { NumberField, Section, TextField } from '../components/Field';
import { useProject } from '../hooks/useDerived';
import { must, newId } from './common';
import styles from './editors.module.css';

/** ウィザード 1：団体（自団体と他団体） */
export function OrgEditor() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const self = project.orgs.find((o) => o.id === project.selfOrgId);
  const others = project.orgs.filter((o) => o.id !== project.selfOrgId);
  const usedOrgIds = new Set([
    ...project.stations.map((s) => s.managerOrgId),
    ...project.lines.map((l) => l.orgId),
  ]);

  return (
    <>
      <Section title="自分の団体" help="orgCode">
        <div className={styles.grid2}>
          <TextField
            label="団体名"
            value={self?.name ?? ''}
            placeholder="例：Kトライア"
            onChange={(v) =>
              update((p) => void (must(p.orgs.find((o) => o.id === p.selfOrgId)).name = v))
            }
          />
          <TextField
            label="団体コード"
            mono
            value={self?.code ?? ''}
            placeholder="例：K"
            hint="半角英字。駅コード・形式コードの先頭に付きます"
            onChange={(v) =>
              update((p) => void (must(p.orgs.find((o) => o.id === p.selfOrgId)).code = v))
            }
          />
        </div>
      </Section>

      <Section
        title="他の団体"
        lead="直通する相手の団体（HRA・翠鉄など）を登録すると、その団体の駅や編成を扱えます。"
        actions={
          <Button
            size="sm"
            onClick={() => update((p) => void p.orgs.push({ id: newId(), name: '', code: '' }))}
          >
            ＋ 団体を足す
          </Button>
        }
      >
        {others.length === 0 ? (
          <p className="muted">まだありません。</p>
        ) : (
          <ul className={styles.rows}>
            {others.map((o) => (
              <li key={o.id} className={styles.rowItem}>
                <TextField
                  label="団体名"
                  value={o.name}
                  onChange={(v) =>
                    update((p) => void (must(p.orgs.find((x) => x.id === o.id)).name = v))
                  }
                />
                <TextField
                  label="団体コード"
                  mono
                  value={o.code}
                  hint="分からなければ空でかまいません"
                  onChange={(v) =>
                    update((p) => void (must(p.orgs.find((x) => x.id === o.id)).code = v))
                  }
                />
                <Button
                  size="sm"
                  variant="danger"
                  disabled={usedOrgIds.has(o.id)}
                  title={usedOrgIds.has(o.id) ? 'この団体の駅があるので消せません' : undefined}
                  onClick={() => update((p) => void (p.orgs = p.orgs.filter((x) => x.id !== o.id)))}
                >
                  消す
                </Button>
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
      lead="自分の団体の路線と、その路線コード（英字1文字）を入れます。"
      actions={
        <Button
          size="sm"
          onClick={() =>
            update(
              (p) => void p.lines.push({ id: newId(), orgId: p.selfOrgId, code: '', name: '' }),
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
            <Button
              size="sm"
              variant="danger"
              disabled={usedLineIds.has(l.id)}
              title={usedLineIds.has(l.id) ? 'この路線の駅コードがあるので消せません' : undefined}
              onClick={() => update((p) => void (p.lines = p.lines.filter((x) => x.id !== l.id)))}
            >
              消す
            </Button>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** 看板の数値と用途番号（編集画面の「団体・路線」タブに出す） */
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
            value={st.spawnSpeed}
            min={0}
            onChange={(v) => v !== undefined && update((p) => void (p.settings.spawnSpeed = v))}
          />
          <NumberField
            label="station の加速距離"
            value={st.stationLaunchDistance}
            min={0}
            onChange={(v) =>
              v !== undefined && update((p) => void (p.settings.stationLaunchDistance = v))
            }
          />
          <NumberField
            label="停車秒数"
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
                value={u.defaultMaxSpeed}
                min={0}
                onChange={(v) =>
                  v !== undefined &&
                  update((p) => void (must(p.settings.usages[i]).defaultMaxSpeed = v))
                }
              />
              <Button
                size="sm"
                variant="danger"
                onClick={() => update((p) => void p.settings.usages.splice(i, 1))}
              >
                消す
              </Button>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
