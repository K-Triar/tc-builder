import 'fake-indexeddb/auto';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from './App';
import { saveProject } from './storage/db';
import { createSampleProject } from './storage/sample';
import { useProjectStore } from './store/projectStore';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

beforeEach(() => useProjectStore.getState().close());

describe('ホーム', () => {
  it('見出しと、はじめるボタン', async () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('KT式 TC ビルダー');
    expect(screen.getByRole('button', { name: '＋ 新しい路線をつくる' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '完成例（瑠璃線系統）を見る' })).toBeInTheDocument();
  });

  it('新しいプロジェクトを K プリセットで作るとウィザードへ進む', async () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: '＋ 新しい路線をつくる' }));
    const dialog = screen.getByRole('dialog', { name: '新しい路線をつくる' });
    fireEvent.change(within(dialog).getByLabelText('路線の名前'), {
      target: { value: '試験線' },
    });
    expect(within(dialog).getByRole('radio', { name: /Kトライア/ })).toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: 'つくって始める' }));
    expect(await screen.findByText('試験線')).toBeInTheDocument();
    const p = useProjectStore.getState().project!;
    expect(p.name).toBe('試験線');
    expect(p.lines.map((l) => l.code)).toEqual(['L', 'B', 'Q', 'U', 'Y']);
  });

  it('保存済みのプロジェクトが一覧に出る', async () => {
    await saveProject({ ...createSampleProject('listed', new Date()), name: '一覧テスト' });
    renderAt('/');
    expect(await screen.findByRole('link', { name: '一覧テスト' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '一覧テストを消す' })).toBeInTheDocument();
  });
});

describe('プロジェクト画面', () => {
  it('URL のプロジェクトを読み込み、ナビと検証パネルを出す', async () => {
    await saveProject(createSampleProject('sample-a', new Date()));
    renderAt('/p/sample-a/work/signs');
    expect(await screen.findByText('瑠璃線系統（サンプル）')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: '画面' });
    for (const name of ['いまここ', '質問に答える', '設置する', '詳しく編集', '資料']) {
      expect(within(nav).getByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
    }
    expect(screen.getByRole('heading', { name: '入力のチェック' })).toBeInTheDocument();
    // 書き出したことがないので強調される
    expect(screen.getByRole('button', { name: '● ファイルに書き出す' })).toBeInTheDocument();
  });

  it('開くと「いまここ」：路線図の進み具合と、次にやること', async () => {
    await saveProject(createSampleProject('sample-b', new Date()));
    renderAt('/p/sample-b');
    expect(
      await screen.findByRole('heading', { level: 1, name: /経路と編成を登録する/ }),
    ).toBeInTheDocument();
    const route = screen.getByRole('navigation', { name: '路線ができるまで' });
    expect(within(route).getAllByRole('link')).toHaveLength(9);
    expect(within(route).getByRole('link', { name: /コマンド（次にやる）/ })).toBeInTheDocument();
    const next = screen.getByRole('heading', { level: 1 }).closest('section')!;
    expect(within(next).getByRole('link', { name: 'コマンドを打つ' })).toHaveAttribute(
      'href',
      '/p/sample-b/work/commands',
    );
  });

  it('ないプロジェクトは案内を出す', async () => {
    renderAt('/p/nothing/work/signs');
    expect(await screen.findByText('プロジェクトを開けませんでした')).toBeInTheDocument();
  });
});
