import React from 'react';
import ReactDOM from 'react-dom/client';
import { ExpenserApp } from './ExpenserApp';
import '../../index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ExpenserApp />
  </React.StrictMode>
);
