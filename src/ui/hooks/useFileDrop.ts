// ファイルのドラッグ＆ドロップ（.ktc.json の読み込み、R1.3）。

import { useCallback, useState, type DragEvent } from 'react';

export function useFileDrop(onFile: (file: File) => void) {
  const [dragging, setDragging] = useState(false);

  const onDragOver = useCallback((e: DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return { dragging, dropProps: { onDragOver, onDragLeave, onDrop } };
}
