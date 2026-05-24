import React from 'react';
import ReactDOM from 'react-dom/client';
import BulkLister from './pages/BulkLister';
import './dashboard.css';

ReactDOM.createRoot(document.getElementById('bulklister-root')!).render(
  <React.StrictMode>
    <BulkLister />
  </React.StrictMode>
);
