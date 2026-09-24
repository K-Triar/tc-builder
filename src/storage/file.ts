// ファイルへの書き出し・読み込み（design §7）。

import type { Project } from '../domain/model';
import { parseProject, serializeProject, type ParseResult } from '../domain/schema';

/** 最後にファイルへ書き出してから変更があるか（R1.5） */
export function hasUnexportedChanges(p: Pick<Project, 'updatedAt' | 'lastExportedAt'>): boolean {
  return !p.lastExportedAt || p.updatedAt > p.lastExportedAt;
}

/** ファイル名に使えない文字を置き換える */
export function exportFileName(p: Pick<Project, 'name'>): string {
  const unsafe = '\\/:*?"<>|';
  const base =
    [...p.name]
      .map((ch) => (ch < ' ' || unsafe.includes(ch) ? '_' : ch))
      .join('')
      .trim() || 'project';
  return `${base}.ktc.json`;
}

/** 書き出す中身（lastExportedAt を付けた Project と、その JSON） */
export function prepareExport(p: Project, now: Date): { project: Project; text: string } {
  const project = { ...p, lastExportedAt: now.toISOString() };
  return { project, text: serializeProject(project) };
}

interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

/**
 * ファイルに保存する。showSaveFilePicker があれば使い、なければダウンロードさせる。
 * ユーザーが保存を取り消したら false。
 */
export async function saveTextFile(text: string, fileName: string): Promise<boolean> {
  const blob = new Blob([text], { type: 'application/json' });
  const w = window as unknown as SaveFilePickerWindow;
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'KT式 TC ビルダーのプロジェクト',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
      // 使えない環境（iframe など）はダウンロードに切り替える
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function readProjectFile(file: Blob): Promise<ParseResult> {
  return parseProject(await file.text());
}

/** 同じ ID のプロジェクトがあるとき「別名で開く」ための複製 */
export function asCopy(p: Project, newId: string, now: Date): Project {
  const t = now.toISOString();
  const { lastExportedAt: _dropped, ...rest } = p;
  void _dropped;
  return { ...rest, id: newId, name: `${p.name}（コピー）`, createdAt: t, updatedAt: t };
}
