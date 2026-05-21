import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import OrderFulfillment from './pages/OrderFulfillment';
import InventoryManager from './pages/InventoryManager';
import SEOGenerator from './pages/SEOGenerator';
import CompetitorResearch from './pages/CompetitorResearch';
import Settings from './pages/Settings';
import FinanceReconciliation from './pages/FinanceReconciliation';
import Sidebar from './components/Sidebar';
import DebugConsole from './components/DebugConsole';

export default function App() {
  const [debugOpen, setDebugOpen] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ paddingBottom: debugOpen ? 230 : 16 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/orders" element={<OrderFulfillment />} />
          <Route path="/inventory" element={<InventoryManager />} />
          <Route path="/seo" element={<SEOGenerator />} />
          <Route path="/competitors" element={<CompetitorResearch />} />
          <Route path="/finance" element={<FinanceReconciliation />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <DebugConsole isOpen={debugOpen} onToggle={() => setDebugOpen(!debugOpen)} />
    </div>
  );
}
