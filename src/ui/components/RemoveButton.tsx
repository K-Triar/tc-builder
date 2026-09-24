import { useId, type ReactNode } from 'react';
import { Button } from './Button';

export interface RemoveButtonProps {
  onRemove: () => void;
  /** 消せない理由（短く。例「系統で使用中」）。あればボタンを押せなくし、理由を横に出す */
  blocked?: string | false | null;
  /** 読み上げ名（例「オットを消す」） */
  describe?: string;
  children?: ReactNode;
}

/** 一覧の行の「消す」。消した後は「元に戻す」で戻せるので、確認は出さない */
export function RemoveButton({
  onRemove,
  blocked,
  describe,
  children = '消す',
}: RemoveButtonProps) {
  const id = useId();
  return (
    <span className="remove">
      <Button
        size="sm"
        variant="dangerQuiet"
        disabled={!!blocked}
        aria-label={describe}
        aria-describedby={blocked ? id : undefined}
        onClick={onRemove}
      >
        {children}
      </Button>
      {blocked && (
        <span id={id} className="remove-reason">
          {blocked}
        </span>
      )}
    </span>
  );
}
