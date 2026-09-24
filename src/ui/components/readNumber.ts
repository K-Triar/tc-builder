// 数値欄の入力の読み取り（NumberField で使う）。

/** 数値欄の入力を読む。読めなければ理由を返す */
export function readNumber(
  text: string,
  rule: { min?: number; integer?: boolean; required?: boolean },
): { ok: true; value: number | undefined } | { ok: false; reason: string } {
  const t = text.trim();
  if (t === '') {
    return rule.required
      ? { ok: false, reason: '空にはできません' }
      : { ok: true, value: undefined };
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return { ok: false, reason: '数字で入れてください' };
  if (rule.integer && !Number.isInteger(n)) return { ok: false, reason: '整数で入れてください' };
  if (rule.min !== undefined && n < rule.min) {
    return { ok: false, reason: `${rule.min} 以上の数を入れてください` };
  }
  return { ok: true, value: n };
}
