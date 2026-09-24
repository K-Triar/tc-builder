import type { Sign } from '../../domain/signs';
import { CopyButton } from '../components/CopyButton';
import styles from './work.module.css';

/** 看板の役目（人の言葉）と、TrainCarts での種類 */
const SIGN_KIND_LABELS: Record<Sign['kind'], { role: string; tc: string }> = {
  spawn: { role: '列車を出す', tc: 'spawn' },
  station: { role: '列車を止める', tc: 'station' },
  destination: { role: '行先を決める', tc: 'destination' },
  skip: { role: '通過する列車を飛ばす', tc: 'skip' },
  skipDestroy: { role: '人が乗っていれば次を飛ばす', tc: 'skip destroy' },
  destroy: { role: '空の列車を消す', tc: 'destroy' },
  switcher: { role: 'ポイントを切り替える', tc: 'switcher' },
};

/** Minecraft の看板（4行）。この看板にこの文字を書く、が伝わる見た目。行ごとにコピーできる */
export function SignView({ sign, index }: { sign: Sign; index?: number }) {
  const label = SIGN_KIND_LABELS[sign.kind];
  return (
    <figure className={styles.sign}>
      <figcaption className={styles.signCaption}>
        {index !== undefined && <span className={styles.signIndex}>{index}</span>}
        <span className={styles.signRole}>
          {label.role}
          <span className={styles.signTc}>{label.tc}</span>
        </span>
        {sign.manual && <span className={styles.manual}>要入力</span>}
      </figcaption>
      <ol
        className={styles.signBoard}
        aria-label={index !== undefined ? `${index}枚目の看板に書く文字` : '看板に書く文字'}
      >
        {sign.lines.map((line, i) => (
          <li key={i} className={styles.signLine}>
            <span className={styles.signText}>{line || ' '}</span>
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
      <span className={styles.signPost} aria-hidden="true" />
    </figure>
  );
}
