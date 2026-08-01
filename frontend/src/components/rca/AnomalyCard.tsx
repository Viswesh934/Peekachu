import React from 'react';
import { AnomalyIncident } from '../../types';
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Flame,
  ChevronRight,
  TrendingDown,
  Activity,
  Layers,
} from 'lucide-react';

interface AnomalyCardProps {
  anomaly: AnomalyIncident;
  isSelected: boolean;
  onSelect: () => void;
}

export const AnomalyCard: React.FC<AnomalyCardProps> = ({ anomaly, isSelected, onSelect }) => {
  const severityColor = {
    CRITICAL: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    MAJOR: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    WARNING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  }[anomaly.severity];

  const reviewBadge = {
    APPROVED: { label: 'Human Approved', icon: CheckCircle2, cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    HALLUCINATION: { label: 'Flagged Hallucination', icon: Flame, cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
    PENDING: { label: 'Review Needed', icon: AlertCircle, cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  }[anomaly.humanReview.status];

  const ReviewIcon = reviewBadge.icon;

  return (
    <div
      onClick={onSelect}
      className={`p-5 rounded-2xl cursor-pointer transition-all duration-200 glass-panel ${
        isSelected
          ? 'bg-slate-900 border-brand-500 ring-2 ring-brand-500/30 shadow-xl shadow-brand-500/10'
          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${severityColor}`}>
            {anomaly.severity}
          </span>
          <span className="text-xs font-mono text-slate-400">{anomaly.id}</span>
        </div>
        <span className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${reviewBadge.cls}`}>
          <ReviewIcon className="w-3 h-3" />
          {reviewBadge.label}
        </span>
      </div>

      <h3 className="text-base font-bold text-white mb-2 leading-snug">{anomaly.title}</h3>

      <div className="grid grid-cols-3 gap-2 py-3 px-3 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-3 text-xs">
        <div>
          <span className="text-slate-500 block text-[10px]">METRIC</span>
          <span className="font-bold text-white uppercase">{anomaly.metric}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">DELTA</span>
          <span className="font-bold text-rose-400 flex items-center gap-0.5">
            <TrendingDown className="w-3 h-3" /> {anomaly.pct_change}%
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">Z-SCORE</span>
          <span className="font-mono font-bold text-amber-300">{anomaly.z_score}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-500" /> {anomaly.timestamp}
        </span>
        <span className="flex items-center gap-1 text-brand-300 font-semibold group-hover:translate-x-1 transition-transform">
          Inspect Evidence <ChevronRight className="w-4 h-4" />
        </span>
      </div>
    </div>
  );
};
