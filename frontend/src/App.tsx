import React, { useState, useEffect } from 'react';
import { ModuleType, AnomalyIncident } from './types';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { RcaView } from './components/rca/RcaView';
import { INITIAL_METRICS_SUMMARY, INITIAL_ANOMALIES, HOURLY_TIME_SERIES } from './services/mockData';
import { fetchAnomalies } from './services/api';

export function App() {
  const [activeModule, setActiveModule] = useState<ModuleType>('rca');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [anomalies, setAnomalies] = useState<AnomalyIncident[]>(INITIAL_ANOMALIES);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchAnomalies().then((data) => {
      if (data && data.length > 0) {
        setAnomalies(data);
      }
    });
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleApprove = (id: string) => {
    setAnomalies((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            humanReview: {
              status: 'APPROVED',
              reviewedAt: new Date().toUTCString(),
              reviewedBy: 'Umesh (AdOps Lead)',
              feedbackNote: 'Human approved diagnosis & identity factor attribution.',
            },
          };
        }
        return a;
      })
    );
    showToast(`Anomaly ${id} APPROVED by operator.`);
  };

  const handleFlagHallucination = (id: string, reason: string, feedback: string) => {
    setAnomalies((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          return {
            ...a,
            humanReview: {
              status: 'HALLUCINATION',
              reviewedAt: new Date().toUTCString(),
              reviewedBy: 'Umesh (AdOps Lead)',
              hallucinationReason: reason,
              feedbackNote: feedback || 'Flagged model hallucination; recorded trace feedback.',
            },
          };
        }
        return a;
      })
    );
    showToast(`Anomaly ${id} FLAGGED as AI Hallucination! Feedback sent to Langfuse.`);
  };

  const pendingCount = anomalies.filter((a) => a.humanReview.status === 'PENDING').length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl bg-slate-900 border border-brand-500/50 text-xs font-semibold text-white shadow-2xl animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* App Sidebar */}
      <Sidebar
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        anomaliesCount={anomalies.length}
        pendingCount={pendingCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          activeModule={activeModule}
          anomaliesCount={anomalies.length}
          pendingCount={pendingCount}
        />

        <main className="flex-1 overflow-y-auto p-6">
          {activeModule === 'rca' ? (
            <RcaView
              anomalies={anomalies}
              onApprove={handleApprove}
              onFlagHallucination={handleFlagHallucination}
            />
          ) : (
            <DashboardView
              metrics={INITIAL_METRICS_SUMMARY}
              timeSeries={HOURLY_TIME_SERIES}
              onNavigateToRca={() => setActiveModule('rca')}
              pendingRcaCount={pendingCount}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
