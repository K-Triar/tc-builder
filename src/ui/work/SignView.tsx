import type { Sign } from '../../domain/signs';
import { CopyButton } from '../components/CopyButton';
import styles from './work.module.css';

const SIGN_KIND_LABELS: Record<Sign['kind'], string> = {
  spawn: 'spawn（列車を出す）',
  station: 'station（止める）',
  destination: 'destination（行先）',
  skip: 'skip（通過列車を飛ばす）',
  skipDestroy: 'skip destroy（人が乗っていれば飛ばす）',
  destroy: 'destroy（列車を消す）',
  switcher: 'switcher（ポイント）',
};

/** Minecraft の看板を思わせる4行。行ごとにコピーできる */
export function SignView({ sign, index }: { sign: Sign; index?: number }) {
  return (
    <figure className={styles.sign}>
      <figcaption className={styles.signCaption}>
        {index !== undefined && <span className={styles.signIndex}>{index}枚目</span>}
        {SIGN_KIND_LABELS[sign.kind]}
        {sign.manual && <span className={styles.manual}>要入力</span>}
      </figcaption>
      <ol className={styles.signBoard}>
        {sign.lines.map((line, i) => (
          <li key={i} className={styles.signLine}>
            <span className={styles.signText}>{line || ' '}</span>
            {line && (
              <CopyButton
                text={line}
                label="⧉"
                describe={`${index !== undefined ? `${index}枚目の` : ''}${i + 1}行目「${line}」をコピー`}
                variant="ghost"
                className={styles.lineCopy}
              />
            )}
          </li>
        ))}
      </ol>
    </figure>
  );
}
