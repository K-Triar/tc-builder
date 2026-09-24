import type { PlatformCard, Sign } from '../../domain/signs';

const SHORT: Record<Sign['kind'], string> = {
  spawn: 'spawn',
  station: 'station',
  destination: 'dest',
  skip: 'skip',
  skipDestroy: 'skip×',
  destroy: 'destroy',
  switcher: 'switch',
};

const W = 64; // 看板1枚の幅
const GAP = 8;
const PAD = 16;

/**
 * ホームから見た図（design §6.3）。奥が線路、手前がホーム。
 * 看板は物理的な左→右の並び（card.diagram）で描き、進行方向順の番号を付ける。
 * spawn のボタン：right は看板のブロックに、left は左隣のブロックから電源を入れる。
 */
export function PlatformDiagram({ card }: { card: PlatformCard }) {
  const n = card.diagram.length;
  if (n === 0 || !card.dir) return null;
  const width = PAD * 2 + n * W + (n - 1) * GAP;
  const offset = PAD;
  const toRight = card.dir === 'right';
  const x = (pos: number) => offset + pos * (W + GAP);
  const label = `ホームから見た図：列車は${toRight ? '左から右' : '右から左'}へ進む。看板は左から ${card.diagram
    .map((i) => `${i + 1}枚目 ${card.signs[i] ? SHORT[card.signs[i].kind] : ''}`)
    .join('、')}`;

  return (
    <svg
      viewBox={`0 0 ${width} 150`}
      width="100%"
      style={{ maxWidth: width * 1.4, display: 'block' }}
      role="img"
      aria-label={label}
    >
      {/* 線路 */}
      <rect x="0" y="10" width={width} height="26" fill="var(--surface-3)" rx="3" />
      <line x1="0" y1="16" x2={width} y2="16" stroke="var(--text-muted)" strokeWidth="2" />
      <line x1="0" y1="30" x2={width} y2="30" stroke="var(--text-muted)" strokeWidth="2" />
      <g transform={toRight ? undefined : `translate(${width} 0) scale(-1 1)`}>
        <line
          x1={PAD}
          y1="23"
          x2={width - PAD - 14}
          y2="23"
          stroke="var(--accent)"
          strokeWidth="4"
        />
        <polygon
          points={`${width - PAD - 14},15 ${width - PAD},23 ${width - PAD - 14},31`}
          fill="var(--accent)"
        />
      </g>
      {/* 看板（線路のすぐ手前、文字面はホーム側） */}
      {card.diagram.map((signIndex, pos) => {
        const sign = card.signs[signIndex];
        if (!sign) return null;
        const sx = x(pos);
        const isSpawn = sign.kind === 'spawn';
        return (
          <g key={pos}>
            <rect
              x={sx}
              y="44"
              width={W}
              height="40"
              rx="3"
              fill="var(--sign-bg)"
              stroke="var(--sign-border)"
              strokeWidth="2"
            />
            <text
              x={sx + W / 2}
              y="60"
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="var(--sign-text)"
            >
              {signIndex + 1}
            </text>
            <text x={sx + W / 2} y="77" textAnchor="middle" fontSize="11" fill="var(--sign-text)">
              {SHORT[sign.kind]}
            </text>
            {isSpawn && card.buttonHint === 'onBlock' && (
              <g>
                <rect
                  x={sx + W / 2 - 7}
                  y="88"
                  width="14"
                  height="10"
                  rx="2"
                  fill="var(--danger)"
                />
                <text x={sx + W / 2} y="110" textAnchor="middle" fontSize="10" fill="var(--text)">
                  ボタン
                </text>
              </g>
            )}
            {isSpawn && card.buttonHint === 'leftSide' && (
              <g>
                <rect x={sx - 12} y="88" width="14" height="10" rx="2" fill="var(--danger)" />
                <line
                  x1={sx - 5}
                  y1="88"
                  x2={sx - 2}
                  y2="72"
                  stroke="var(--danger)"
                  strokeWidth="2"
                />
                <text x={sx + 4} y="110" textAnchor="middle" fontSize="10" fill="var(--text)">
                  左横から
                </text>
              </g>
            )}
          </g>
        );
      })}
      {/* ホーム */}
      <rect
        x="0"
        y="118"
        width={width}
        height="30"
        fill="var(--surface-2)"
        stroke="var(--border)"
        rx="3"
      />
      <text x={width / 2} y="138" textAnchor="middle" fontSize="12" fill="var(--text)">
        ホーム（ここから線路を見る）
      </text>
    </svg>
  );
}
