import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// In AI Studio iFrame sandbox, HMR WebSocket is disabled; ignore ambient WebSocket connection errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (
      event.message?.includes('WebSocket') ||
      event.message?.includes('@vite/client') ||
      event.filename?.includes('@vite/client')
    ) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason);
    if (msg.includes('WebSocket') || msg.includes('@vite/client')) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
