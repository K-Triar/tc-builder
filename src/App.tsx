import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { FocusPage } from './ui/focus/FocusPage';
import { ProjectLayout } from './ui/layout/ProjectLayout';
import { ProjectRoute } from './ui/layout/ProjectRoute';
import { DocsPage } from './ui/pages/DocsPage';
import { EditPage } from './ui/pages/EditPage';
import { Home } from './ui/pages/Home';
import { ProjectIndex } from './ui/pages/OverviewPage';
import { WizardPage } from './ui/pages/WizardPage';
import { WorkPage } from './ui/pages/WorkPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/p/:id" element={<ProjectRoute />}>
        {/* はじめての質問（集中モード）：サイドバーなどを出さない */}
        <Route path="start/*" element={<FocusPage />} />
        <Route element={<ProjectLayout />}>
          <Route index element={<ProjectIndex />} />
          <Route path="setup/:step" element={<WizardPage />} />
          <Route path="edit/:tab" element={<EditPage />} />
          <Route path="work/:tab" element={<WorkPage />} />
          <Route path="docs/:tab" element={<DocsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
