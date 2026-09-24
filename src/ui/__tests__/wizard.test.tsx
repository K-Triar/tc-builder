import 'fake-indexeddb/auto';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../../App';
import { derive } from '../../domain/derive';
import { createProject, K_PRESET } from '../../domain/presets';
import { saveProject } from '../../storage/db';
import { useProjectStore } from '../../store/projectStore';

const state = () => useProjectStore.getState().project!;

async function openAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1 });
}

describe('質問に答えて小さな架空路線を作る（3駅・2種別）', () => {
  it('駅 → のりば → 系統 → 停車駅 で、看板とコマンドの元が出る', async () => {
    const p = createProject(K_PRESET, '試験線');
    await saveProject(p);
    useProjectStore.getState().close();
    await openAt(`/p/${p.id}/setup/1`);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('駅を登録する');

    // 駅：一覧を貼り付けてまとめて足す（駅名だけなら駅コードは自動）
    fireEvent.click(screen.getByRole('button', { name: '＋ 駅の一覧を貼り付けてまとめて足す' }));
    fireEvent.change(screen.getByLabelText('駅の一覧'), {
      target: { value: 'A駅\nB駅 KL02\nC駅' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'まとめて足す' }));
    expect(state().stations.map((s) => s.name)).toEqual(['A駅', 'B駅', 'C駅']);
    expect(state().stations.map((s) => s.codes[0]!.code)).toMatchObject([
      { kind: 'numbered', number: 1 },
      { kind: 'numbered', number: 2 },
      { kind: 'numbered', number: 3 },
    ]);

    // 駅名は路線図の上の欄で直せる
    fireEvent.change(screen.getByLabelText('2番目の駅の名前'), { target: { value: 'B駅' } });

    // のりば：1駅ずつ進む向きを選ぶ。次へは次の駅へ、最後の駅から次の段へ
    fireEvent.click(screen.getByRole('button', { name: '次へ：のりば →' }));
    await screen.findByRole('heading', { level: 1, name: 'のりばを設定する' });
    for (const next of ['次の駅：B駅 →', '次の駅：C駅 →', null]) {
      fireEvent.click(screen.getByRole('radio', { name: /左から右へ/ }));
      if (next) fireEvent.click(screen.getByRole('button', { name: next }));
    }
    expect(state().stations.every((s) => s.platforms[0]!.dir === 'right')).toBe(true);

    // 列車の走り方：駅を順に足し、種別を載せる
    fireEvent.click(screen.getByRole('button', { name: '次へ：列車 →' }));
    await screen.findByRole('heading', { level: 1, name: '列車の走り方を決める' });
    fireEvent.click(screen.getByRole('button', { name: '＋ 系統を足す' }));
    fireEvent.change(screen.getByLabelText('系統名'), { target: { value: '下り C駅行' } });
    for (const name of ['A駅', 'B駅', 'C駅']) {
      fireEvent.change(screen.getByLabelText('駅を最後に足す'), {
        target: { value: state().stations.find((s) => s.name === name)!.id },
      });
      fireEvent.click(screen.getByRole('button', { name: '足す' }));
    }
    expect(state().services[0]!.entries.map((e) => e.platform)).toEqual([1, 1, 1]);
    for (const kind of ['普通', '快速']) {
      const select = screen.getByLabelText('種別を載せる');
      const option = within(select).getByRole('option', { name: new RegExp(`^${kind}`) });
      fireEvent.change(select, { target: { value: (option as HTMLOptionElement).value } });
      fireEvent.click(screen.getByRole('button', { name: '載せる' }));
    }

    // 停車駅：快速は B駅を通過
    fireEvent.click(screen.getByRole('button', { name: 'B駅 1番 快速：停車' }));
    expect(state().services[0]!.kinds[1]!.stops).toEqual([true, false, true]);

    const d = derive(state());
    expect(d.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(d.formations.map((f) => f.code)).toEqual(['K300_KL3_Lo', 'K300_KL3_Ra']);
    const b = d.platformCards.find((c) => c.destCode === 'KL02-1')!;
    expect(b.pattern).toBe('B');
    expect(b.signs[0]!.lines).toEqual(['[+train]', 'skip 0 2', '!t@Lo', '']);

    // 反対方向を作る：のりばは要入力になる
    fireEvent.click(screen.getByRole('button', { name: '⇄ 反対方向を作る' }));
    const up = state().services[1]!;
    expect(up.direction).toBe('up');
    expect(up.kinds.map((k) => k.formation)).toEqual(['K301', 'K301']);
    expect(up.entries.every((e) => e.platform === null)).toBe(true);
  });

  it('自動生成の段で「経路に入れる駅」を上書きできる', async () => {
    const p = createProject(K_PRESET, '試験線');
    p.stations = [0, 1].map((i) => ({
      id: `s${i}`,
      name: `駅${i}`,
      managerOrgId: p.selfOrgId,
      signsBySelf: true,
      codes: [
        {
          id: `c${i}`,
          code: { kind: 'numbered', orgId: p.selfOrgId, lineId: p.lines[0]!.id, number: i + 1 },
        },
      ],
      platforms: [{ number: 1, codeId: `c${i}`, dir: 'right', deadEnd: false }],
    }));
    p.services = [
      {
        id: 'v',
        name: 'v',
        direction: 'down',
        entries: [
          { stationId: 's0', platform: 1 },
          { stationId: 's1', platform: 1 },
        ],
        kinds: [],
      },
    ];
    await saveProject(p);
    useProjectStore.getState().close();
    await openAt(`/p/${p.id}/setup/4`);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('設定を自動でつくる');
    const select = screen.getByLabelText('駅1 1番を経路に');
    expect(select).toHaveValue('auto');
    fireEvent.change(select, { target: { value: 'exclude' } });
    expect(state().overrides.choice).toEqual({ 's1#1': 'exclude' });
    fireEvent.change(select, { target: { value: 'auto' } });
    expect(state().overrides.choice).toEqual({});
  });
});
