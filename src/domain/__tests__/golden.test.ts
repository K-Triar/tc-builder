import { describe, expect, it } from 'vitest';
import confirmed from '../../fixtures/ruri/confirmed.json';
import expected from '../../fixtures/ruri/expected.json';
import sample from '../../fixtures/ruri/project.ktc.json';
import { derive } from '../derive';
import { parseProject } from '../schema';
import { goldenDiffs, type Expected } from './golden';

describe('T14：瑠璃線系統サンプル（Excel とのゴールデンテスト）', () => {
  const parsed = parseProject(sample);
  if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
  const d = derive(parsed.project);

  it('サンプルはスキーマを通り、エラーがない', () => {
    expect(d.issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('Excel との差分は、すべてユーザー確認済み（confirmed.json）', () => {
    const diffs = goldenDiffs(parsed.project, d, expected as Expected);
    const ok = new Set(Object.keys(confirmed.diffs));
    const unconfirmed = diffs.filter((x) => !ok.has(x.key)).map((x) => `${x.key}\n  ${x.message}`);
    expect(unconfirmed).toEqual([]);
    // 確認済みなのに差分が消えたものは confirmed.json から消す
    const current = new Set(diffs.map((x) => x.key));
    expect([...ok].filter((k) => !current.has(k))).toEqual([]);
  });
});
