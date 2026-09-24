import { useId, useState, type ReactNode } from 'react';
import type { HelpKey } from '../../content/help';
import { Help } from './Help';

interface BaseProps {
  label: ReactNode;
  help?: HelpKey;
  hint?: ReactNode;
  /** 表で使うとき、見出しを隠して読み上げ名だけにする */
  hideLabel?: boolean;
  className?: string;
}

function Label({ id, label, help, hideLabel }: BaseProps & { id: string }) {
  return (
    <span className={hideLabel ? 'visually-hidden' : undefined}>
      <label htmlFor={id} style={{ display: 'inline' }}>
        {label}
      </label>
      {help && !hideLabel && <Help topic={help} />}
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
        onChange={(e) => onChange(e.target.value)}
      />
      {base.hint && <div className="field-hint">{base.hint}</div>}
    </div>
  );
}

/** 数値欄。入力途中の文字（空、「1.」など）を許し、数値として読めたときだけ反映する */
export function NumberField({
  value,
  onChange,
  min,
  step,
  ...base
}: BaseProps & {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  step?: number | 'any';
}) {
  const id = useId();
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const [synced, setSynced] = useState(value);
  // 外から値が変わったら表示を合わせる
  if (synced !== value) {
    setSynced(value);
    setText(value === undefined ? '' : String(value));
  }
  return (
    <div className={base.className ?? 'field'}>
      <Label id={id} {...base} />
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[０-９．]/g, (c) =>
            String.fromCharCode(c.charCodeAt(0) - 0xfee0),
          );
          setText(t);
          if (t.trim() === '') {
            setSynced(undefined);
            onChange(undefined);
            return;
          }
          const n = Number(t);
          if (Number.isFinite(n) && (min === undefined || n >= min)) {
            setSynced(n);
            onChange(n);
          }
        }}
        step={step}
      />
      {base.hint && <div className="field-hint">{base.hint}</div>}
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
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {base.hint && <div className="field-hint">{base.hint}</div>}
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
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          style={{ width: 22, height: 22 }}
          onChange={(e) => onChange(e.target.checked)}
        />
        <label htmlFor={id} style={{ margin: 0 }}>
          {label}
        </label>
        {help && <Help topic={help} />}
      </span>
      {hint && <div className="field-hint">{hint}</div>}
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
    <section className="card stack" style={{ marginBottom: 'var(--space-4)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>
          {title}
          {help && <Help topic={help} />}
        </h2>
        {actions && <div className="row">{actions}</div>}
      </div>
      {lead && <p className="muted">{lead}</p>}
      {children}
    </section>
  );
}
