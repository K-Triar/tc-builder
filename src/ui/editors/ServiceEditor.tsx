import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { kindTag } from '../../domain/codes';
import type { Service, ServiceKind } from '../../domain/model';
import { defaultServiceKind, reverseService, suggestPlatform } from '../../domain/suggest';
import { useProjectStore } from '../../store/projectStore';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/Dialog';
import { NumberField, Section, SelectField, TextField } from '../components/Field';
import { Matrix } from '../components/Matrix';
import { useProject } from '../hooks/useDerived';
import { must, newId, stationLabel } from './common';
import styles from './editors.module.css';

/** ウィザード 6・編集「系統」 */
export function ServiceEditor() {
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
    );
    select(id);
  };

  return (
    <>
      <Section
        title="系統"
        lead="1方向の運行パターンごとに1つ作ります。逆方向は「反対方向を作る」で複製できます。"
        actions={
          <Button size="sm" onClick={addService}>
            ＋ 系統を足す
          </Button>
        }
      >
        {project.services.length === 0 ? (
          <p className="muted">まだ系統がありません。</p>
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
      {service && <ServiceDetail key={service.id} service={service} onSelect={select} />}
    </>
  );
}

function ServiceDetail({
  service,
  onSelect,
}: {
  service: Service;
  onSelect: (id: string) => void;
}) {
  const project = useProject();
  const store = useProjectStore();
  const update = store.update;
  const [deleting, setDeleting] = useState(false);
  const mut = (fn: (s: Service) => void) =>
    update((p) => fn(must(p.services.find((x) => x.id === service.id))));

  return (
    <>
      <Section title="系統の設定">
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
              update((p) => void p.services.push(reverseService(service, id)));
              onSelect(id);
            }}
          >
            ⇄ 反対方向を作る
          </Button>
          <Button variant="danger" onClick={() => setDeleting(true)}>
            この系統を消す
          </Button>
        </div>
      </Section>

      <EntryList service={service} />
      <KindList service={service} />
      {service.kinds.length > 0 && service.entries.length > 0 && <StopMatrix service={service} />}

      <ConfirmDialog
        open={deleting}
        title="系統を消しますか？"
        message={<p>「{service.name || '名前なし'}」と、その各駅発の上書きを消します。</p>}
        confirmLabel="消す"
        danger
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          setDeleting(false);
          store.removeService(service.id);
          const next = project.services.find((s) => s.id !== service.id);
          if (next) onSelect(next.id);
        }}
      />
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
      title="経由リスト"
      help="entries"
      lead="列車が通る駅を、通過する駅も含めて順にすべて入れ、各駅で通るのりばを選びます。"
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
                  ↑
                </Button>
                <Button
                  size="sm"
                  aria-label={`${i + 1}番目を下へ`}
                  disabled={i === service.entries.length - 1}
                  onClick={() => store.moveEntry(service.id, i, i + 1)}
                >
                  ↓
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
                <Button
                  size="sm"
                  variant="danger"
                  aria-label={`${i + 1}番目を消す`}
                  onClick={() => store.removeEntry(service.id, i)}
                >
                  ✕
                </Button>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <SelectField
          label="駅を最後に足す"
          value={adding}
          options={[{ value: '', label: '駅を選ぶ…' }, ...stationOptions]}
          onChange={setAdding}
          className="field"
        />
        <Button
          variant="primary"
          disabled={!adding}
          onClick={() => {
            add(adding);
            setAdding('');
          }}
          style={{ marginBottom: 'var(--space-4)' }}
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

function KindList({ service }: { service: Service }) {
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
    <Section title="この系統を走る種別" lead="種別ごとに形式コード・最高速度・両数を入れます。">
      {service.kinds.length === 0 && <p className="muted">種別を載せてください。</p>}
      <ul className={styles.rows}>
        {service.kinds.map((k) => {
          const kind = project.kinds.find((x) => x.id === k.kindId);
          return (
            <li key={k.kindId} className={styles.rowItem}>
              <div style={{ flex: '1 1 100%' }}>
                <strong>{kind?.name}</strong>{' '}
                <span className={styles.tag}>{kind ? kindTag(kind) : '?'}</span>
              </div>
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
                onChange={(v) => v !== undefined && kmut(k.kindId, (x) => void (x.maxSpeed = v))}
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
              <details style={{ flex: '1 1 100%' }}>
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
              <Button
                size="sm"
                variant="danger"
                onClick={() => store.removeServiceKind(service.id, k.kindId)}
              >
                外す
              </Button>
            </li>
          );
        })}
      </ul>
      {available.length > 0 && (
        <div className="row" style={{ alignItems: 'flex-end' }}>
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
            style={{ marginBottom: 'var(--space-4)' }}
            onClick={() => {
              store.update((p) => {
                const s = must(p.services.find((x) => x.id === service.id));
                s.kinds.push(defaultServiceKind(p, adding, s.direction, s.entries.length));
              });
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
    <Section title="停車駅" lead="○＝停車、×＝通過。始発と終点は停車で固定です。">
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
          update((p) => {
            const k = must(must(p.services.find((x) => x.id === service.id)).kinds[c]);
            k.stops[r] = !k.stops[r];
          })
        }
      />
    </Section>
  );
}
