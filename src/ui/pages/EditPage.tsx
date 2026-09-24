import { NavLink, useParams } from 'react-router';
import { KindEditor } from '../editors/KindEditor';
import { LineEditor, OrgEditor, SettingsEditor } from '../editors/OrgEditor';
import { ServiceEditor } from '../editors/ServiceEditor';
import { StationEditor } from '../editors/StationEditor';
import { useProject } from '../hooks/useDerived';
import { TabNav } from './TabNav';

const TABS = [
  { key: 'org', label: '団体・路線' },
  { key: 'kinds', label: '種別' },
  { key: 'stations', label: '駅とのりば' },
  { key: 'services', label: '系統' },
] as const;

/** 編集画面（表形式でまとめて直す、design §6.1） */
export function EditPage() {
  const project = useProject();
  const tab = useParams().tab ?? 'org';
  return (
    <div>
      <h1>編集</h1>
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
      {!TABS.some((t) => t.key === tab) && (
        <p>
          <NavLink to={`/p/${project.id}/edit/org`}>団体・路線へ</NavLink>
        </p>
      )}
    </div>
  );
}
