import { useEffect, useRef, useState, type RefObject } from 'react';
import { useSearchParams } from 'react-router';
import type { Platform, Project, Station, StationCode } from '../../domain/model';
import { useProjectStore } from '../../store/projectStore';
import { Button } from '../components/Button';
import { Disclosure } from '../components/Disclosure';
import line from '../components/StationLine.module.css';
import { CheckField, NumberField, Section, SelectField, TextField } from '../components/Field';
import { RemoveButton } from '../components/RemoveButton';
import { useProject } from '../hooks/useDerived';
import { removeWithUndo } from '../toast';
import { codeText, isSelfStation, must, newId, stationCodesText } from './common';
import { DirPicker } from './DirPicker';
import styles from './editors.module.css';

export type StationPart = 'basic' | 'platforms' | 'all';

/** 駅を最後に足す（番号つきの駅コードは続きの番号を自動で付ける） */
function addStationTo(p: Project) {
  const codeId = newId();
  const line = p.lines.find((l) => l.orgId === p.selfOrgId);
  const numbers = p.stations.flatMap((s) =>
    s.codes.flatMap((c) =>
      c.code.kind === 'numbered' && c.code.lineId === line?.id ? [c.code.number] : [],
    ),
  );
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
              number: Math.max(0, ...numbers) + 1,
            }
          : { kind: 'free', value: '' },
      },
    ],
    platforms: [{ number: 1, codeId, deadEnd: false }],
  });
}

/** ウィザード「駅を登録する」：駅名だけを路線図の上に並べて入れる。コードや管理する鉄道会社は詳しい設定へ */
export function GuidedStations() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const [params] = useSearchParams();
  const focusStation = params.get('station');
  const lastInput = useRef<HTMLInputElement>(null);
  const focusAdded = useRef(false);

  // 駅を足したら、その駅の名前の欄へ
  useEffect(() => {
    if (!focusAdded.current) return;
    focusAdded.current = false;
    lastInput.current?.focus();
  }, [project.stations.length]);

  const add = () => {
    focusAdded.current = true;
    update(addStationTo, { checkpoint: true });
  };

  return (
    <>
      {project.stations.length === 0 ? (
        <p className="muted">まだ駅がありません。路線の端の駅から足していきましょう。</p>
      ) : (
        <ol className={line.line} aria-label="登録した駅">
          {project.stations.map((s, i) => (
            <GuidedStationRow
              key={s.id}
              station={s}
              index={i}
              highlight={focusStation === s.id}
              inputRef={i === project.stations.length - 1 ? lastInput : undefined}
            />
          ))}
        </ol>
      )}
      <div className={styles.addStation}>
        <Button variant={project.stations.length < 2 ? 'primary' : 'secondary'} onClick={add}>
          ＋ {project.stations.length === 0 ? '最初の駅を足す' : '次の駅を足す'}
        </Button>
      </div>
      <PasteStations guided />
    </>
  );
}

function GuidedStationRow({
  station: s,
  index,
  highlight,
  inputRef,
}: {
  station: Station;
  index: number;
  highlight: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const project = useProject();
  const update = useProjectStore((st) => st.update);
  const ref = useRef<HTMLLIElement>(null);
  const self = isSelfStation(project, s);
  const used = project.services.some((v) => v.entries.some((e) => e.stationId === s.id));
  const mut = (fn: (st: Station, p: Project) => void) =>
    update((p) => fn(must(p.stations.find((x) => x.id === s.id)), p));
  const nameId = `station-name-${s.id}`;

  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [highlight]);

  return (
    <li
      ref={ref}
      id={`station-${s.id}`}
      className={`${line.stop} ${highlight ? styles.highlight : ''}`}
    >
      <span className={`${line.dot} ${s.name ? line.doneDot : ''}`} aria-hidden="true" />
      <div className={`${line.body} ${styles.guidedStation}`}>
        <div className={styles.guidedHead}>
          <label htmlFor={nameId} className="visually-hidden">
            {index + 1}番目の駅の名前
          </label>
          <input
            id={nameId}
            ref={inputRef}
            type="text"
            value={s.name}
            placeholder="駅の名前（例：瑠璃中央）"
            autoComplete="off"
            className={styles.stationNameInput}
            onChange={(e) => mut((st) => void (st.name = e.target.value))}
          />
          <span className={styles.codeTags} title="駅コード（自動）">
            {stationCodesText(project, s)
              .split('・')
              .filter(Boolean)
              .map((c) => (
                <span key={c} className="code-tag">
                  {c}
                </span>
              ))}
            {!self && <span className={styles.badge}>他の鉄道会社</span>}
          </span>
        </div>
        <Disclosure summary="詳しい設定（駅コード・管理する鉄道会社・並べ替え）" open={highlight}>
          <StationBasic station={s} mut={mut} hideName />
          <div className="row">
            <Button
              size="sm"
              aria-label={`${s.name}を上へ`}
              disabled={index === 0}
              onClick={() =>
                update(
                  (p) => void p.stations.splice(index - 1, 0, ...p.stations.splice(index, 1)),
                  { checkpoint: true },
                )
              }
            >
              上へ
            </Button>
            <Button
              size="sm"
              aria-label={`${s.name}を下へ`}
              disabled={index === project.stations.length - 1}
              onClick={() =>
                update(
                  (p) => void p.stations.splice(index + 1, 0, ...p.stations.splice(index, 1)),
                  { checkpoint: true },
                )
              }
            >
              下へ
            </Button>
            <RemoveButton
              describe={`${s.name || '駅'}を消す`}
              blocked={used && '系統で使用中'}
              onRemove={() =>
                removeWithUndo(
                  `駅「${s.name || '駅名なし'}」を消しました`,
                  (p) => void (p.stations = p.stations.filter((x) => x.id !== s.id)),
                )
              }
            >
              この駅を消す
            </RemoveButton>
          </div>
        </Disclosure>
      </div>
    </li>
  );
}

/** ウィザード「のりばを設定する」：1つの駅ののりば */
export function StationPlatforms({ stationId }: { stationId: string }) {
  const project = useProject();
  const update = useProjectStore((st) => st.update);
  const [params] = useSearchParams();
  const s = project.stations.find((x) => x.id === stationId);
  if (!s) return null;
  const mut = (fn: (st: Station, p: Project) => void) =>
    update((p) => fn(must(p.stations.find((x) => x.id === stationId)), p));
  const fp = params.get('station') === stationId ? Number(params.get('platform')) : undefined;
  return <PlatformList station={s} mut={mut} focusPlatform={fp} guided />;
}

/** 編集「駅とのりば」（すべての項目を出す） */
export function StationEditor({ part = 'all' }: { part?: StationPart }) {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const [params] = useSearchParams();
  const focusStation = params.get('station');
  const focusPlatform = params.get('platform');

  const addStation = () => update(addStationTo, { checkpoint: true });

  return (
    <>
      {part !== 'platforms' && <PasteStations />}
      <Section
        title={part === 'platforms' ? 'のりば' : '駅'}
        help={part === 'platforms' ? 'dir' : 'stationCode'}
        lead={
          part === 'platforms'
            ? 'のりばごとに、番号・行先に使う駅コード・列車の進む向き・行き止まりかを入れます。通過線ものりばとして入れます。'
            : '駅名・管理する鉄道会社・駅コードを入れます。乗換駅は路線ごとの駅コードを足します。'
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
  const self = isSelfStation(project, s);
  const used = project.services.some((v) => v.entries.some((e) => e.stationId === s.id));

  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
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
          {!self && <span className={styles.badge}>他の鉄道会社</span>}
        </strong>
        {part !== 'platforms' && (
          <div className="row">
            <Button
              size="sm"
              aria-label={`${s.name}を上へ`}
              disabled={index === 0}
              onClick={() =>
                update(
                  (p) => void p.stations.splice(index - 1, 0, ...p.stations.splice(index, 1)),
                  { checkpoint: true },
                )
              }
            >
              {'↑︎'}
            </Button>
            <Button
              size="sm"
              aria-label={`${s.name}を下へ`}
              disabled={index === project.stations.length - 1}
              onClick={() =>
                update(
                  (p) => void p.stations.splice(index + 1, 0, ...p.stations.splice(index, 1)),
                  { checkpoint: true },
                )
              }
            >
              {'↓︎'}
            </Button>
            <RemoveButton
              describe={`${s.name || '駅'}を消す`}
              blocked={used && '系統で使用中'}
              onRemove={() =>
                removeWithUndo(
                  `駅「${s.name || '駅名なし'}」を消しました`,
                  (p) => void (p.stations = p.stations.filter((x) => x.id !== s.id)),
                )
              }
            />
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
  hideName,
}: {
  station: Station;
  mut: (fn: (st: Station, p: Project) => void) => void;
  hideName?: boolean;
}) {
  const project = useProject();
  const update = useProjectStore((st) => st.update);
  const self = isSelfStation(project, s);
  const selfLines = project.lines.filter((l) => l.orgId === project.selfOrgId);
  const usedCodeIds = new Set(s.platforms.map((p) => p.codeId));
  return (
    <>
      <div className={styles.grid2}>
        {!hideName && (
          <TextField
            label="駅名"
            value={s.name}
            onChange={(v) => mut((st) => void (st.name = v))}
          />
        )}
        <SelectField
          label="管理する鉄道会社"
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
          hint="外すと、看板は相手の鉄道会社の設定に従う（すり合わせだけ）になります"
          onChange={(v) => mut((st) => void (st.signsBySelf = v))}
        />
      )}
      <h3 className={styles.subhead}>駅コード</h3>
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
                  integer
                  required
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
            <span className={styles.tagBox}>
              <span className="muted text-xs">表示</span>
              <span className={styles.tag}>{codeText(project, s, c.id)}</span>
            </span>
            <RemoveButton
              describe={`駅コード ${codeText(project, s, c.id)} を消す`}
              blocked={
                s.codes.length <= 1 ? '最後の1つ' : usedCodeIds.has(c.id) && 'のりばで使用中'
              }
              onRemove={() =>
                removeWithUndo(`駅コード ${codeText(project, s, c.id)} を消しました`, (p) => {
                  const st = must(p.stations.find((x) => x.id === s.id));
                  st.codes = st.codes.filter((x) => x.id !== c.id);
                })
              }
            />
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        onClick={() =>
          update(
            (p) =>
              void must(p.stations.find((x) => x.id === s.id)).codes.push({
                id: newId(),
                code: { kind: 'free', value: '' },
              }),
            { checkpoint: true },
          )
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
  guided,
}: {
  station: Station;
  mut: (fn: (st: Station, p: Project) => void) => void;
  focusPlatform?: number;
  /** ウィザード：向きと行き止まりを先に出し、番号・コード・数値は詳しい設定へ */
  guided?: boolean;
}) {
  const project = useProject();
  const renumber = useProjectStore((st) => st.renumberPlatform);
  const update = useProjectStore((st) => st.update);
  const self = isSelfStation(project, s);
  const needsSigns = self || s.signsBySelf;
  const [renumberError, setRenumberError] = useState<{
    platform: number;
    message: string;
  } | null>(null);
  const usedPlatforms = new Set(
    project.services.flatMap((v) =>
      v.entries.filter((e) => e.stationId === s.id).map((e) => e.platform),
    ),
  );

  const pmut = (n: number, fn: (pf: Platform) => void) =>
    mut((st) => fn(must(st.platforms.find((x) => x.number === n))));

  const basicFields = (pf: Platform) => (
    <>
      <div className={styles.grid3}>
        <NumberField
          label="のりば番号"
          value={pf.number}
          min={1}
          integer
          required
          error={renumberError?.platform === pf.number ? renumberError.message : null}
          onChange={(v) => {
            if (v === undefined || v === pf.number) return;
            try {
              setRenumberError(null);
              renumber(s.id, pf.number, v);
            } catch (e) {
              setRenumberError({ platform: pf.number, message: (e as Error).message });
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
      <p className={styles.destLine}>
        行先コード（TrainCarts の destination）{' '}
        <span className="code-tag">
          {codeText(project, s, pf.codeId)}-{pf.number}
        </span>
      </p>
    </>
  );

  const paramFields = (pf: Platform) => (
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
                Object.entries({ ...x.params, [key]: v }).filter(([, n]) => n !== undefined),
              );
              if (Object.keys(params).length > 0) x.params = params;
              else delete x.params;
            })
          }
        />
      ))}
    </div>
  );

  const signFields = (pf: Platform) => (
    <>
      <DirPicker
        name={`dir-${s.id}-${pf.number}`}
        value={pf.dir}
        onChange={(d) => pmut(pf.number, (x) => void (x.dir = d))}
      />
      <CheckField
        label="行き止まり（同じ線路で着いて、折り返して出る）"
        help="deadEnd"
        checked={pf.deadEnd}
        onChange={(v) => pmut(pf.number, (x) => void (x.deadEnd = v))}
      />
    </>
  );

  return (
    <>
      {!guided && <h3 className={styles.subhead}>のりば</h3>}
      {!needsSigns && (
        <p className="muted">
          看板は相手の鉄道会社の設定に従います。行先コードに使うので、番号と駅コードだけ入れてください。
        </p>
      )}
      {s.platforms.map((pf) => (
        <div
          key={pf.number}
          className={`${styles.platform} ${focusPlatform === pf.number ? styles.highlight : ''}`}
        >
          {guided ? (
            <>
              <h3 className={styles.platformTitle}>
                {pf.number}番のりば
                {pf.label && <span className={styles.platformLabel}>{pf.label}</span>}
              </h3>
              {needsSigns ? (
                <>
                  {signFields(pf)}
                  <Disclosure summary="詳しい設定（のりば番号・行先コード・看板の数値）">
                    {basicFields(pf)}
                    {paramFields(pf)}
                  </Disclosure>
                </>
              ) : (
                basicFields(pf)
              )}
            </>
          ) : (
            <>
              {basicFields(pf)}
              {needsSigns && (
                <>
                  {signFields(pf)}
                  <details>
                    <summary>このりばだけ看板の数値を変える</summary>
                    {paramFields(pf)}
                  </details>
                </>
              )}
            </>
          )}
          <div className={styles.platformFoot}>
            <RemoveButton
              describe={`${s.name} ${pf.number}番のりばを消す`}
              blocked={usedPlatforms.has(pf.number) && '系統で使用中'}
              onRemove={() =>
                removeWithUndo(`${s.name || '駅'} ${pf.number}番のりばを消しました`, (p) => {
                  const st = must(p.stations.find((x) => x.id === s.id));
                  st.platforms = st.platforms.filter((x) => x.number !== pf.number);
                })
              }
            >
              このりばを消す
            </RemoveButton>
          </div>
        </div>
      ))}
      <Button
        size="sm"
        onClick={() =>
          update(
            (p) => {
              const st = must(p.stations.find((x) => x.id === s.id));
              const next = Math.max(0, ...st.platforms.map((x) => x.number)) + 1;
              const codeId = st.codes[0]?.id ?? '';
              st.platforms.push({ number: next, codeId, deadEnd: false });
            },
            { checkpoint: true },
          )
        }
      >
        ＋ のりばを足す
      </Button>
    </>
  );
}

/** 「駅名 コード コード…」を1行1駅で貼り付けて、まとめて足す。駅名だけなら駅コードは自動で付ける */
function PasteStations({ guided }: { guided?: boolean }) {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(!guided && project.stations.length === 0);
  const [added, setAdded] = useState<number | null>(null);
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
    update(
      (p) => {
        for (const [name = '', ...codes] of rows) {
          if (codes.length === 0) {
            addStationTo(p);
            must(p.stations.at(-1)).name = name;
            continue;
          }
          const entries = codes.map((c) => ({ id: newId(), code: parseCode(p, c) }));
          p.stations.push({
            id: newId(),
            name,
            managerOrgId: p.selfOrgId,
            signsBySelf: true,
            codes: entries,
            platforms: [{ number: 1, codeId: entries[0]?.id ?? '', deadEnd: false }],
          });
        }
      },
      { checkpoint: true },
    );
    setText('');
    setAdded(rows.length);
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
      lead="1行に1駅ずつ、駅名を並べます。駅コードは自動で付きます（決まっているときは「駅名 KL01」のように空白のあとに書けます）。"
    >
      <textarea
        aria-label="駅の一覧"
        rows={5}
        value={text}
        placeholder={'アカシア島\n瑠璃中央 KL04 KU01\nイアリーオ国際空港 IIA'}
        onChange={(e) => {
          setText(e.target.value);
          setAdded(null);
        }}
        className="mono"
      />
      <div className="row">
        <Button variant="primary" size="sm" disabled={!text.trim()} onClick={add}>
          まとめて足す
        </Button>
        <Button size="sm" onClick={() => setOpen(false)}>
          閉じる
        </Button>
        <span role="status" className="status-msg">
          {added !== null && `✓ ${added} 駅を足しました。下の一覧で確かめてください。`}
        </span>
      </div>
    </Section>
  );
}
