import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { companyByCode, createProject } from '../../domain/presets';
import { useProjectStore } from '../../store/projectStore';
import { useFileDrop } from '../../ui/hooks/useFileDrop';
import { startAutosave } from '../autosave';

describe('ストアの自動保存', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('変更から 500ms 後に保存し、止めるときは残りをすぐ保存する', async () => {
    const save = vi.fn(async () => {});
    const stop = startAutosave(save, 500);
    const store = useProjectStore.getState();
    store.open(createProject(companyByCode('K'), 'x'));
    store.update((p) => void (p.name = 'y'));
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'y' }));

    store.update((p) => void (p.name = 'z'));
    await stop();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'z' }));
    store.close();
  });
});

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const { dragging, dropProps } = useFileDrop(onFile);
  return (
    <div data-testid="zone" {...dropProps}>
      {dragging ? 'ここに離す' : '待機'}
    </div>
  );
}

describe('useFileDrop', () => {
  it('ファイルを落とすと受け取る', () => {
    const onFile = vi.fn();
    render(<DropZone onFile={onFile} />);
    const zone = screen.getByTestId('zone');
    const file = new File(['{}'], 'a.ktc.json');
    fireEvent.dragOver(zone, { dataTransfer: { types: ['Files'], files: [file] } });
    expect(zone.textContent).toBe('ここに離す');
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
    expect(zone.textContent).toBe('待機');
  });
});
