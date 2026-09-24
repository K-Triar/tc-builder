import { useEffect, useId, useState, type ReactNode } from 'react';
import { kindTag } from '../../domain/codes';
import type { Guide, Project } from '../../domain/model';
import { COMPANIES, customCompany, KT_KINDS, DEFAULT_KIND_CODES } from '../../domain/presets';
import { useProjectStore } from '../../store/projectStore';
import {
  addNamedKind,
  chooseCompany,
  dropUnusedNamedKinds,
  dropUnusedOrgs,
  isNamedKind,
  kindInUse,
  lineInUse,
  orgInUse,
  toggleKind,
  toggleLine,
  toggleOrg,
} from '../../store/setupOps';
import { Button } from '../components/Button';
import { Disclosure } from '../components/Disclosure';
import { SelectField, TextField } from '../components/Field';
import { RemoveButton } from '../components/RemoveButton';
import { must } from '../editors/common';
import { useProject } from '../hooks/useDerived';
import { FocusError, FocusFrame } from './FocusFrame';
import { useFocusNav } from './useFocusNav';
import { focusProgress, nextSetup, prevSetup, setupQuestions, type SetupQuestion } from './steps';
import styles from './Focus.module.css';

/** 一覧にない鉄道会社を選んだときの値 */
const OTHER = 'other';

const selfOrg = (p: Project) => p.orgs.find((o) => o.id === p.selfOrgId);

/** 自分の鉄道会社が一覧のどれか（名前とコードが一致するもの） */
function listedSelf(p: Project) {
  const self = selfOrg(p);
  return COMPANIES.find((c) => c.code === self?.code && c.name === self?.name);
}

const namedKinds = (p: Project) => p.kinds.filter(isNamedKind);
const baseKinds = (p: Project) => p.kinds.filter((k) => !isNamedKind(k));
const selfLines = (p: Project) => p.lines.filter((l) => l.orgId === p.selfOrgId);
const otherOrgs = (p: Project) => p.orgs.filter((o) => o.id !== p.selfOrgId);

/** A 路線網の準備の1問（redesign2 §2-1） */
export function SetupCard({ q }: { q: SetupQuestion }) {
  switch (q) {
    case 'name':
      return <NameCard />;
    case 'company':
      return <CompanyCard />;
    case 'through':
      return <ThroughCard />;
    case 'through-orgs':
      return <ThroughOrgsCard />;
    case 'lines':
      return <LinesCard />;
    case 'kinds':
      return <KindsCard />;
    case 'named':
      return <NamedCard />;
    case 'check':
      return <CheckCard />;
  }
}

/** A の質問に共通の枠。「次へ」は答えを確かめてから進む（確かめで止めたら false を返す） */
function SetupFrame({
  q,
  title,
  lead,
  children,
  onNext,
  nextLabel,
}: {
  q: SetupQuestion;
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  onNext?: () => boolean | undefined;
  nextLabel?: string;
}) {
  const project = useProject();
  const { go, fromCheck } = useFocusNav();
  const list = setupQuestions(project.guide);
  const pos = list.indexOf(q) + 1;
  const prev = prevSetup(q, project.guide);
  return (
    <FocusFrame
      section="A"
      pos={pos}
      total={list.length}
      progress={focusProgress('A', pos - 1, list.length)}
      title={title}
      lead={lead}
      back={
        fromCheck
          ? { label: '← 確認へ戻る', onClick: () => go('check') }
          : prev
            ? { onClick: () => go(prev) }
            : null
      }
      next={{
        label: nextLabel ?? (fromCheck ? '確認へ戻る →' : undefined),
        onClick: () => {
          if (onNext?.() === false) return;
          // 最新の答えで次の質問を決める（乗り入れの答えで変わる）
          const guide = useProjectStore.getState().project?.guide;
          const next = nextSetup(q, guide);
          if (fromCheck && next !== 'through-orgs') go('check');
          else go(fromCheck ? `${next}?from=check` : next);
        },
      }}
    >
      {children}
    </FocusFrame>
  );
}

// ---- 2-1-1 路線網の名前 ----

function NameCard() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  return (
    <SetupFrame q="name" title="この路線網に名前を付けてください">
      <TextField
        label="路線網の名前"
        value={project.name}
        placeholder="例：瑠璃線系統"
        hint="自分が見分けるための名前です。看板やコマンドには出ません。あとから変えられます。"
        onChange={(v) => update((p) => void (p.name = v))}
      />
      <Disclosure summary="「路線網」ってなに？">
        <p>直通する路線をまとめて、1つとして扱います。</p>
        <div className={styles.network} aria-hidden="true">
          <span className={styles.pill}>瑠璃本線</span>
          <span className={styles.link}>＝</span>
          <span className={styles.pill}>地下鉄中央線</span>
          <span className={styles.pill}>貿易港線</span>
          <span className={styles.link}>＝</span>
          <span className={styles.pill}>直通先の他社線</span>
        </div>
        <p className={styles.networkCaption}>
          瑠璃本線・地下鉄中央線・貿易港線と、直通先の他社線。これ全体で1つの路線網（例：瑠璃線系統）です。
        </p>
      </Disclosure>
    </SetupFrame>
  );
}

// ---- 2-1-2 鉄道会社 ----

function CompanyCard() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const self = selfOrg(project);
  const listed = listedSelf(project);
  const [choice, setChoice] = useState(
    listed ? listed.code : self?.name || self?.code ? OTHER : '',
  );
  const [error, setError] = useState<string | null>(null);
  const name = useId();

  const choose = (value: string) => {
    setChoice(value);
    setError(null);
    const company = value === OTHER ? customCompany() : COMPANIES.find((c) => c.code === value);
    if (company) update((p) => chooseCompany(p, company), { checkpoint: true });
  };
  const selected = COMPANIES.find((c) => c.code === choice);

  return (
    <SetupFrame
      q="company"
      title="あなたはどの鉄道会社の人ですか？"
      onNext={() => {
        if (!choice) {
          setError('鉄道会社を選んでください。');
          return false;
        }
        if (choice === OTHER && !self?.name.trim()) {
          setError('鉄道会社名を入れてください。');
          return false;
        }
      }}
    >
      <fieldset className={styles.fieldset}>
        <legend className="visually-hidden">鉄道会社</legend>
        <ul className={styles.choices}>
          {[
            ...COMPANIES.map((c) => ({ value: c.code, label: c.name })),
            { value: OTHER, label: '一覧にない鉄道会社' },
          ].map((c) => (
            <li key={c.value}>
              <label className={styles.choice}>
                <input
                  type="radio"
                  name={name}
                  value={c.value}
                  checked={choice === c.value}
                  onChange={() => choose(c.value)}
                />
                <span className={styles.choiceText}>{c.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {choice === OTHER && (
        <div className={`${styles.follow} ${styles.inline2}`}>
          <TextField
            label="鉄道会社名"
            value={self?.name ?? ''}
            placeholder="例：〇〇鉄道"
            onChange={(v) => update((p) => void (must(selfOrg(p)).name = v))}
          />
          <TextField
            label="鉄道会社コード"
            mono
            value={self?.code ?? ''}
            placeholder="例：N"
            hint="半角の英字・数字。あとからでも入れられます"
            onChange={(v) => update((p) => void (must(selfOrg(p)).code = v))}
          />
        </div>
      )}
      {error && <FocusError>{error}</FocusError>}
      {selected && (
        <p className={styles.note}>
          {selected.name} の会社コード「{selected.code}」
          {selected.lines.length > 0 && `と路線（${selected.lines.length}つ）`}
          は自動で入ります。コードは覚えなくてかまいません。
        </p>
      )}
    </SetupFrame>
  );
}

// ---- 2-1-3 乗り入れ ----

const THROUGH: readonly { value: NonNullable<Guide['through']>; label: string }[] = [
  { value: 'yes', label: '乗り入れる' },
  { value: 'no', label: '乗り入れない' },
  { value: 'unknown', label: 'まだ分からない（あとから足せます）' },
];

function ThroughCard() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const setGuide = useProjectStore((s) => s.setGuide);
  const [error, setError] = useState(false);
  const name = useId();
  const through = project.guide?.through;
  return (
    <SetupFrame
      q="through"
      title="ほかの鉄道会社の線路に、列車が乗り入れますか？"
      lead="例：瑠璃線から翠鉄 城東線へ直通する"
      onNext={() => {
        if (!through) {
          setError(true);
          return false;
        }
        if (through !== 'yes') update(dropUnusedOrgs, { checkpoint: true });
      }}
    >
      <fieldset className={styles.fieldset}>
        <legend className="visually-hidden">乗り入れ</legend>
        <ul className={styles.choices}>
          {THROUGH.map((t) => (
            <li key={t.value}>
              <label className={styles.choice}>
                <input
                  type="radio"
                  name={name}
                  checked={through === t.value}
                  onChange={() => {
                    setError(false);
                    setGuide((g) => ({ ...g, through: t.value }));
                  }}
                />
                <span className={styles.choiceText}>{t.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {error && <FocusError>どれか1つを選んでください。</FocusError>}
    </SetupFrame>
  );
}

function ThroughOrgsCard() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const [error, setError] = useState(false);
  const selfCode = selfOrg(project)?.code;
  const listed = COMPANIES.filter((c) => c.code !== selfCode);
  const custom = otherOrgs(project).filter((o) => !COMPANIES.some((c) => c.code === o.code));
  return (
    <SetupFrame
      q="through-orgs"
      title="乗り入れ先の鉄道会社にチェックを入れてください"
      onNext={() => {
        if (otherOrgs(project).length === 0) {
          setError(true);
          return false;
        }
      }}
    >
      <ul className={styles.choices}>
        {listed.map((c) => {
          const org = project.orgs.find((o) => o.id !== project.selfOrgId && o.code === c.code);
          const locked = !!org && orgInUse(project, org.id);
          return (
            <li key={c.code}>
              <label className={styles.choice}>
                <input
                  type="checkbox"
                  checked={!!org}
                  disabled={locked}
                  onChange={(e) => {
                    setError(false);
                    update((p) => toggleOrg(p, c, e.target.checked), { checkpoint: true });
                  }}
                />
                <span className={styles.choiceText}>
                  {c.name}
                  {locked && <span className={styles.choiceNote}>（駅で使っています）</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {custom.length > 0 && (
        <ul className={styles.addedRows} aria-label="一覧にない鉄道会社">
          {custom.map((o) => (
            <li key={o.id} className={styles.inline3}>
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
              <span />
              <RemoveButton
                describe={`${o.name || '鉄道会社'}を消す`}
                blocked={orgInUse(project, o.id) && '駅で使用中'}
                onRemove={() =>
                  update((p) => void (p.orgs = p.orgs.filter((x) => x.id !== o.id)), {
                    checkpoint: true,
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}
      <Button
        size="sm"
        onClick={() => {
          setError(false);
          update(
            (p) => void p.orgs.push({ id: globalThis.crypto.randomUUID(), name: '', code: '' }),
            { checkpoint: true },
          );
        }}
      >
        ＋ 一覧にない鉄道会社を足す
      </Button>
      {error && (
        <FocusError>
          1つ以上選んでください。まだ決まっていなければ「戻る」で「まだ分からない」を選べます。
        </FocusError>
      )}
    </SetupFrame>
  );
}

// ---- 2-1-4 路線 ----

function LinesCard() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const [error, setError] = useState(false);
  const self = selfOrg(project);
  const preset = listedSelf(project)?.lines ?? [];
  const lines = selfLines(project);
  const custom = lines.filter((l) => !preset.some((x) => x.code === l.code));
  const companyName = self?.name || '自分の鉄道会社';
  const firstCode = lines.find((l) => l.code)?.code ?? 'L';
  const example = `${self?.code || 'K'}${firstCode}01`;

  // 一覧の路線がない会社は、最初から入力欄を1つ出しておく
  useEffect(() => {
    if (preset.length > 0) return;
    update((p) => {
      if (selfLines(p).length === 0) {
        p.lines.push({
          id: globalThis.crypto.randomUUID(),
          orgId: p.selfOrgId,
          code: '',
          name: '',
        });
      }
    });
    // 開いたときに1回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLine = () =>
    update(
      (p) =>
        void p.lines.push({
          id: globalThis.crypto.randomUUID(),
          orgId: p.selfOrgId,
          code: '',
          name: '',
        }),
      { checkpoint: true },
    );

  return (
    <SetupFrame
      q="lines"
      title={
        preset.length > 0
          ? `この路線網を走る ${companyName} の路線にチェックを付けてください`
          : `この路線網を走る ${companyName} の路線を入れてください`
      }
      onNext={() => {
        if (!selfLines(project).some((l) => l.code.trim())) {
          setError(true);
          return false;
        }
      }}
    >
      {preset.length > 0 && (
        <ul className={styles.choices}>
          {preset.map((l) => {
            const found = lines.find((x) => x.code === l.code);
            const locked = !!found && lineInUse(project, found.id);
            return (
              <li key={l.code}>
                <label className={styles.choice}>
                  <input
                    type="checkbox"
                    checked={!!found}
                    disabled={locked}
                    onChange={(e) => {
                      setError(false);
                      update((p) => toggleLine(p, l, e.target.checked), { checkpoint: true });
                    }}
                  />
                  <span className={styles.choiceText}>
                    {l.name}
                    {locked && (
                      <span className={styles.choiceNote}>（駅コードで使っています）</span>
                    )}
                  </span>
                  <span className="code-tag">{l.code}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {custom.length > 0 && (
        <ul className={styles.addedRows} aria-label="自分で入れる路線">
          {custom.map((l, i) => (
            <li key={l.id} className={styles.inline3}>
              <TextField
                label="路線の名前"
                value={l.name}
                placeholder="例：瑠璃本線"
                onChange={(v) =>
                  update((p) => void (must(p.lines.find((x) => x.id === l.id)).name = v))
                }
              />
              <TextField
                label="路線コード（英字1文字）"
                mono
                value={l.code}
                placeholder="例：L"
                onChange={(v) => {
                  setError(false);
                  update((p) => void (must(p.lines.find((x) => x.id === l.id)).code = v));
                }}
              />
              <span className={styles.example}>
                駅コードの例{' '}
                <span className="code-tag">{`${self?.code || ''}${l.code || '?'}01`}</span>
              </span>
              {(preset.length > 0 || i > 0) && (
                <RemoveButton
                  describe={`${l.name || l.code || '路線'}を消す`}
                  blocked={lineInUse(project, l.id) && '駅コードで使用中'}
                  onRemove={() =>
                    update((p) => void (p.lines = p.lines.filter((x) => x.id !== l.id)), {
                      checkpoint: true,
                    })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <Button size="sm" onClick={addLine}>
        {preset.length > 0 ? '＋ 一覧にない路線を足す' : '＋ もう1つ足す'}
      </Button>
      <p className={styles.note}>
        {preset.length > 0 ? '右の英字' : '路線コード'}は、駅コード「
        <span className="code-tag">{example}</span>」の「{firstCode}
        」の部分に使われます。{preset.length > 0 && '覚えなくてかまいません。'}
      </p>
      {error && <FocusError>路線を1つ以上選んでください（路線コードも入れます）。</FocusError>}
    </SetupFrame>
  );
}

// ---- 2-1-5 種別 ----

function KindsCard() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const [error, setError] = useState(false);
  const base = baseKinds(project);
  const main = KT_KINDS.filter((k) => DEFAULT_KIND_CODES.includes(k.typeCode));
  const more = KT_KINDS.filter((k) => !DEFAULT_KIND_CODES.includes(k.typeCode));
  const custom = base.filter((k) => !KT_KINDS.some((x) => x.typeCode === k.typeCode));
  const moreOpen =
    custom.length > 0 || more.some((m) => base.some((k) => k.typeCode === m.typeCode));

  const check = (k: { typeCode: string; name: string }) => {
    const found = base.find((x) => x.typeCode === k.typeCode);
    const locked = !!found && kindInUse(project, found.id);
    return (
      <li key={k.typeCode}>
        <label className={styles.choice}>
          <input
            type="checkbox"
            checked={!!found}
            disabled={locked}
            onChange={(e) => {
              setError(false);
              update((p) => toggleKind(p, k, e.target.checked), { checkpoint: true });
            }}
          />
          <span className={styles.choiceText}>
            {k.name}
            {locked && <span className={styles.choiceNote}>（列車の走り方で使っています）</span>}
          </span>
        </label>
      </li>
    );
  };

  return (
    <SetupFrame
      q="kinds"
      title="どの種別の列車が走りますか？"
      onNext={() => {
        if (!baseKinds(project).some((k) => k.typeCode.trim())) {
          setError(true);
          return false;
        }
      }}
    >
      <ul className={styles.choices}>{main.map(check)}</ul>
      <Disclosure summary="ほかの種別（臨時・試運転・自分で足す）" open={moreOpen}>
        <ul className={styles.choices}>{more.map(check)}</ul>
        {custom.length > 0 && (
          <ul className={styles.addedRows} aria-label="自分で足した種別">
            {custom.map((k) => (
              <li key={k.id} className={styles.inline3}>
                <TextField
                  label="種別の名前"
                  value={k.name}
                  placeholder="例：区間快速"
                  onChange={(v) =>
                    update((p) => void (must(p.kinds.find((x) => x.id === k.id)).name = v))
                  }
                />
                <TextField
                  label="種別コード"
                  mono
                  value={k.typeCode}
                  placeholder="例：SL"
                  onChange={(v) =>
                    update((p) => void (must(p.kinds.find((x) => x.id === k.id)).typeCode = v))
                  }
                />
                <span />
                <RemoveButton
                  describe={`${k.name || k.typeCode || '種別'}を消す`}
                  blocked={kindInUse(project, k.id) && '列車の走り方で使用中'}
                  onRemove={() =>
                    update((p) => void (p.kinds = p.kinds.filter((x) => x.id !== k.id)), {
                      checkpoint: true,
                    })
                  }
                />
              </li>
            ))}
          </ul>
        )}
        <Button
          size="sm"
          onClick={() =>
            update(
              (p) =>
                void p.kinds.push({ id: globalThis.crypto.randomUUID(), typeCode: '', name: '' }),
              { checkpoint: true },
            )
          }
        >
          ＋ 種別を自分で足す
        </Button>
      </Disclosure>
      <p className="field-hint">
        走らない種別はチェックを外してください。あとから足したり外したりできます。
      </p>
      {error && <FocusError>種別を1つ以上選んでください。</FocusError>}
    </SetupFrame>
  );
}

// ---- 2-1-6 名前付き列車 ----

function NamedCard() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const setGuide = useProjectStore((s) => s.setGuide);
  const [error, setError] = useState(false);
  const name = useId();
  const named = namedKinds(project);
  const answer = project.guide?.named ?? named.length > 0;
  const bases = baseKinds(project).filter((k) => k.typeCode);

  const add = () => {
    const typeCode = (bases.find((k) => k.typeCode === 'EX') ?? bases[0])?.typeCode ?? 'EX';
    update((p) => void addNamedKind(p, typeCode), { checkpoint: true });
  };

  return (
    <SetupFrame
      q="named"
      title="名前の付いた列車はありますか？"
      lead="例：特急「るりかぜ」のように、特定の列車に愛称がある"
      onNext={() => {
        if (!answer) {
          update(dropUnusedNamedKinds, { checkpoint: true });
          return;
        }
        if (namedKinds(project).some((k) => !k.trainNameCode?.trim())) {
          setError(true);
          return false;
        }
      }}
    >
      <fieldset className={styles.fieldset}>
        <legend className="visually-hidden">名前付き列車</legend>
        <ul className={styles.choices}>
          {[
            { value: false, label: 'ない' },
            { value: true, label: 'ある' },
          ].map((o) => (
            <li key={o.label}>
              <label className={styles.choice}>
                <input
                  type="radio"
                  name={name}
                  checked={answer === o.value}
                  onChange={() => {
                    setError(false);
                    setGuide((g) => ({ ...g, named: o.value }));
                    if (o.value && named.length === 0) add();
                  }}
                />
                <span className={styles.choiceText}>{o.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {answer && (
        <div className={styles.follow}>
          <ul className={styles.addedRows} aria-label="名前付き列車">
            {named.map((k) => (
              <li key={k.id}>
                <div className={styles.inline3}>
                  <SelectField
                    label="種別"
                    value={k.typeCode}
                    options={bases.map((b) => ({ value: b.typeCode, label: b.name || b.typeCode }))}
                    onChange={(v) =>
                      update((p) => void (must(p.kinds.find((x) => x.id === k.id)).typeCode = v))
                    }
                  />
                  <TextField
                    label="列車名コード"
                    mono
                    value={k.trainNameCode ?? ''}
                    placeholder="例：RKZ"
                    onChange={(v) => {
                      setError(false);
                      update(
                        (p) => void (must(p.kinds.find((x) => x.id === k.id)).trainNameCode = v),
                      );
                    }}
                  />
                  <TextField
                    label="名前"
                    value={k.name}
                    placeholder="例：特急るりかぜ"
                    onChange={(v) =>
                      update((p) => void (must(p.kinds.find((x) => x.id === k.id)).name = v))
                    }
                  />
                  <RemoveButton
                    describe={`${k.name || '名前付き列車'}を消す`}
                    blocked={kindInUse(project, k.id) && '列車の走り方で使用中'}
                    onRemove={() =>
                      update((p) => void (p.kinds = p.kinds.filter((x) => x.id !== k.id)), {
                        checkpoint: true,
                      })
                    }
                  />
                </div>
                {k.trainNameCode && (
                  <p className={styles.example}>
                    → 列車のタグは「<span className="code-tag">{kindTag(k)}</span>」になります
                  </p>
                )}
              </li>
            ))}
          </ul>
          <Button size="sm" onClick={add}>
            ＋ もう1つ足す
          </Button>
        </div>
      )}
      {error && <FocusError>列車名コードを入れてください（英字）。</FocusError>}
    </SetupFrame>
  );
}

// ---- 2-1-7 こたえの確認 ----

function CheckCard() {
  const project = useProject();
  const { go } = useFocusNav();
  const self = selfOrg(project);
  const through = project.guide?.through;
  const others = otherOrgs(project);
  const join = (xs: string[], empty: string) => (xs.length > 0 ? xs.join('・') : empty);
  const rows: { label: string; value: string; q: SetupQuestion }[] = [
    { label: '路線網の名前', value: project.name || '（なし）', q: 'name' },
    {
      label: '鉄道会社',
      value: self?.name ? `${self.name}${self.code ? `（${self.code}）` : ''}` : '（まだ）',
      q: 'company',
    },
    {
      label: '乗り入れ先',
      value:
        others.length > 0
          ? join(
              others.map((o) => o.name || o.code || '（名前なし）'),
              '',
            )
          : through === 'unknown'
            ? 'まだ分からない'
            : 'なし',
      q: 'through',
    },
    {
      label: '路線',
      value: join(
        selfLines(project).map((l) => l.name || l.code),
        '（まだ）',
      ),
      q: 'lines',
    },
    {
      label: '種別',
      value: join(
        baseKinds(project).map((k) => k.name || k.typeCode),
        '（まだ）',
      ),
      q: 'kinds',
    },
    {
      label: '名前付き列車',
      value: join(
        namedKinds(project).map((k) => k.name || kindTag(k)),
        'なし',
      ),
      q: 'named',
    },
  ];
  return (
    <SetupFrame q="check" title="ここまでのこたえ" nextLabel="駅の登録へ進む →">
      <dl className={styles.answers}>
        {rows.map((r) => (
          <div key={r.q}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
            <dd>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`${r.label}を変える`}
                onClick={() => go(`${r.q}?from=check`)}
              >
                変える
              </Button>
            </dd>
          </div>
        ))}
      </dl>
      <p>次は、列車が通る駅を登録します。</p>
    </SetupFrame>
  );
}
