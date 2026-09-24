import { Link, NavLink, useParams } from 'react-router';
import { KindEditor } from '../editors/KindEditor';
import { LineEditor, OrgEditor, SettingsEditor } from '../editors/OrgEditor';
import { ReviewEditor } from '../editors/ReviewEditor';
import { ServiceEditor } from '../editors/ServiceEditor';
import { StationEditor } from '../editors/StationEditor';
import { useProject } from '../hooks/useDerived';
import { TabNav } from './TabNav';
import styles from './EditPage.module.css';

const TABS = [
  { key: 'org', label: '鉄道会社・路線・数値' },
  { key: 'kinds', label: '列車の種類' },
  { key: 'stations', label: '駅とのりば' },
  { key: 'services', label: '系統' },
  { key: 'review', label: '自動推定の上書き' },
] as const;

/** 詳しく編集（上級者向け。すべての項目を表の形で直す、design §6.1） */
export function EditPage() {
  const project = useProject();
  const tab = useParams().tab ?? 'org';
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>詳しく編集</h1>
        <p className={styles.lead}>
          コードや数値を含むすべての項目を直接直せます。はじめての方は
          <Link to={`/p/${project.id}/setup/0`}>質問に答える画面</Link>のほうが簡単です。
        </p>
      </header>
      <TabNav base={`/p/${project.id}/edit`} tabs={TABS} label="編集する項目" />
      {tab === 'org' && (
        <>
          <OrgEditor />
          <LineEditor />
          <SettingsEditor />
        </>
      )}
      {tab === 'kinds' && <KindEditor />}
      {tab === 'stations' && <StationEditor part="all" />}
      {tab === 'services' && <ServiceEditor />}
      {tab === 'review' && <ReviewEditor />}
      {!TABS.some((t) => t.key === tab) && (
        <p>
          <NavLink to={`/p/${project.id}/edit/org`}>鉄道会社・路線へ</NavLink>
        </p>
      )}
    </div>
  );
}
