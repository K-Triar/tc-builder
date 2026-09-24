import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { ProjectRoute } from './ui/layout/ProjectRoute';
import { DocsPage } from './ui/pages/DocsPage';
import { EditPage } from './ui/pages/EditPage';
import { Home } from './ui/pages/Home';
import { WizardPage } from './ui/pages/WizardPage';
import { WorkPage } from './ui/pages/WorkPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/p/:id" element={<ProjectRoute />}>
        <Route index element={<Navigate to="work/signs" replace />} />
        <Route path="setup/:step" element={<WizardPage />} />
        <Route path="edit/:tab" element={<EditPage />} />
        <Route path="work/:tab" element={<WorkPage />} />
        <Route path="docs/:tab" element={<DocsPage />} />
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
