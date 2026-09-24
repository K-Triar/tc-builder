import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { companyByCode, createProject } from '../../domain/presets';
import { COALESCE_MS, HISTORY_LIMIT, now, useProjectStore } from '../projectStore';

let t = Date.parse('2026-09-25T00:00:00.000Z');
const realNow = now.current;
const tick = (ms: number) => (t += ms);
const store = () => useProjectStore.getState();
const name = () => store().project!.name;

beforeEach(() => {
  now.current = () => new Date(t);
  store().open(createProject(companyByCode('K'), 'a'));
});

afterEach(() => {
  now.current = realNow;
  store().close();
});

describe('元に戻す／やり直す', () => {
  it('区切りごとに戻り、やり直せる', () => {
    store().update((p) => void (p.name = 'b'), { checkpoint: true });
    tick(10);
    store().update((p) => void (p.name = 'c'), { checkpoint: true });
    expect(store().undo()).toBe(true);
    expect(name()).toBe('b');
    expect(store().undo()).toBe(true);
    expect(name()).toBe('a');
    expect(store().undo()).toBe(false);
    expect(store().redo()).toBe(true);
    expect(name()).toBe('b');
  });

  it('続けて打った文字は1回で戻る。間が空けば別の区切り', () => {
    store().update((p) => void (p.name = 'x'));
    tick(100);
    store().update((p) => void (p.name = 'xy'));
    tick(100);
    store().update((p) => void (p.name = 'xyz'));
    tick(COALESCE_MS + 1);
    store().update((p) => void (p.name = 'xyz!'));
    store().undo();
    expect(name()).toBe('xyz');
    store().undo();
    expect(name()).toBe('a');
  });

  it('新しい変更をするとやり直しは消える', () => {
    store().update((p) => void (p.name = 'b'), { checkpoint: true });
    store().undo();
    store().update((p) => void (p.name = 'c'), { checkpoint: true });
    expect(store().redo()).toBe(false);
    expect(name()).toBe('c');
  });

  it('戻しても書き出し日時は今のまま、更新日時は進む', () => {
    store().update((p) => void (p.name = 'b'), { checkpoint: true });
    tick(1000);
    useProjectStore.setState((s) => void (s.project!.lastExportedAt = new Date(t).toISOString()));
    tick(1000);
    store().undo();
    expect(name()).toBe('a');
    expect(store().project!.lastExportedAt).toBe(new Date(t - 1000).toISOString());
    expect(store().project!.updatedAt).toBe(new Date(t).toISOString());
  });

  it(`履歴は ${HISTORY_LIMIT} 件まで`, () => {
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      store().update((p) => void (p.name = `n${i}`), { checkpoint: true });
    }
    expect(store().past).toHaveLength(HISTORY_LIMIT);
  });

  it('集中モードの状態は履歴に残さず、終えた集中モードは元に戻しても復活しない', () => {
    store().open({ ...createProject(companyByCode('K'), 'a'), guide: { at: 'name' } });
    const updatedAt = store().project!.updatedAt;
    tick(1000);
    store().setGuide((g) => ({ ...g, at: 'company' }));
    expect(store().project!.guide).toEqual({ at: 'company' });
    expect(store().past).toHaveLength(0);
    expect(store().project!.updatedAt).toBe(updatedAt);

    store().update((p) => void (p.name = 'b'), { checkpoint: true });
    store().setGuide(() => undefined);
    store().undo();
    expect(name()).toBe('a');
    expect(store().project!.guide).toBeUndefined();
  });

  it('開き直すと履歴は消える', () => {
    store().update((p) => void (p.name = 'b'), { checkpoint: true });
    store().open(createProject(companyByCode('K'), 'z'));
    expect(store().undo()).toBe(false);
  });
});
