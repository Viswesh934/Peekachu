import React, { useState } from 'react';
import { AnomalyIncident } from '../../types';
import { AnomalyCard } from './AnomalyCard';
import { RcaDetailDrawer } from './RcaDetailDrawer';
import { LangfuseTraceModal } from './LangfuseTraceModal';
import { RcaChatDrawer } from './RcaChatDrawer';
import { BrainCircuit, Sparkles, Filter } from 'lucide-react';

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

  const selectedAnomaly = anomalies.find((a) => a.id === selectedId) || anomalies[0];

  const filteredAnomalies = anomalies.filter((a) => {
    if (filterStatus === 'ALL') return true;
    return a.humanReview.status === filterStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <BrainCircuit className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Root Cause Analysis & Human Intervention Module
            </h2>
            <p className="text-xs text-slate-400">
              Interactive human-in-the-loop review interface for automated anomaly investigations
            </p>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          {['ALL', 'PENDING', 'APPROVED', 'HALLUCINATION'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                filterStatus === st
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

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
