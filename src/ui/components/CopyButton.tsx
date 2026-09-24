import { useEffect, useRef, useState } from 'react';
import { copyText } from '../clipboard';
import { Button, type ButtonProps } from './Button';

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick'> {
  text: string;
  /** 画面に出す名前（既定「コピー」） */
  label?: string;
  /** 読み上げ用の説明（例「1行目をコピー」） */
  describe?: string;
  onCopied?: () => void;
}

export function CopyButton({
  text,
  label = 'コピー',
  describe,
  onCopied,
  size = 'sm',
  ...rest
}: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    const ok = await copyText(text);
    setState(ok ? 'done' : 'failed');
    if (ok) onCopied?.();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  };

  const shown =
    state === 'done' ? '✓ コピーしました' : state === 'failed' ? 'コピーできません' : label;
  return (
    <Button size={size} onClick={() => void onClick()} aria-label={describe} {...rest}>
      <span aria-live="polite">{shown}</span>
    </Button>
  );
}
