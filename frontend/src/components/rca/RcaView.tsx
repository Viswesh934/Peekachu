import React, { useState } from 'react';
import { AnomalyIncident } from '../../types';
import { AnomalyCard } from './AnomalyCard';
import { RcaDetailDrawer } from './RcaDetailDrawer';
import { LangfuseTraceModal } from './LangfuseTraceModal';
import { RcaChatDrawer } from './RcaChatDrawer';
import { BrainCircuit, Sparkles, Filter, Play, CheckCircle2, RefreshCw } from 'lucide-react';

interface RcaViewProps {
  anomalies: AnomalyIncident[];
  onApprove: (id: string) => void;
  onFlagHallucination: (id: string, reason: string, feedback: string) => void;
}

export const RcaView: React.FC<RcaViewProps> = ({ anomalies, onApprove, onFlagHallucination }) => {
  const [selectedId, setSelectedId] = useState<string>(anomalies[0]?.id || '');
  const [showTraceModal, setShowTraceModal] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [isDemoReplaying, setIsDemoReplaying] = useState(false);
  const [demoStep, setDemoStep] = useState<number | null>(null);

  const selectedAnomaly = anomalies.find((a) => a.id === selectedId) || anomalies[0];

  const filteredAnomalies = anomalies.filter((a) => {
    if (filterStatus === 'ALL') return true;
    return a.humanReview.status === filterStatus;
  });

  const handleReplayDemo = () => {
    if (anomalies.length === 0) return;
    const demoIncident = anomalies[0]; // INC-2026-0801-01 (Fill Rate Drop on iPhone 15 Pro)
    setSelectedId(demoIncident.id);
    setIsDemoReplaying(true);
    setDemoStep(1);

    setTimeout(() => setDemoStep(2), 1200);
    setTimeout(() => setDemoStep(3), 2400);
    setTimeout(() => {
      setDemoStep(4);
      setTimeout(() => {
        setIsDemoReplaying(false);
        setDemoStep(null);
      }, 2000);
    }, 3600);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 glow-amber">
            <BrainCircuit className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Automated Root Cause Analyst (InMobi Click-a-thon)
              <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                ClickHouse + Go + DeepSeek
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Automated metric anomaly detection, revenue identity tree decomposition & zero-hallucination verbatim diagnosis
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Problem Statement Demo Replay Button */}
          <button
            onClick={handleReplayDemo}
            disabled={isDemoReplaying}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-extrabold text-xs shadow-lg shadow-rose-500/20 transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {isDemoReplaying ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Play className="w-4 h-4 fill-current text-white" />
            )}
            <span>▶ Replay Incident Demo (Problem Statement Walkthrough)</span>
          </button>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
            {['ALL', 'PENDING', 'APPROVED', 'HALLUCINATION'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all text-[11px] ${
                  filterStatus === st
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Demo Walkthrough Progress Banner */}
      {isDemoReplaying && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-slate-900 to-rose-950/80 border border-amber-500/50 glass-panel shadow-2xl space-y-2 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-bold text-amber-300">
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
              <span>Executing Problem Statement Demo Sequence...</span>
            </span>
            <span className="font-mono text-[11px]">Step {demoStep} of 4</span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-[11px]">
            <div className={`p-2 rounded-lg border font-mono ${demoStep! >= 1 ? 'bg-amber-500/20 text-amber-200 border-amber-500/40' : 'bg-slate-950/40 text-slate-500 border-slate-800'}`}>
              1. Alert Triggered (|Z| ≥ 3.0)
            </div>
            <div className={`p-2 rounded-lg border font-mono ${demoStep! >= 2 ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40' : 'bg-slate-950/40 text-slate-500 border-slate-800'}`}>
              2. ClickHouse SQL Fan-out
            </div>
            <div className={`p-2 rounded-lg border font-mono ${demoStep! >= 3 ? 'bg-rose-500/20 text-rose-200 border-rose-500/40' : 'bg-slate-950/40 text-slate-500 border-slate-800'}`}>
              3. Metric Tree Evaluation
            </div>
            <div className={`p-2 rounded-lg border font-mono ${demoStep! >= 4 ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' : 'bg-slate-950/40 text-slate-500 border-slate-800'}`}>
              4. DeepSeek Verbatim RCA
            </div>
          </div>
        </div>
      )}

      {/* Grid Layout: Left Anomaly List, Right RCA Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Anomaly List (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Detected Anomalies ({filteredAnomalies.length})
          </h3>

          <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
            {filteredAnomalies.map((ano) => (
              <AnomalyCard
                key={ano.id}
                anomaly={ano}
                isSelected={ano.id === selectedAnomaly?.id}
                onSelect={() => setSelectedId(ano.id)}
              />
            ))}

            {filteredAnomalies.length === 0 && (
              <div className="p-8 text-center rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
                No incidents match status filter "{filterStatus}".
              </div>
            )}
          </div>
        </div>

        {/* Right Column: RCA Detail & Human Loop Actions (8 cols) */}
        <div className="lg:col-span-8">
          {selectedAnomaly ? (
            <RcaDetailDrawer
              anomaly={selectedAnomaly}
              onApprove={onApprove}
              onFlagHallucination={onFlagHallucination}
              onOpenLangfuseTrace={() => setShowTraceModal(true)}
              onOpenChatAgent={() => setShowChatDrawer(true)}
            />
          ) : (
            <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
              Select an anomaly from the left panel to inspect findings.
            </div>
          )}
        </div>
      </div>

      {/* Modals & Drawers */}
      {showTraceModal && (
        <LangfuseTraceModal telemetry={selectedAnomaly?.langfuse} onClose={() => setShowTraceModal(false)} />
      )}

      {showChatDrawer && <RcaChatDrawer onClose={() => setShowChatDrawer(false)} />}
    </div>
  );
};
