import React from 'react';
import ReactDOM from 'react-dom/client';
import DashboardPage from './DashboardPage';
import './dashboard.css';

ReactDOM.createRoot(document.getElementById('dashboard-root')!).render(
  <React.StrictMode>
    <DashboardPage />
  </React.StrictMode>
);