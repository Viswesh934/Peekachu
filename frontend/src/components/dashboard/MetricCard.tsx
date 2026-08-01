import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  subtext: string;
  trendPct?: number;
  icon: LucideIcon;
  color: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple';
  isAnomaly?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtext,
  trendPct,
  icon: Icon,
  color,
  isAnomaly,
}) => {
  const colorMap = {
    indigo: 'from-indigo-500/20 to-brand-500/5 text-indigo-400 border-indigo-500/30',
    emerald: 'from-emerald-500/20 to-teal-500/5 text-emerald-400 border-emerald-500/30',
    amber: 'from-amber-500/20 to-orange-500/5 text-amber-400 border-amber-500/30',
    rose: 'from-rose-500/20 to-red-500/5 text-rose-400 border-rose-500/30',
    purple: 'from-purple-500/20 to-fuchsia-500/5 text-purple-400 border-purple-500/30',
  };

  return (
    <div
      className={`relative p-5 rounded-2xl bg-slate-900/80 border glass-panel glass-panel-hover overflow-hidden ${
        isAnomaly ? 'border-rose-500/50 glow-rose' : 'border-slate-800'
      }`}
    >
      {/* Background Accent Glow */}
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colorMap[color]} rounded-full blur-2xl opacity-20 pointer-events-none`} />

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
        <div className={`p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 ${colorMap[color].split(' ')[2]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">{value}</span>
        {trendPct !== undefined && (
          <span
            className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
              trendPct >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
            }`}
          >
            {trendPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trendPct)}%
          </span>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
        {isAnomaly && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>}
        {subtext}
      </p>
    </div>
  );
};
