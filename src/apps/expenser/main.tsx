import React from 'react';
import ReactDOM from 'react-dom/client';
import { ExpenserApp } from './ExpenserApp';
import '../../index.css';

// Register Service Worker for offline PWA installation
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ExpenserApp />
  </React.StrictMode>
);
