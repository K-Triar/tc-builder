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
    expect(screen.getByRole('button', { name: '＋ 新しいプロジェクト' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'サンプル（瑠璃線系統）を開く' }),
    ).toBeInTheDocument();
  });

  it('新しいプロジェクトを K プリセットで作るとウィザードへ進む', async () => {
    renderAt('/');
    fireEvent.click(screen.getByRole('button', { name: '＋ 新しいプロジェクト' }));
    const dialog = screen.getByRole('dialog', { name: '新しいプロジェクト' });
    fireEvent.change(within(dialog).getByLabelText('プロジェクト名'), {
      target: { value: '試験線' },
    });
    expect(within(dialog).getByRole('radio', { name: /Kトライア/ })).toBeChecked();
    fireEvent.click(within(dialog).getByRole('button', { name: '作ってウィザードへ' }));
    expect(await screen.findByText('試験線')).toBeInTheDocument();
    const p = useProjectStore.getState().project!;
    expect(p.name).toBe('試験線');
    expect(p.lines.map((l) => l.code)).toEqual(['L', 'B', 'Q', 'U', 'Y']);
  });

  it('保存済みのプロジェクトが一覧に出る', async () => {
    await saveProject({ ...createSampleProject('listed', new Date()), name: '一覧テスト' });
    renderAt('/');
    expect(await screen.findByRole('link', { name: '一覧テスト' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '削除' }).length).toBeGreaterThan(0);
  });
});

describe('プロジェクト画面', () => {
  it('URL のプロジェクトを読み込み、ナビと検証パネルを出す', async () => {
    await saveProject(createSampleProject('sample-a', new Date()));
    renderAt('/p/sample-a/work/signs');
    expect(await screen.findByText('瑠璃線系統（サンプル）')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: '画面' });
    expect(within(nav).getByRole('link', { name: /作業/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '検証' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    // 書き出したことがないので強調される
    expect(screen.getByRole('button', { name: '● ファイルに書き出す' })).toBeInTheDocument();
  });

  it('ないプロジェクトは案内を出す', async () => {
    renderAt('/p/nothing/work/signs');
    expect(await screen.findByText('プロジェクトを開けませんでした')).toBeInTheDocument();
  });
});
