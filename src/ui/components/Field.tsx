import { useId, useState, type ReactNode } from 'react';
import type { HelpKey } from '../../content/help';
import { Help } from './Help';
import { readNumber } from './readNumber';

interface BaseProps {
  label: ReactNode;
  help?: HelpKey;
  hint?: ReactNode;
  /** 表で使うとき、見出しを隠して読み上げ名だけにする */
  hideLabel?: boolean;
  className?: string;
}

function Label({ id, label, help, hideLabel }: BaseProps & { id: string }) {
  if (hideLabel) {
    return (
      <span className="visually-hidden">
        <label htmlFor={id}>{label}</label>
      </span>
    );
  }
  return (
    <span className="label-row">
      <label htmlFor={id}>{label}</label>
      {help && <Help topic={help} />}
    </span>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  mono,
  ...base
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  const id = useId();
  return (
    <div className={base.className ?? 'field'}>
      <Label id={id} {...base} />
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        className={mono ? 'mono' : undefined}
        autoComplete="off"
        spellCheck={false}
        aria-describedby={base.hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {base.hint && (
        <div id={`${id}-hint`} className="field-hint">
          {base.hint}
        </div>
      )}
    </div>
  );
}

/**
 * 数値欄。入力途中の文字（空、「1.」など）を許し、数値として読めたときだけ反映する。
 * 読めないときは赤枠と理由を出し、欄を離れたら保存されている値に戻す。
 */
export function NumberField({
  value,
  onChange,
  min,
  step,
  integer,
  required,
  error,
  ...base
}: BaseProps & {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  step?: number | 'any';
  /** 整数だけを受け付ける */
  integer?: boolean;
  /** 空欄を受け付けない（空にしても反映しない） */
  required?: boolean;
  /** 外から渡すエラー（番号の重なりなど） */
  error?: string | null;
}) {
  const id = useId();
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const [synced, setSynced] = useState(value);
  // 外から値が変わったら表示を合わせる
  if (synced !== value) {
    setSynced(value);
    setText(value === undefined ? '' : String(value));
  }
  const parsed = readNumber(text, { min, integer, required });
  const shown = value === undefined ? '空欄' : String(value);
  const message = !parsed.ok ? `${parsed.reason}（今は ${shown} のままです）` : (error ?? null);
  const describedBy = [message ? `${id}-error` : '', base.hint ? `${id}-hint` : '']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={base.className ?? 'field'}>
      <Label id={id} {...base} />
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={text}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(e) => {
          const t = e.target.value.replace(/[０-９．－]/g, (c) =>
            c === '－' ? '-' : String.fromCharCode(c.charCodeAt(0) - 0xfee0),
          );
          setText(t);
          const r = readNumber(t, { min, integer, required });
          if (r.ok && r.value !== value) {
            setSynced(r.value);
            onChange(r.value);
          }
        }}
        onBlur={() => {
          if (!readNumber(text, { min, integer, required }).ok) {
            setText(value === undefined ? '' : String(value));
          }
        }}
        step={step}
      />
      {message && (
        <div id={`${id}-error`} className="field-error">
          {message}
        </div>
      )}
      {base.hint && (
        <div id={`${id}-hint`} className="field-hint">
          {base.hint}
        </div>
      )}
    </div>
  );
}

export function SelectField<T extends string>({
  value,
  onChange,
  options,
  ...base
}: BaseProps & {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  const id = useId();
  return (
    <div className={base.className ?? 'field'}>
      <Label id={id} {...base} />
      <select
        id={id}
        value={value}
        aria-describedby={base.hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {base.hint && (
        <div id={`${id}-hint`} className="field-hint">
          {base.hint}
        </div>
      )}
    </div>
  );
}

export function CheckField({
  checked,
  onChange,
  label,
  help,
  hint,
  className,
}: BaseProps & { checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className={className ?? 'field'}>
      <span className="check-row">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        <label htmlFor={id}>{label}</label>
        {help && <Help topic={help} />}
      </span>
      {hint && (
        <div id={`${id}-hint`} className="field-hint">
          {hint}
        </div>
      )}
    </div>
  );
}

/** 画面のまとまり（見出し＋説明） */
export function Section({
  title,
  lead,
  help,
  children,
  actions,
}: {
  title: ReactNode;
  lead?: ReactNode;
  help?: HelpKey;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="card stack section">
      <div className="section-head">
        <h2>
          {title}
          {help && <Help topic={help} />}
        </h2>
        {actions && <div className="row">{actions}</div>}
      </div>
      {lead && <p className="section-lead">{lead}</p>}
      {children}
    </section>
  );
}
