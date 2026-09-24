import type { ReactNode } from 'react';

/** 「詳しい設定」の開閉（初心者がふだん見なくてよいもの） */
export function Disclosure({
  summary,
  children,
  open,
  className,
}: {
  summary: ReactNode;
  children: ReactNode;
  /** 最初から開いておく */
  open?: boolean;
  className?: string;
}) {
  return (
    <details className={`disclosure ${className ?? ''}`} open={open}>
      <summary>{summary}</summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
