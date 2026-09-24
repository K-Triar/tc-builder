import { describe, expect, it } from 'vitest';
import { derive } from '../../domain/derive';
import type { Project } from '../../domain/model';
import { createProject, EMPTY_PRESET, K_PRESET } from '../../domain/presets';
import { listWorkItems, markDone } from '../../domain/progress';
import { createSampleProject } from '../../storage/sample';
import { journey, STAGES } from '../journey';

const NOW = new Date('2026-09-25T00:00:00.000Z');

function run(p: Project) {
  const derived = derive(p);
  const items = listWorkItems(p, derived);
  return { j: journey(p, derived, items), items };
}

const keyOf = (p: Project) => {
  const { j } = run(p);
  return j.stages[j.current]?.key;
};

describe('journey：路線ができるまでの道のり', () => {
  it('9つの段が路線図の順に並ぶ', () => {
    expect(STAGES.map((s) => s.label)).toEqual([
      '路線',
      '駅',
      'のりば',
      '列車',
      '自動生成',
      'コマンド',
      '看板',
      '試運転',
      '完成',
    ]);
  });

  it('K のプリセットで作った直後は「路線」が済み、次は駅の登録', () => {
    const p = createProject(K_PRESET, '新しい路線');
    const { j } = run(p);
    expect(j.stages[0]?.done).toBe(true);
    expect(keyOf(p)).toBe('stations');
    expect(j.next.path).toBe('setup/1');
  });

  it('空のプリセットでは「路線」から始める', () => {
    const p = createProject(EMPTY_PRESET, '新しい路線');
    expect(keyOf(p)).toBe('line');
  });

  it('名前のない駅があれば駅の段にとどまる', () => {
    const p = createSampleProject('s', NOW);
    p.stations[3]!.name = '';
    const { j } = run(p);
    expect(j.stages[1]?.done).toBe(false);
    expect(j.next.title).toContain('名前のない駅');
  });

  it('向きの決まっていないのりばがあれば、その駅を名指しして開く', () => {
    const p = createSampleProject('s', NOW);
    const st = p.stations.find((s) => s.managerOrgId === p.selfOrgId)!;
    delete st.platforms[0]!.dir;
    const { j } = run(p);
    expect(j.stages[j.current]?.key).toBe('platforms');
    expect(j.next.title).toBe(`${st.name} ののりばの向きを決める`);
    expect(j.next.path).toBe(`setup/2?station=${encodeURIComponent(st.id)}`);
  });

  it('サンプルは入力がそろっていて、次はコマンドを打つ', () => {
    const p = createSampleProject('s', NOW);
    const { j } = run(p);
    expect(j.stages.slice(0, 5).every((s) => s.done)).toBe(true);
    expect(j.next.stage).toBe('commands');
    expect(j.next.path).toBe('work/commands');
    expect(j.stages[5]?.count?.done).toBe(0);
    expect(j.work.total).toBeGreaterThan(0);
  });

  it('コマンドをすべて済ませると、次は最初ののりばの看板', () => {
    const p = createSampleProject('s', NOW);
    const { items } = run(p);
    for (const item of items.filter((i) => i.category === 'command')) {
      p.progress = markDone(p.progress, item, NOW);
    }
    const { j } = run(p);
    expect(j.next.stage).toBe('signs');
    expect(j.next.title).toMatch(/番のりばに看板を置く$/);
    expect(j.next.path).toMatch(/^work\/signs\?station=/);
  });

  it('すべての作業が済むと完成', () => {
    const p = createSampleProject('s', NOW);
    const { items } = run(p);
    for (const item of items) p.progress = markDone(p.progress, item, NOW);
    const { j } = run(p);
    expect(j.stages.every((s) => s.done)).toBe(true);
    expect(j.next.stage).toBe('done');
    expect(j.current).toBe(STAGES.length - 1);
    expect(j.work.done).toBe(j.work.total);
  });
});
