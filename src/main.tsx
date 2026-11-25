import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const PRELOAD_RELOAD_KEY = 'grimoire_preload_reload_at';

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    try {
      const lastReload = Number(sessionStorage.getItem(PRELOAD_RELOAD_KEY) || '0');
      if (Date.now() - lastReload > 15_000) {
        sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
