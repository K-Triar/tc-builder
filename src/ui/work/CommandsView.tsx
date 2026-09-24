import { useEffect, useMemo, useRef, useState } from 'react';
import { CHECK_COMMANDS } from '../../domain/commands';
import { workIds } from '../../domain/progress';
import { copyText } from '../clipboard';
import { Button } from '../components/Button';
import { CopyButton } from '../components/CopyButton';
import { useDerived } from '../hooks/useDerived';
import { WorkCheck } from './WorkCheck';
import styles from './work.module.css';

/** エラーがあるときは出力を止める（R9.2） */
export function ErrorsStop() {
  return (
    <p role="alert" className={styles.caution}>
      ✖
      入力にエラーがあるため、看板とコマンドを出していません。検証の一覧からエラーを直してください。
    </p>
  );
}

/** 作業「コマンド」：0. 準備 → 1. 経路 → 2. 編成 → 3. 仕上げ（design §6.4） */
export function CommandsView() {
  const { derived } = useDerived();
  const plan = derived.commandPlan;
  const [stepMode, setStepMode] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [copied, setCopied] = useState(false);
  const currentRef = useRef<HTMLLIElement>(null);

  // 「次の行をコピー」で進む順（全ブロックの全行）
  const lines = useMemo(
    () =>
      plan.groups.flatMap((g) =>
        g.blocks.flatMap((b) => b.lines.map((line, i) => ({ blockId: b.id, index: i, line }))),
      ),
    [plan],
  );
  const current = stepMode ? lines[Math.min(cursor, lines.length - 1)] : undefined;

  useEffect(() => {
    if (stepMode) currentRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [stepMode, cursor]);

  const copyAndNext = async () => {
    if (!current) return;
    const ok = await copyText(current.line);
    setCopied(ok);
    if (ok) setCursor((c) => Math.min(c + 1, lines.length));
  };

  if (derived.hasErrors) return <ErrorsStop />;

  return (
    <div>
      <ul className={styles.notes}>
        {plan.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
        <li>
          Minecraft のチャットには1行ずつ貼り付けます。「次の行をコピー」を使うと順に進めます。
        </li>
      </ul>
      <div className="row" style={{ marginBottom: 'var(--space-4)' }}>
        <Button
          variant={stepMode ? 'secondary' : 'primary'}
          onClick={() => {
            setStepMode((v) => !v);
            setCopied(false);
          }}
        >
          {stepMode ? '1行ずつモードを終わる' : '▶ 次の行をコピー（1行ずつモード）'}
        </Button>
      </div>

      {stepMode && (
        <div className={styles.stepper} role="region" aria-label="1行ずつコピー">
          {current && cursor < lines.length ? (
            <>
              <span className={styles.stepperText}>
                {cursor + 1}/{lines.length}：{current.line}
              </span>
              <Button disabled={cursor === 0} onClick={() => setCursor((c) => Math.max(0, c - 1))}>
                ← 戻る
              </Button>
              <Button variant="primary" onClick={() => void copyAndNext()}>
                コピーして次へ
              </Button>
              <span aria-live="polite" className="visually-hidden">
                {copied ? `${cursor}行目をコピーしました` : ''}
              </span>
            </>
          ) : (
            <>
              <span className={styles.stepperText}>✓ すべての行をコピーしました</span>
              <Button onClick={() => setCursor(0)}>最初から</Button>
            </>
          )}
        </div>
      )}

      {plan.groups.map((g) => (
        <section
          key={`${g.kind}-${g.cars ?? ''}`}
          className={styles.group}
          aria-labelledby={`g-${g.title}`}
        >
          <h2 id={`g-${g.title}`}>{g.title}</h2>
          {g.note && <p className="muted">{g.note}</p>}
          {g.blocks.map((b) => {
            const isCurrent = current?.blockId === b.id;
            return (
              <div key={b.id} className={`${styles.block} ${isCurrent ? styles.blockCurrent : ''}`}>
                <div className={styles.blockHead}>
                  <h3 className={styles.blockTitle}>{b.title}</h3>
                  <div className="row">
                    {b.lines.length > 1 && (
                      <CopyButton
                        text={b.lines.join('\n')}
                        label="まとめてコピー"
                        describe={`${b.title} のコマンドをまとめてコピー`}
                      />
                    )}
                    <WorkCheck id={workIds.command(b.id)} label="実行した" />
                  </div>
                </div>
                {b.note && <p className="muted">{b.note}</p>}
                {b.lines.length > 0 && (
                  <ol className={styles.cmdList}>
                    {b.lines.map((line, i) => {
                      const here = isCurrent && current?.index === i;
                      return (
                        <li
                          key={i}
                          ref={here ? currentRef : undefined}
                          className={`${styles.cmd} ${here ? styles.cmdCurrent : ''}`}
                        >
                          <code>{line}</code>
                          <CopyButton text={line} describe={`「${line}」をコピー`} />
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </section>
      ))}

      <details>
        <summary>確認に使うコマンド</summary>
        <table>
          <tbody>
            {CHECK_COMMANDS.map((c) => (
              <tr key={c.command}>
                <th scope="row" style={{ textAlign: 'left', paddingRight: 16 }}>
                  <code>{c.command}</code>
                </th>
                <td>{c.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
