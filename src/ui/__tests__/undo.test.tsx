import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../../App';
import { createProject, K_PRESET } from '../../domain/presets';
import { saveProject } from '../../storage/db';
import { useProjectStore } from '../../store/projectStore';
import { NumberField } from '../components/Field';
import { readNumber } from '../components/readNumber';

describe('数値欄', () => {
  it('readNumber：空・範囲外・小数を理由つきで断る', () => {
    expect(readNumber('', { required: true })).toEqual({ ok: false, reason: '空にはできません' });
    expect(readNumber('', {})).toEqual({ ok: true, value: undefined });
    expect(readNumber('-1', { min: 0 })).toMatchObject({ ok: false });
    expect(readNumber('1.5', { integer: true })).toMatchObject({ ok: false });
    expect(readNumber('abc', {})).toMatchObject({ ok: false, reason: '数字で入れてください' });
    expect(readNumber(' 0.4 ', { min: 0 })).toEqual({ ok: true, value: 0.4 });
  });

  it('読めない値は反映せず、理由を出し、欄を離れると元に戻す', () => {
    const onChange = vi.fn();
    function Harness() {
      const [v, setV] = useState<number | undefined>(0.4);
      return (
        <NumberField
          label="初速"
          value={v}
          min={0}
          required
          onChange={(n) => {
            onChange(n);
            setV(n);
          }}
        />
      );
    }
    render(<Harness />);
    const input = screen.getByLabelText('初速');
    fireEvent.change(input, { target: { value: '-3' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText(/0 以上の数を入れてください（今は 0.4 のままです）/),
    ).toBeInTheDocument();
    fireEvent.blur(input);
    expect(input).toHaveValue('0.4');
    expect(input).not.toHaveAttribute('aria-invalid');
    fireEvent.change(input, { target: { value: '１．２' } });
    expect(onChange).toHaveBeenLastCalledWith(1.2);
  });
});

describe('消す → 元に戻す', () => {
  it('種別を消すと、お知らせの「元に戻す」で戻る', async () => {
    const p = createProject(K_PRESET, '戻す試験');
    await saveProject(p);
    useProjectStore.getState().close();
    render(
      <MemoryRouter initialEntries={[`/p/${p.id}/edit/kinds`]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { level: 1, name: '編集' });
    const kinds = () => useProjectStore.getState().project!.kinds;
    const before = kinds().length;
    const first = kinds()[0]!;

    fireEvent.click(screen.getByRole('button', { name: `${first.name}を消す` }));
    expect(kinds()).toHaveLength(before - 1);
    const toast = screen
      .getByText(`種別「${first.name}」を消しました`)
      .closest<HTMLElement>('[role="status"]')!;
    expect(toast).not.toBeNull();

    act(() => fireEvent.click(within(toast).getByRole('button', { name: '元に戻す' })));
    expect(kinds()).toHaveLength(before);
    expect(kinds()[0]!.id).toBe(first.id);
    expect(toast).toHaveTextContent('元に戻しました');

    // Ctrl+Shift+Z でやり直せる
    act(() => void fireEvent.keyDown(document.body, { key: 'Z', ctrlKey: true, shiftKey: true }));
    expect(kinds()).toHaveLength(before - 1);
  });
});
