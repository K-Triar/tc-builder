import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from '../components/CopyButton';
import { ConfirmDialog } from '../components/Dialog';
import { Help } from '../components/Help';
import { Matrix } from '../components/Matrix';
import { Stepper } from '../components/Stepper';

afterEach(() => vi.useRealTimers());

describe('CopyButton', () => {
  it('コピーすると完了を表示し、2秒で戻る', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onCopied = vi.fn();
    render(<CopyButton text="/train reroute" describe="1行目をコピー" onCopied={onCopied} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '1行目をコピー' }));
    });
    expect(writeText).toHaveBeenCalledWith('/train reroute');
    expect(onCopied).toHaveBeenCalled();
    expect(screen.getByText('✓ コピーしました')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.getByText('コピー')).toBeInTheDocument();
  });
});

describe('Help', () => {
  it('？で説明が開き、Esc で閉じる', () => {
    render(<Help topic="tag" />);
    const button = screen.getByRole('button', { name: 'タグの説明' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(screen.getByRole('note')).toHaveTextContent('種別コード');
    expect(screen.getByRole('link', { name: '入門ガイドで詳しく見る' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('Matrix', () => {
  it('○/× を記号で示し、始発・終点は変えられない', () => {
    const onToggle = vi.fn();
    render(
      <Matrix
        caption="停車駅"
        rows={[
          { key: 'a', label: 'A' },
          { key: 'b', label: 'B' },
        ]}
        columns={[{ key: 'lo', label: '普通' }]}
        value={(r) => (r === 0 ? 'fixed' : false)}
        onToggle={onToggle}
        cellLabel={(r) => ['A', 'B'][r]! + ' 普通'}
      />,
    );
    const fixed = screen.getByRole('button', { name: /A 普通：停車/ });
    expect(fixed).toBeDisabled();
    expect(fixed).toHaveTextContent('○');
    const b = screen.getByRole('button', { name: 'B 普通：通過' });
    expect(b).toHaveTextContent('×');
    expect(b).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(b);
    expect(onToggle).toHaveBeenCalledWith(1, 0);
  });
});

describe('Stepper', () => {
  it('今のステップに aria-current', () => {
    const onSelect = vi.fn();
    render(<Stepper steps={['団体', '路線', '種別']} current={1} onSelect={onSelect} />);
    expect(screen.getByRole('button', { current: 'step' })).toHaveTextContent('路線');
    fireEvent.click(screen.getByRole('button', { name: /団体/ }));
    expect(onSelect).toHaveBeenCalledWith(0);
  });
});

describe('ConfirmDialog', () => {
  it('ブラウザの confirm を使わず、Esc でやめる', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="削除しますか？"
        confirmLabel="削除する"
        danger
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: '削除しますか？' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // 初期フォーカスは「やめる」
    expect(screen.getByRole('button', { name: 'やめる' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '削除する' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('閉じているときは何も出さない', () => {
    render(
      <ConfirmDialog
        open={false}
        title="x"
        confirmLabel="y"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
