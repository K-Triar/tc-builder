import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CHECK_COMMANDS } from '../../domain/commands';
import { workIds, workStatus } from '../../domain/progress';
import { copyText } from '../clipboard';
import { Button } from '../components/Button';
import { CopyButton } from '../components/CopyButton';
import { useDerived, useProject } from '../hooks/useDerived';
import { issueLink } from '../issues';
import { WorkCheck } from './WorkCheck';
import styles from './work.module.css';

/** エラーがあるときに出す件数 */
const ERRORS_SHOWN = 5;

/** エラーがあるときは出力を止める（R9.2）。直すべきエラーをその場に並べ、入力へ飛べるようにする */
export function ErrorsStop() {
  const project = useProject();
  const { derived } = useDerived();
  const errors = derived.issues.filter((i) => i.severity === 'error');
  return (
    <div role="alert" className={`${styles.caution} ${styles.cautionError}`}>
      <p className={styles.cautionTitle}>
        ✖ 入力にエラーが {errors.length} 件あるため、看板とコマンドを出していません
      </p>
      <p>次のエラーを直すと表示されます。押すと、直す場所へ移ります。</p>
      <ul className={styles.errorList}>
        {errors.slice(0, ERRORS_SHOWN).map((issue, i) => (
          <li key={`${issue.code}-${i}`}>
            <Link to={issueLink(project.id, issue.target)}>{issue.message}</Link>
          </li>
        ))}
      </ul>
      {errors.length > ERRORS_SHOWN && (
        <p className="text-sm">
          ほか {errors.length - ERRORS_SHOWN} 件は、検証の一覧で見られます。
        </p>
      )}
    </div>
  );
}

/** 作業「コマンド」：0. 準備 → 1. 経路 → 2. 編成 → 3. 仕上げ（design §6.4） */
export function CommandsView() {
  const project = useProject();
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
      <div className={`row ${styles.modeRow}`}>
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
            const done =
              workStatus(project.progress, { id: workIds.command(b.id), hash: b.hash }) === 'done';
            return (
              <div
                key={b.id}
                className={`${styles.block} ${isCurrent ? styles.blockCurrent : ''} ${done ? styles.blockDone : ''}`}
              >
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
        <table className={styles.checkTable}>
          <tbody>
            {CHECK_COMMANDS.map((c) => (
              <tr key={c.command}>
                <th scope="row">
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
