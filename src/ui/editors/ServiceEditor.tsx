import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { kindTag } from '../../domain/codes';
import type { Service, ServiceKind } from '../../domain/model';
import { defaultServiceKind, reverseService, suggestPlatform } from '../../domain/suggest';
import { useProjectStore } from '../../store/projectStore';
import { Button } from '../components/Button';
import { Disclosure } from '../components/Disclosure';
import { NumberField, Section, SelectField, TextField } from '../components/Field';
import { Matrix } from '../components/Matrix';
import { RemoveButton } from '../components/RemoveButton';
import { useProject } from '../hooks/useDerived';
import type { Project } from '../../domain/model';
import * as ops from '../../store/projectOps';
import { removeWithUndo } from '../toast';
import { must, newId, stationLabel } from './common';
import styles from './editors.module.css';

/** 系統の始発と終点（「A → B」） */
function serviceEnds(project: Project, service: Service): string {
  const name = (i: number) =>
    project.stations.find((s) => s.id === service.entries[i]?.stationId)?.name ?? '？';
  if (service.entries.length === 0) return '通る駅がまだありません';
  return `${name(0)} → ${name(service.entries.length - 1)}`;
}

/** ウィザード「列車の走り方」・編集「系統」 */
export function ServiceEditor({ guided }: { guided?: boolean }) {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('service') ?? project.services[0]?.id;
  const service = project.services.find((s) => s.id === selectedId) ?? project.services[0];

  const select = (id: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('service', id);
        return next;
      },
      { replace: true },
    );

  const addService = () => {
    const id = newId();
    update(
      (p) => void p.services.push({ id, name: '', direction: 'down', entries: [], kinds: [] }),
      { checkpoint: true },
    );
    select(id);
  };

  return (
    <>
      <Section
        title={guided ? '列車の走り方（系統）' : '系統'}
        lead={
          guided
            ? 'どこからどこへ、どの駅を通って走るかを、向きごとに1つずつ作ります。KT式ではこれを「系統」と呼びます。逆向きは「反対方向を作る」で写せます。'
            : '1方向の運行パターンごとに1つ作ります。逆方向は「反対方向を作る」で複製できます。'
        }
        actions={
          <Button size="sm" onClick={addService}>
            ＋ 系統を足す
          </Button>
        }
      >
        {project.services.length === 0 ? (
          <p className="muted">まだ系統がありません。</p>
        ) : guided ? (
          <ul className={styles.serviceList} aria-label="系統">
            {project.services.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`${styles.serviceItem} ${s.id === service?.id ? styles.serviceItemOn : ''}`}
                  aria-pressed={s.id === service?.id}
                  onClick={() => select(s.id)}
                >
                  <span className={styles.serviceNum}>{i + 1}</span>
                  <span className={styles.serviceText}>
                    <strong>{s.name || '（名前なし）'}</strong>
                    <span className="muted text-sm">
                      {serviceEnds(project, s)}・{s.direction === 'up' ? '上り' : '下り'}・
                      {s.kinds.length === 0 ? '列車の種類なし' : `${s.kinds.length} 種類`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <SelectField
            label={`編集する系統（${project.services.length}）`}
            value={service?.id ?? ''}
            options={project.services.map((s, i) => ({
              value: s.id,
              label: `${i + 1}. ${s.name || '（名前なし）'}（${s.direction === 'up' ? '上り' : '下り'}）`,
            }))}
            onChange={select}
          />
        )}
      </Section>
      {service && (
        <ServiceDetail key={service.id} service={service} onSelect={select} guided={guided} />
      )}
    </>
  );
}

function ServiceDetail({
  service,
  onSelect,
  guided,
}: {
  service: Service;
  onSelect: (id: string) => void;
  guided?: boolean;
}) {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const mut = (fn: (s: Service) => void) =>
    update((p) => fn(must(p.services.find((x) => x.id === service.id))));

  return (
    <>
      <Section title={guided ? `「${service.name || '名前なし'}」の設定` : '系統の設定'}>
        <TextField
          label="系統名"
          value={service.name}
          placeholder="CRアカシア線→瑠璃線→翠鉄城東線 トクテルダム中央行"
          onChange={(v) => mut((s) => void (s.name = v))}
        />
        <div className={styles.grid2}>
          <SelectField
            label="方向"
            help="formationCode"
            value={service.direction}
            options={[
              { value: 'down', label: '下り（形式番号は偶数）' },
              { value: 'up', label: '上り（形式番号は奇数）' },
            ]}
            onChange={(v) => mut((s) => void (s.direction = v))}
          />
          <TextField
            label="直通先（任意）"
            help="throughNote"
            value={service.throughNote ?? ''}
            placeholder="翠鉄城東線 トクテルダム中央行"
            onChange={(v) =>
              mut((s) => {
                if (v) s.throughNote = v;
                else delete s.throughNote;
              })
            }
          />
        </div>
        <div className="row">
          <Button
            onClick={() => {
              const id = newId();
              update((p) => void p.services.push(reverseService(service, id)), {
                checkpoint: true,
              });
              onSelect(id);
            }}
          >
            ⇄ 反対方向を作る
          </Button>
          <RemoveButton
            onRemove={() => {
              const next = project.services.find((s) => s.id !== service.id);
              removeWithUndo(`系統「${service.name || '名前なし'}」を消しました`, (p) =>
                ops.removeService(p, service.id),
              );
              if (next) onSelect(next.id);
            }}
          >
            この系統を消す
          </RemoveButton>
        </div>
      </Section>

      <EntryList service={service} />
      <KindList service={service} guided={guided} />
      {service.kinds.length > 0 && service.entries.length > 0 && <StopMatrix service={service} />}
    </>
  );
}

function EntryList({ service }: { service: Service }) {
  const project = useProject();
  const store = useProjectStore();
  const [adding, setAdding] = useState('');
  const stationOptions = project.stations.map((s) => ({
    value: s.id,
    label: stationLabel(project, s.id),
  }));

  const add = (stationId: string, at = service.entries.length) => {
    const prev = service.entries[at - 1]?.stationId;
    store.insertEntry(service.id, at, {
      stationId,
      platform: suggestPlatform(project, prev, stationId),
    });
  };

  return (
    <Section
      title="通る駅とのりば"
      help="entries"
      lead="始発から終点まで、列車が通る駅を順にすべて入れます。止まらずに通過する駅も入れ、各駅で通るのりばを選びます。"
    >
      {service.entries.length === 0 && <p className="muted">最初の駅（始発）を足してください。</p>}
      <ol className={styles.entries}>
        {service.entries.map((e, i) => {
          const st = project.stations.find((s) => s.id === e.stationId);
          const role = i === 0 ? '始発' : i === service.entries.length - 1 ? '終点' : '';
          return (
            <li key={`${i}-${e.stationId}`} className={styles.entry}>
              <span className={styles.entryNum}>{i + 1}</span>
              <SelectField
                label={`${i + 1}番目の駅${role ? `（${role}）` : ''}`}
                hideLabel={i > 0}
                value={e.stationId}
                options={stationOptions}
                onChange={(v) =>
                  store.update((p) => {
                    const entry = must(
                      must(p.services.find((x) => x.id === service.id)).entries[i],
                    );
                    entry.stationId = v;
                    entry.platform = suggestPlatform(p, service.entries[i - 1]?.stationId, v);
                  })
                }
              />
              <SelectField
                label="のりば"
                hideLabel={i > 0}
                value={e.platform === null ? '' : String(e.platform)}
                options={[
                  { value: '', label: '未定（他団体区間）' },
                  ...(st?.platforms ?? []).map((pf) => ({
                    value: String(pf.number),
                    label: `${pf.number}番${pf.label ? `（${pf.label}）` : ''}`,
                  })),
                ]}
                onChange={(v) =>
                  store.update(
                    (p) =>
                      void (must(
                        must(p.services.find((x) => x.id === service.id)).entries[i],
                      ).platform = v === '' ? null : Number(v)),
                  )
                }
              />
              <span className={styles.entryActions}>
                <Button
                  size="sm"
                  aria-label={`${i + 1}番目を上へ`}
                  disabled={i === 0}
                  onClick={() => store.moveEntry(service.id, i, i - 1)}
                >
                  {'↑︎'}
                </Button>
                <Button
                  size="sm"
                  aria-label={`${i + 1}番目を下へ`}
                  disabled={i === service.entries.length - 1}
                  onClick={() => store.moveEntry(service.id, i, i + 1)}
                >
                  {'↓︎'}
                </Button>
                <Button
                  size="sm"
                  aria-label={`${i + 1}番目の後ろに駅を入れる`}
                  title="この後ろに駅を入れる"
                  onClick={() => {
                    const next = service.entries[i + 1]?.stationId ?? e.stationId;
                    add(next, i + 1);
                  }}
                >
                  ＋
                </Button>
                <RemoveButton
                  describe={`${i + 1}番目（${st?.name ?? '駅'}）を消す`}
                  onRemove={() =>
                    removeWithUndo(
                      `${i + 1}番目の ${st?.name ?? '駅'} を経由リストから消しました`,
                      (p) => ops.removeEntry(p, service.id, i),
                    )
                  }
                >
                  ✕
                </RemoveButton>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="add-row">
        <SelectField
          label="駅を最後に足す"
          value={adding}
          options={[{ value: '', label: '駅を選ぶ…' }, ...stationOptions]}
          onChange={setAdding}
        />
        <Button
          variant="primary"
          disabled={!adding}
          onClick={() => {
            add(adding);
            setAdding('');
          }}
        >
          足す
        </Button>
      </div>
      <p className="field-hint">
        のりばは、ほかの系統が同じ前の駅から入るのりばを提案します。違っていれば選び直してください。
      </p>
    </Section>
  );
}

function KindList({ service, guided }: { service: Service; guided?: boolean }) {
  const project = useProject();
  const store = useProjectStore();
  const [adding, setAdding] = useState('');
  const available = project.kinds.filter((k) => !service.kinds.some((x) => x.kindId === k.id));
  const kmut = (kindId: string, fn: (k: ServiceKind) => void) =>
    store.update((p) =>
      fn(
        must(
          must(p.services.find((x) => x.id === service.id)).kinds.find((k) => k.kindId === kindId),
        ),
      ),
    );

  return (
    <Section
      title="走る列車の種類"
      lead={
        guided
          ? '各駅停車・快速など、この系統を走る列車の種類を選びます。形式コードや最高速度は自動で入ります。'
          : '種別ごとに形式コード・最高速度・両数を入れます。'
      }
    >
      {service.kinds.length === 0 && <p className="muted">種別を載せてください。</p>}
      <ul className={styles.rows}>
        {service.kinds.map((k) => {
          const kind = project.kinds.find((x) => x.id === k.kindId);
          return (
            <li key={k.kindId} className={styles.rowItem}>
              <div className={styles.rowTitle}>
                <strong>{kind?.name}</strong>{' '}
                <span className={styles.tag}>{kind ? kindTag(kind) : '?'}</span>
              </div>
              {guided ? (
                <Disclosure
                  className={styles.rowFull}
                  open={!k.formation}
                  summary={`詳しい設定（形式 ${k.formation || '未入力'}・最高速度 ${k.maxSpeed}${k.cars ? `・両数 ${k.cars}` : ''}）`}
                >
                  <div className={styles.kindFields}>
                    <TextField
                      label="形式コード"
                      help="formationCode"
                      mono
                      value={k.formation}
                      placeholder="K300"
                      onChange={(v) => kmut(k.kindId, (x) => void (x.formation = v))}
                    />
                    <NumberField
                      label="最高速度"
                      help="maxSpeed"
                      value={k.maxSpeed}
                      min={0}
                      required
                      onChange={(v) =>
                        v !== undefined && kmut(k.kindId, (x) => void (x.maxSpeed = v))
                      }
                    />
                    <TextField
                      label="両数（任意）"
                      help="cars"
                      mono
                      value={k.cars ?? ''}
                      placeholder="mmmm"
                      onChange={(v) =>
                        kmut(k.kindId, (x) => {
                          if (v) x.cars = v;
                          else delete x.cars;
                        })
                      }
                    />
                    <details className={styles.rowFull}>
                      <summary>
                        衝突設定（mob {k.mobCollision}・プレイヤー {k.playerCollision}）
                      </summary>
                      <p className="field-hint">
                        mob やプレイヤーにぶつかったときの動き。KT式では
                        cancel（止まらずに通り抜ける）が標準です。
                      </p>
                      <div className={styles.grid2}>
                        <TextField
                          label="mob 衝突"
                          mono
                          value={k.mobCollision}
                          onChange={(v) => kmut(k.kindId, (x) => void (x.mobCollision = v))}
                        />
                        <TextField
                          label="プレイヤー衝突"
                          mono
                          value={k.playerCollision}
                          onChange={(v) => kmut(k.kindId, (x) => void (x.playerCollision = v))}
                        />
                      </div>
                    </details>
                  </div>
                </Disclosure>
              ) : (
                <>
                  <TextField
                    label="形式コード"
                    help="formationCode"
                    mono
                    value={k.formation}
                    placeholder="K300"
                    onChange={(v) => kmut(k.kindId, (x) => void (x.formation = v))}
                  />
                  <NumberField
                    label="最高速度"
                    help="maxSpeed"
                    value={k.maxSpeed}
                    min={0}
                    required
                    onChange={(v) =>
                      v !== undefined && kmut(k.kindId, (x) => void (x.maxSpeed = v))
                    }
                  />
                  <TextField
                    label="両数（任意）"
                    help="cars"
                    mono
                    value={k.cars ?? ''}
                    placeholder="mmmm"
                    onChange={(v) =>
                      kmut(k.kindId, (x) => {
                        if (v) x.cars = v;
                        else delete x.cars;
                      })
                    }
                  />
                  <details className={styles.rowFull}>
                    <summary>
                      衝突設定（mob {k.mobCollision}・プレイヤー {k.playerCollision}）
                    </summary>
                    <p className="field-hint">
                      mob やプレイヤーにぶつかったときの動き。KT式では
                      cancel（止まらずに通り抜ける）が標準です。
                    </p>
                    <div className={styles.grid2}>
                      <TextField
                        label="mob 衝突"
                        mono
                        value={k.mobCollision}
                        onChange={(v) => kmut(k.kindId, (x) => void (x.mobCollision = v))}
                      />
                      <TextField
                        label="プレイヤー衝突"
                        mono
                        value={k.playerCollision}
                        onChange={(v) => kmut(k.kindId, (x) => void (x.playerCollision = v))}
                      />
                    </div>
                  </details>
                </>
              )}
              <RemoveButton
                describe={`${kind?.name ?? '種別'}をこの系統から外す`}
                onRemove={() =>
                  removeWithUndo(
                    `${kind?.name ?? '種別'}をこの系統から外しました（停車駅の ○/× も外れました）`,
                    (p) => ops.removeServiceKind(p, service.id, k.kindId),
                  )
                }
              >
                外す
              </RemoveButton>
            </li>
          );
        })}
      </ul>
      {available.length > 0 && (
        <div className="add-row">
          <SelectField
            label="種別を載せる"
            value={adding}
            options={[
              { value: '', label: '種別を選ぶ…' },
              ...available.map((k) => ({ value: k.id, label: `${k.name}（${kindTag(k)}）` })),
            ]}
            onChange={setAdding}
          />
          <Button
            variant="primary"
            disabled={!adding}
            onClick={() => {
              store.update(
                (p) => {
                  const s = must(p.services.find((x) => x.id === service.id));
                  s.kinds.push(defaultServiceKind(p, adding, s.direction, s.entries.length));
                },
                { checkpoint: true },
              );
              setAdding('');
            }}
          >
            載せる
          </Button>
        </div>
      )}
    </Section>
  );
}

function StopMatrix({ service }: { service: Service }) {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const last = service.entries.length - 1;
  const rowName = (i: number) => {
    const e = service.entries[i];
    const st = project.stations.find((s) => s.id === e?.stationId);
    return `${st?.name ?? '?'} ${e?.platform === null ? '未定' : `${e?.platform}番`}`;
  };
  return (
    <Section
      title="止まる駅"
      lead="列車の種類ごとに、止まる駅は ○、通過する駅は × にします。押すと切り替わります。始発と終点は必ず止まります。"
    >
      <Matrix
        caption={`${service.name} の停車駅`}
        rows={service.entries.map((e, i) => {
          const st = project.stations.find((s) => s.id === e.stationId);
          return {
            key: `${i}`,
            label: st?.name ?? '?',
            note: e.platform === null ? 'のりば未定' : `${e.platform}番`,
          };
        })}
        columns={service.kinds.map((k) => {
          const kind = project.kinds.find((x) => x.id === k.kindId);
          return { key: k.kindId, label: kind ? `${kind.name}` : '?' };
        })}
        value={(r, c) => (r === 0 || r === last ? 'fixed' : (service.kinds[c]?.stops[r] ?? false))}
        cellLabel={(r, c) => {
          const kind = project.kinds.find((x) => x.id === service.kinds[c]?.kindId);
          return `${rowName(r)} ${kind?.name ?? ''}`;
        }}
        onToggle={(r, c) =>
          update(
            (p) => {
              const k = must(must(p.services.find((x) => x.id === service.id)).kinds[c]);
              k.stops[r] = !k.stops[r];
            },
            { checkpoint: true },
          )
        }
      />
    </Section>
  );
}
