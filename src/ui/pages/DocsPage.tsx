import { useParams } from 'react-router';
import { Button } from '../components/Button';
import { CopyButton } from '../components/CopyButton';
import {
  departuresTable,
  formationsTable,
  routesTable,
  stopTables,
  toTsv,
  type Table,
} from '../docs/tables';
import { useDerived, useProject } from '../hooks/useDerived';
import { TabNav } from './TabNav';
import styles from './DocsPage.module.css';

const TABS = [
  { key: 'routes', label: '経路一覧' },
  { key: 'formations', label: '編成一覧' },
  { key: 'departures', label: '各駅発' },
  { key: 'stops', label: '停車駅表' },
] as const;

/** 資料（R8）：4つの表。印刷用レイアウトと TSV コピー */
export function DocsPage() {
  const project = useProject();
  const { derived } = useDerived();
  const tab = useParams().tab ?? 'routes';
  const tables: Table[] =
    tab === 'routes'
      ? [routesTable(derived)]
      : tab === 'formations'
        ? [formationsTable(derived)]
        : tab === 'departures'
          ? [departuresTable(project, derived)]
          : stopTables(project, derived);

  return (
    <div>
      <h1 className="no-print">資料</h1>
      <TabNav base={`/p/${project.id}/docs`} tabs={TABS} label="資料の種類" />
      <div className={`row no-print ${styles.toolbar}`}>
        <Button onClick={() => window.print()}>印刷する</Button>
        {tables.length > 1 && (
          <CopyButton
            size="md"
            text={tables.map((t) => `${t.title}\n${toTsv(t)}`).join('\n\n')}
            label="すべて表計算用にコピー"
          />
        )}
      </div>
      <p className={styles.printTitle}>{project.name}</p>
      {tables.map((t) => (
        <DocTable key={t.title} table={t} />
      ))}
    </div>
  );
}

function DocTable({ table }: { table: Table }) {
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{table.title}</h2>
        <CopyButton
          text={toTsv(table)}
          label="表計算用にコピー（TSV）"
          describe={`${table.title}をタブ区切りでコピー`}
          className="no-print"
        />
      </div>
      <div
        className={styles.wrap}
        tabIndex={0}
        role="region"
        aria-label={`${table.title}（横にスクロールできます）`}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              {table.headers.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) =>
                  j === 0 ? (
                    <th key={j} scope="row">
                      {c}
                    </th>
                  ) : (
                    <td key={j} className={c === '通過' ? styles.pass : undefined}>
                      {c}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted text-xs">{table.rows.length} 行</p>
    </section>
  );
}
