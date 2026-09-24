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
  await screen.findByRole('heading', { level: 1, name: /ウィザード|編集/ });
}

describe('ウィザードで小さな架空路線を作る（3駅・2種別）', () => {
  it('駅 → のりば → 系統 → 停車駅 で、看板とコマンドの元が出る', async () => {
    const p = createProject(K_PRESET, '試験線');
    await saveProject(p);
    useProjectStore.getState().close();
    await openAt(`/p/${p.id}/setup/3`);

    // 駅：一覧を貼り付けてまとめて足す
    fireEvent.change(screen.getByLabelText('駅の一覧'), {
      target: { value: 'A駅 KL01\nB駅 KL02\nC駅 KL03' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'まとめて足す' }));
    expect(state().stations.map((s) => s.name)).toEqual(['A駅', 'B駅', 'C駅']);
    expect(state().stations[1]!.codes[0]!.code).toMatchObject({ kind: 'numbered', number: 2 });

    // のりば：進む向きを選ぶ
    fireEvent.click(screen.getByRole('button', { name: '次へ →' }));
    await screen.findByRole('heading', { level: 1, name: 'ウィザード：のりば' });
    for (const radio of screen.getAllByRole('radio', { name: /左から右へ/ }))
      fireEvent.click(radio);
    expect(state().stations.every((s) => s.platforms[0]!.dir === 'right')).toBe(true);

    // 系統：駅を順に足し、種別を載せる
    fireEvent.click(screen.getByRole('button', { name: '次へ →' }));
    await screen.findByRole('heading', { level: 1, name: 'ウィザード：系統' });
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
    // 画面操作が多いので、全体をまとめて走らせたときに備えて長めに待つ
  }, 20_000);

  it('確認のステップで「経路に入れる駅」を上書きできる', async () => {
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
    await openAt(`/p/${p.id}/setup/6`);
    const select = screen.getByLabelText('駅1 1番を経路に');
    expect(select).toHaveValue('auto');
    fireEvent.change(select, { target: { value: 'exclude' } });
    expect(state().overrides.choice).toEqual({ 's1#1': 'exclude' });
    fireEvent.change(select, { target: { value: 'auto' } });
    expect(state().overrides.choice).toEqual({});
  });
});
