// 「サンプルを開く」：同梱の瑠璃線系統を新しいプロジェクトとして複製する（R1.6）。

import type { Project } from '../domain/model';
import { parseProject } from '../domain/schema';
import sample from '../fixtures/ruri/project.ktc.json';

export function createSampleProject(newId: string, now: Date): Project {
  const r = parseProject(sample);
  if (!r.ok) throw new Error(`サンプルを読めませんでした：${r.errors.join(' / ')}`);
  const t = now.toISOString();
  const { lastExportedAt: _dropped, ...rest } = r.project;
  void _dropped;
  return { ...rest, id: newId, createdAt: t, updatedAt: t, progress: { items: {} } };
}
