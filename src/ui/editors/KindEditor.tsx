import { kindTag } from '../../domain/codes';
import { useProjectStore } from '../../store/projectStore';
import { Button } from '../components/Button';
import { Section, TextField } from '../components/Field';
import { RemoveButton } from '../components/RemoveButton';
import { useProject } from '../hooks/useDerived';
import { removeWithUndo } from '../toast';
import { must, newId } from './common';
import styles from './editors.module.css';

/** ウィザード 3：種別（種別コード＋列車名コード。タグは自動） */
export function KindEditor() {
  const project = useProject();
  const update = useProjectStore((s) => s.update);
  const used = new Set(project.services.flatMap((s) => s.kinds.map((k) => k.kindId)));
  return (
    <Section
      title="種別"
      help="kindCode"
      lead="使う種別を登録します。並び順は、のりばに spawn 看板を並べる順になります。"
      actions={
        <Button
          size="sm"
          onClick={() =>
            update((p) => void p.kinds.push({ id: newId(), typeCode: '', name: '' }), {
              checkpoint: true,
            })
          }
        >
          ＋ 種別を足す
        </Button>
      }
    >
      <ul className={styles.rows}>
        {project.kinds.map((k, i) => (
          <li key={k.id} className={styles.rowItem}>
            <TextField
              label="種別コード"
              mono
              value={k.typeCode}
              placeholder="Lo"
              onChange={(v) => update((p) => void (must(p.kinds[i]).typeCode = v))}
            />
            <TextField
              label="列車名コード（任意）"
              mono
              value={k.trainNameCode ?? ''}
              placeholder="LSR"
              onChange={(v) =>
                update((p) => {
                  const kind = must(p.kinds[i]);
                  if (v) kind.trainNameCode = v;
                  else delete kind.trainNameCode;
                })
              }
            />
            <TextField
              label="表示名"
              value={k.name}
              placeholder="特別快速"
              onChange={(v) => update((p) => void (must(p.kinds[i]).name = v))}
            />
            <div className={styles.tagBox}>
              <span className="muted text-xs">タグ（自動）</span>
              <span className={styles.tag}>{kindTag(k) || '—'}</span>
            </div>
            <div className="row">
              <Button
                size="sm"
                aria-label={`${k.name || kindTag(k)}を上へ`}
                disabled={i === 0}
                onClick={() =>
                  update((p) => void p.kinds.splice(i - 1, 0, ...p.kinds.splice(i, 1)), {
                    checkpoint: true,
                  })
                }
              >
                {'↑︎'}
              </Button>
              <Button
                size="sm"
                aria-label={`${k.name || kindTag(k)}を下へ`}
                disabled={i === project.kinds.length - 1}
                onClick={() =>
                  update((p) => void p.kinds.splice(i + 1, 0, ...p.kinds.splice(i, 1)), {
                    checkpoint: true,
                  })
                }
              >
                {'↓︎'}
              </Button>
              <RemoveButton
                describe={`${k.name || kindTag(k) || '種別'}を消す`}
                blocked={used.has(k.id) && '列車の走り方で使用中'}
                onRemove={() =>
                  removeWithUndo(
                    `種別「${k.name || kindTag(k)}」を消しました`,
                    (p) => void (p.kinds = p.kinds.filter((x) => x.id !== k.id)),
                  )
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
