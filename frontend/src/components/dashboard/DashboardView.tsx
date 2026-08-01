import React, { useState } from 'react';
import { MetricSummary, TimeSeriesPoint, FilterState, ModuleType } from '../../types';
import { MetricCard } from './MetricCard';
import { MetricCharts } from './MetricCharts';
import { FilterBar } from './FilterBar';
import { LiveEventStream } from './LiveEventStream';
import {
  Activity,
  Percent,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Crown,
} from 'lucide-react';

interface DashboardViewProps {
  metrics: MetricSummary;
  timeSeries: TimeSeriesPoint[];
  onNavigateToRca: () => void;
  pendingRcaCount: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  timeSeries,
  onNavigateToRca,
  pendingRcaCount,
}) => {
  const [filters, setFilters] = useState<FilterState>({
    timeRange: 'last_24h',
    appCategory: 'all',
    vertical: 'all',
    region: 'all',
    adFormat: 'all',
    deviceModel: 'all',
  });

  const handleResetFilters = () => {
    setFilters({
      timeRange: 'last_24h',
      appCategory: 'all',
      vertical: 'all',
      region: 'all',
      adFormat: 'all',
      deviceModel: 'all',
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Primary Focus Header Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-brand-500/10 to-indigo-500/10 border border-emerald-500/30 glass-panel flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Crown className="w-5 h-5 animate-pulse text-amber-400" />
          </div>
          <div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
              Secondary Revenue Overview
            </h4>
            <p className="text-xs text-slate-300">
              Use this panel for context and monitoring after the main RCA result has been inspected.
            </p>
          </div>
        </div>
      </div>

      {/* Top Banner Alert if Pending RCA Review exists */}
      {pendingRcaCount > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-rose-500/10 to-brand-500/20 border border-amber-500/40 glass-panel flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                Active Revenue Anomaly Detected (Z-Score: -3.92)
              </h4>
              <p className="text-xs text-slate-300">
                Revenue drop of -28.4% at 14:00 UTC requires Human-in-the-Loop review & verification.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToRca}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all"
          >
            Review Revenue RCA <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <FilterBar filters={filters} setFilters={setFilters} onReset={handleResetFilters} />

      {/* KPI Metric Cards Grid - Revenue First */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Hourly Revenue ($) [PRIMARY]"
          value={`$${metrics.revenue.toLocaleString()}`}
          subtext="Baseline $25,420.50 vs $18,200.10"
          trendPct={-28.4}
          icon={DollarSign}
          color="emerald"
          isAnomaly
        />
        <MetricCard
          title="Fill Rate % (Revenue Driver)"
          value={`${metrics.fillRatePct}%`}
          subtext="Identity factor driver for revenue"
          trendPct={-28.1}
          icon={Percent}
          color="rose"
          isAnomaly
        />
        <MetricCard
          title="Total Ad Requests"
          value={metrics.totalRequests.toLocaleString()}
          subtext="9.48M event stream baseline"
          icon={Activity}
          color="indigo"
        />
        <MetricCard
          title="Average eCPM ($)"
          value={`$${metrics.ecpm.toFixed(2)}`}
          subtext="CPM across filled impressions"
          trendPct={0.0}
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* Recharts Performance Visualizations */}
      <MetricCharts data={timeSeries} onSelectAnomalyTime={onNavigateToRca} />

      {/* Live Stream Table */}
      <LiveEventStream />
    </div>
  );
};
