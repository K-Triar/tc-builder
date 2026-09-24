import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRoutes } from '../../App';
import { derive } from '../../domain/derive';
import { saveProject } from '../../storage/db';
import { createSampleProject } from '../../storage/sample';
import { useProjectStore } from '../../store/projectStore';
import { routesTable, toTsv } from '../docs/tables';

const writeText = vi.fn(async (text: string) => void text);

beforeEach(async () => {
  writeText.mockClear();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  useProjectStore.getState().close();
  await saveProject(createSampleProject('out', new Date('2026-09-24T00:00:00.000Z')));
});

async function openAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1 });
}

describe('駅の看板カード（8.1・8.2）', () => {
  it('オット 1番：B パターンの看板、図、ボタン、チェック', async () => {
    await openAt('/p/out/work/signs?station=st-KL02');
    const card = screen.getByRole('article', { name: 'オット 1番のりば' });
    expect(within(card).getAllByText('KL02-1').length).toBeGreaterThan(0);
    expect(within(card).getByText('B：通過列車があるのりば')).toBeInTheDocument();
    expect(within(card).getByText('!t@Lo')).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: /ホームから見た図/ })).toBeInTheDocument();

    // 行ごとのコピー
    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: '1枚目の3行目「!t@Lo」をコピー' }));
    });
    expect(writeText).toHaveBeenCalledWith('!t@Lo');

    // 設置した → 看板の中身が変わると要更新
    fireEvent.click(within(card).getByLabelText('設置した'));
    expect(within(card).getByLabelText('設置した')).toBeChecked();
    act(() => useProjectStore.getState().update((p) => void (p.settings.stationDwellSeconds = 8)));
    expect(within(card).getByLabelText('設置した')).not.toBeChecked();
    expect(within(card).getByText(/要更新/)).toBeInTheDocument();
  });

  it('駅ごとの C と switcher の指示、他団体の駅', async () => {
    await openAt('/p/out/work/signs');
    const kl05 = screen.getByRole('region', { name: 'セナポンタウン（KL05）' });
    expect(within(kl05).getAllByText(/C 空車削除/).length).toBeGreaterThan(0);
    expect(within(kl05).getByRole('heading', { name: /switcher（ポイント）/ })).toBeInTheDocument();
    const nsc = screen.getByRole('region', { name: /西水中央/ });
    expect(within(nsc).getByText('相手団体の設定に従う')).toBeInTheDocument();
  });

  it('エラーがあるときは出力を止める', async () => {
    const p = createSampleProject('broken', new Date());
    delete p.stations[1]!.platforms[0]!.dir;
    await saveProject(p);
    await openAt('/p/broken/work/signs');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('出していません');
    // 直すべきエラーがその場に並び、入力へ飛べる
    expect(within(alert).getByRole('link', { name: /進む向きが未入力/ })).toBeInTheDocument();
  });
});

describe('コマンド（8.3）', () => {
  it('1行ずつモードで順にコピーする', async () => {
    await openAt('/p/out/work/commands');
    const first = derive(useProjectStore.getState().project!).commandPlan.groups[1]!.blocks[0]!;
    fireEvent.click(screen.getByRole('button', { name: '▶ 次の行をコピー（1行ずつモード）' }));
    const bar = screen.getByRole('region', { name: '1行ずつコピー' });
    expect(bar).toHaveTextContent(`1/`);
    expect(bar).toHaveTextContent(first.lines[0]!);
    await act(async () => {
      fireEvent.click(within(bar).getByRole('button', { name: 'コピーして次へ' }));
    });
    expect(writeText).toHaveBeenCalledWith(first.lines[0]);
    expect(bar).toHaveTextContent(first.lines[1]!);
  });

  it('ブロックごとに「実行した」を付けられる', async () => {
    await openAt('/p/out/work/commands');
    const checks = screen.getAllByLabelText('実行した');
    fireEvent.click(checks[1]!);
    const items = useProjectStore.getState().project!.progress.items;
    expect(Object.keys(items)).toEqual(['command:route:KL1L13']);
  });
});

describe('資料（8.5）', () => {
  it('TSV はタブ区切り、セル内のタブと改行は空白', () => {
    expect(toTsv({ headers: ['a', 'b'], rows: [['x\ty', 'z\nw']] })).toBe('a\tb\nx y\tz w');
  });

  it('経路一覧の表と TSV コピー', async () => {
    await openAt('/p/out/docs/routes');
    const d = derive(useProjectStore.getState().project!);
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(d.routes.length + 1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '経路一覧をタブ区切りでコピー' }));
    });
    expect(writeText).toHaveBeenCalledWith(toTsv(routesTable(d)));
  });
});

describe('検証パネル（8.6）', () => {
  it('該当する入力へのリンク', async () => {
    const p = createSampleProject('broken2', new Date());
    delete p.stations[2]!.platforms[0]!.dir;
    await saveProject(p);
    await openAt('/p/broken2/work/signs');
    const panel = screen.getByRole('complementary', { name: '検証結果' });
    const link = within(panel).getByRole('link', { name: /オット 1番 の進む向きが未入力/ });
    expect(link).toHaveAttribute('href', '/p/broken2/edit/stations?station=st-KL02&platform=1');
    fireEvent.click(link);
    expect(await screen.findByRole('heading', { level: 1, name: '編集' })).toBeInTheDocument();
  });
});
