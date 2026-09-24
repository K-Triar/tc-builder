import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { startAutosave } from './storage/autosave';
import './ui/styles/global.css';

// オフラインで使えるよう Service Worker を登録する（新しい版は自動で反映）
registerSW({ immediate: true });

// 開いているプロジェクトの変更を IndexedDB へ自動保存する
startAutosave();

const root = document.getElementById('root');
if (!root) throw new Error('#root が見つかりません');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
