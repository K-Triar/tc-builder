import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { Platform, Project, Station, StationCode } from '../../domain/model';
import { useProjectStore } from '../../store/projectStore';
import { Button } from '../components/Button';
import { CheckField, NumberField, Section, SelectField, TextField } from '../components/Field';
import { useProject } from '../hooks/useDerived';
import { codeText, isSelfStation, must, newId, stationCodesText } from './common';
import { DirPicker } from './DirPicker';
import styles from './editors.module.css';

export type StationPart = 'basic' | 'platforms' | 'all';

/** ウィザード 4〜5・編集「駅とのりば」 */
export function StationEditor({ part = 'all' }: { part?: StationPart }) {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const [params] = useSearchParams();
  const focusStation = params.get('station');
  const focusPlatform = params.get('platform');

  const addStation = () =>
    update((p) => {
      const codeId = newId();
      const line = p.lines.find((l) => l.orgId === p.selfOrgId);
      p.stations.push({
        id: newId(),
        name: '',
        managerOrgId: p.selfOrgId,
        signsBySelf: true,
        codes: [
          {
            id: codeId,
            code: line
              ? {
                  kind: 'numbered',
                  orgId: p.selfOrgId,
                  lineId: line.id,
                  number: p.stations.length + 1,
                }
              : { kind: 'free', value: '' },
          },
        ],
        platforms: [{ number: 1, codeId, deadEnd: false }],
      });
    });

  return (
    <>
      {part !== 'platforms' && <PasteStations />}
      <Section
        title={part === 'platforms' ? 'のりば' : '駅'}
        help={part === 'platforms' ? 'dir' : 'stationCode'}
        lead={
          part === 'platforms'
            ? 'のりばごとに、番号・行先に使う駅コード・列車の進む向き・行き止まりかを入れます。通過線ものりばとして入れます。'
            : '駅名・管理団体・駅コードを入れます。乗換駅は路線ごとの駅コードを足します。'
        }
        actions={
          part !== 'platforms' && (
            <Button size="sm" onClick={addStation}>
              ＋ 駅を足す
            </Button>
          )
        }
      >
        {project.stations.length === 0 && <p className="muted">まだ駅がありません。</p>}
        {project.stations.map((s, i) => (
          <StationCard
            key={s.id}
            station={s}
            index={i}
            part={part}
            highlight={focusStation === s.id}
            focusPlatform={focusStation === s.id ? Number(focusPlatform) : undefined}
          />
        ))}
      </Section>
    </>
  );
}

function StationCard({
  station: s,
  index,
  part,
  highlight,
  focusPlatform,
}: {
  station: Station;
  index: number;
  part: StationPart;
  highlight: boolean;
  focusPlatform?: number;
}) {
  const project = useProject();
  const update = useProjectStore((st) => st.update);
  const ref = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const self = isSelfStation(project, s);
  const used = project.services.some((v) => v.entries.some((e) => e.stationId === s.id));

  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [highlight]);

  const mut = (fn: (st: Station, p: Project) => void) =>
    update((p) => fn(must(p.stations.find((x) => x.id === s.id)), p));

  return (
    <div
      ref={ref}
      id={`station-${s.id}`}
      className={`${styles.stationCard} ${highlight ? styles.highlight : ''}`}
    >
      <div className={styles.stationHead}>
        <strong>
          {index + 1}. {s.name || '（駅名なし）'}
          <span className="muted mono"> {stationCodesText(project, s)}</span>
          {!self && <span className={styles.badge}>他団体</span>}
        </strong>
        {part !== 'platforms' && (
          <div className="row">
            <Button
              size="sm"
              aria-label={`${s.name}を上へ`}
              disabled={index === 0}
              onClick={() =>
                update((p) => void p.stations.splice(index - 1, 0, ...p.stations.splice(index, 1)))
              }
            >
              ↑
            </Button>
            <Button
              size="sm"
              aria-label={`${s.name}を下へ`}
              disabled={index === project.stations.length - 1}
              onClick={() =>
                update((p) => void p.stations.splice(index + 1, 0, ...p.stations.splice(index, 1)))
              }
            >
              ↓
            </Button>
            {confirmDelete ? (
              <>
                <span>本当に消しますか？</span>
                <Button size="sm" onClick={() => setConfirmDelete(false)}>
                  やめる
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    update((p) => void (p.stations = p.stations.filter((x) => x.id !== s.id)))
                  }
                >
                  消す
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="danger"
                disabled={used}
                title={used ? '系統の経由リストで使っているので消せません' : undefined}
                onClick={() => setConfirmDelete(true)}
              >
                消す
              </Button>
            )}
          </div>
        )}
      </div>
      <div className={styles.stationBody}>
        {part !== 'platforms' && <StationBasic station={s} mut={mut} />}
        {part !== 'basic' && <PlatformList station={s} mut={mut} focusPlatform={focusPlatform} />}
      </div>
    </div>
  );
}

function StationBasic({
  station: s,
  mut,
}: {
  station: Station;
  mut: (fn: (st: Station, p: Project) => void) => void;
}) {
  const project = useProject();
  const self = isSelfStation(project, s);
  const selfLines = project.lines.filter((l) => l.orgId === project.selfOrgId);
  const usedCodeIds = new Set(s.platforms.map((p) => p.codeId));
  return (
    <>
      <div className={styles.grid2}>
        <TextField label="駅名" value={s.name} onChange={(v) => mut((st) => void (st.name = v))} />
        <SelectField
          label="管理団体"
          help="manager"
          value={s.managerOrgId}
          options={project.orgs.map((o) => ({
            value: o.id,
            label: o.name || o.code || '（名前なし）',
          }))}
          onChange={(v) =>
            mut((st, p) => {
              st.managerOrgId = v;
              if (v === p.selfOrgId) st.signsBySelf = true;
            })
          }
        />
      </div>
      {!self && (
        <CheckField
          label="この駅の看板は自分で置く"
          help="manager"
          checked={s.signsBySelf}
          hint="外すと、看板は相手団体の設定に従う（すり合わせだけ）になります"
          onChange={(v) => mut((st) => void (st.signsBySelf = v))}
        />
      )}
      <h3 style={{ marginTop: 'var(--space-3)' }}>駅コード</h3>
      <ul className={styles.rows}>
        {s.codes.map((c, ci) => (
          <li key={c.id} className={styles.rowItem}>
            <SelectField
              label="種類"
              value={c.code.kind}
              options={[
                { value: 'numbered', label: '番号つき（KL04 など）' },
                { value: 'free', label: '文字列（IIA など）' },
              ]}
              onChange={(v) =>
                mut((st, p) => {
                  const line = p.lines.find((l) => l.orgId === p.selfOrgId);
                  must(st.codes[ci]).code =
                    v === 'free' || !line
                      ? { kind: 'free', value: '' }
                      : { kind: 'numbered', orgId: p.selfOrgId, lineId: line.id, number: 1 };
                })
              }
            />
            {c.code.kind === 'numbered' ? (
              <>
                <SelectField
                  label="路線"
                  value={c.code.lineId}
                  options={selfLines.map((l) => ({ value: l.id, label: `${l.code} ${l.name}` }))}
                  onChange={(v) =>
                    mut((st) => {
                      const code = must(st.codes[ci]).code;
                      if (code.kind === 'numbered') code.lineId = v;
                    })
                  }
                />
                <NumberField
                  label="駅番号"
                  value={c.code.number}
                  min={0}
                  onChange={(v) =>
                    v !== undefined &&
                    mut((st) => {
                      const code = must(st.codes[ci]).code;
                      if (code.kind === 'numbered') code.number = Math.trunc(v);
                    })
                  }
                />
              </>
            ) : (
              <TextField
                label="駅コード"
                mono
                value={c.code.value}
                placeholder="IIA"
                onChange={(v) =>
                  mut((st) => {
                    const code = must(st.codes[ci]).code;
                    if (code.kind === 'free') code.value = v;
                  })
                }
              />
            )}
            <span className="mono" aria-label="表示">
              {codeText(project, s, c.id)}
            </span>
            <Button
              size="sm"
              variant="danger"
              disabled={s.codes.length <= 1 || usedCodeIds.has(c.id)}
              title={usedCodeIds.has(c.id) ? 'のりばで使っているので消せません' : undefined}
              onClick={() => mut((st) => void (st.codes = st.codes.filter((x) => x.id !== c.id)))}
            >
              消す
            </Button>
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        onClick={() =>
          mut((st) => void st.codes.push({ id: newId(), code: { kind: 'free', value: '' } }))
        }
      >
        ＋ 駅コードを足す（乗換駅）
      </Button>
    </>
  );
}

function PlatformList({
  station: s,
  mut,
  focusPlatform,
}: {
  station: Station;
  mut: (fn: (st: Station, p: Project) => void) => void;
  focusPlatform?: number;
}) {
  const project = useProject();
  const renumber = useProjectStore((st) => st.renumberPlatform);
  const self = isSelfStation(project, s);
  const needsSigns = self || s.signsBySelf;
  const [renumberError, setRenumberError] = useState<string | null>(null);
  const usedPlatforms = new Set(
    project.services.flatMap((v) =>
      v.entries.filter((e) => e.stationId === s.id).map((e) => e.platform),
    ),
  );

  const pmut = (n: number, fn: (pf: Platform) => void) =>
    mut((st) => fn(must(st.platforms.find((x) => x.number === n))));

  return (
    <>
      <h3 style={{ marginTop: 'var(--space-3)' }}>のりば</h3>
      {!needsSigns && (
        <p className="muted">
          看板は相手団体の設定に従います。行先コードに使うので、番号と駅コードだけ入れてください。
        </p>
      )}
      {renumberError && <p role="alert">{renumberError}</p>}
      {s.platforms.map((pf) => (
        <div
          key={pf.number}
          className={`${styles.platform} ${focusPlatform === pf.number ? styles.highlight : ''}`}
        >
          <div className={styles.grid3}>
            <NumberField
              label="のりば番号"
              value={pf.number}
              min={1}
              onChange={(v) => {
                if (v === undefined || !Number.isInteger(v) || v === pf.number) return;
                try {
                  setRenumberError(null);
                  renumber(s.id, pf.number, v);
                } catch (e) {
                  setRenumberError((e as Error).message);
                }
              }}
            />
            <SelectField
              label="行先に使う駅コード"
              help="platformCode"
              value={pf.codeId}
              options={s.codes.map((c) => ({ value: c.id, label: codeText(project, s, c.id) }))}
              onChange={(v) => pmut(pf.number, (x) => void (x.codeId = v))}
            />
            <TextField
              label="表示名（任意）"
              value={pf.label ?? ''}
              placeholder="下り・瑠璃線赤石方面"
              onChange={(v) =>
                pmut(pf.number, (x) => {
                  if (v) x.label = v;
                  else delete x.label;
                })
              }
            />
          </div>
          <p className="mono" style={{ margin: 0 }}>
            行先コード：{codeText(project, s, pf.codeId)}-{pf.number}
          </p>
          {needsSigns && (
            <>
              <DirPicker
                name={`dir-${s.id}-${pf.number}`}
                value={pf.dir}
                onChange={(d) => pmut(pf.number, (x) => void (x.dir = d))}
              />
              <CheckField
                label="行き止まり（同じ線路で着いて出る）"
                help="deadEnd"
                checked={pf.deadEnd}
                onChange={(v) => pmut(pf.number, (x) => void (x.deadEnd = v))}
              />
              <details>
                <summary>このりばだけ看板の数値を変える</summary>
                <div className={styles.grid3}>
                  {(
                    [
                      ['spawnSpeed', 'spawn の初速'],
                      ['stationLaunchDistance', 'station の加速距離'],
                      ['stationDwellSeconds', '停車秒数'],
                    ] as const
                  ).map(([key, label]) => (
                    <NumberField
                      key={key}
                      label={label}
                      value={pf.params?.[key]}
                      min={0}
                      hint={`空欄はプロジェクトの設定（${project.settings[key]}）`}
                      onChange={(v) =>
                        pmut(pf.number, (x) => {
                          const params = Object.fromEntries(
                            Object.entries({ ...x.params, [key]: v }).filter(
                              ([, n]) => n !== undefined,
                            ),
                          );
                          if (Object.keys(params).length > 0) x.params = params;
                          else delete x.params;
                        })
                      }
                    />
                  ))}
                </div>
              </details>
            </>
          )}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button
              size="sm"
              variant="danger"
              disabled={usedPlatforms.has(pf.number)}
              title={usedPlatforms.has(pf.number) ? '系統で使っているので消せません' : undefined}
              onClick={() =>
                mut(
                  (st) => void (st.platforms = st.platforms.filter((x) => x.number !== pf.number)),
                )
              }
            >
              このりばを消す
            </Button>
          </div>
        </div>
      ))}
      <Button
        size="sm"
        onClick={() =>
          mut((st) => {
            const next = Math.max(0, ...st.platforms.map((x) => x.number)) + 1;
            const codeId = st.codes[0]?.id ?? '';
            st.platforms.push({ number: next, codeId, deadEnd: false });
          })
        }
      >
        ＋ のりばを足す
      </Button>
    </>
  );
}

/** 「駅名 コード コード…」を1行1駅で貼り付けて、まとめて足す */
function PasteStations() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(project.stations.length === 0);
  const selfCode = project.orgs.find((o) => o.id === project.selfOrgId)?.code ?? '';

  const parseCode = (p: Project, t: string): StationCode => {
    const line = p.lines.find(
      (l) => l.orgId === p.selfOrgId && selfCode && t === `${selfCode}${l.code}${t.slice(-2)}`,
    );
    const num = Number(t.slice(-2));
    if (line && /^\d{2}$/.test(t.slice(-2))) {
      return { kind: 'numbered', orgId: p.selfOrgId, lineId: line.id, number: num };
    }
    return { kind: 'free', value: t };
  };

  const add = () => {
    const rows = text
      .split(/\r?\n/)
      .map((r) => r.trim().split(/[\s\t,，、]+/))
      .filter((r) => r[0]);
    update((p) => {
      for (const [name = '', ...codes] of rows) {
        const entries = (codes.length > 0 ? codes : ['']).map((c) => ({
          id: newId(),
          code: parseCode(p, c),
        }));
        p.stations.push({
          id: newId(),
          name,
          managerOrgId: p.selfOrgId,
          signsBySelf: true,
          codes: entries,
          platforms: [{ number: 1, codeId: entries[0]?.id ?? '', deadEnd: false }],
        });
      }
    });
    setText('');
  };

  if (!open) {
    return (
      <p>
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          ＋ 駅の一覧を貼り付けてまとめて足す
        </Button>
      </p>
    );
  }
  return (
    <Section
      title="駅の一覧を貼り付ける"
      lead="1行に1駅、「駅名 駅コード」の形で。乗換駅は駅コードを空白で続けます。"
    >
      <textarea
        aria-label="駅の一覧"
        rows={5}
        value={text}
        placeholder={'アカシア島 KL01\n瑠璃中央 KL04 KU01\nイアリーオ国際空港 IIA'}
        onChange={(e) => setText(e.target.value)}
        className="mono"
      />
      <div className="row">
        <Button variant="primary" size="sm" disabled={!text.trim()} onClick={add}>
          まとめて足す
        </Button>
        <Button size="sm" onClick={() => setOpen(false)}>
          閉じる
        </Button>
      </div>
    </Section>
  );
}
