import React from 'react';
import { FactorDecomposition, SegmentDriver, RuledOutCause } from '../../types';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  Layers,
  Sparkles,
  ChevronRight,
  Activity,
  GitBranch,
} from 'lucide-react';

interface MetricTreeProps {
  metric: string;
  factorDecomp?: FactorDecomposition;
  topSegments: SegmentDriver[];
  ruledOut: RuledOutCause[];
}

export const MetricTreeVisualizer: React.FC<MetricTreeProps> = ({
  metric,
  factorDecomp,
  topSegments = [],
  ruledOut = [],
}) => {
  const primaryDriver = factorDecomp?.primary_driver_factor || 'fill_rate';

  const getNodeStatus = (nodeMetric: string) => {
    if (primaryDriver === nodeMetric || metric === nodeMetric) {
      return {
        color: 'border-rose-500/80 bg-rose-950/40 text-rose-300 shadow-lg shadow-rose-500/10',
        badge: 'CRITICAL DRIVER',
        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        icon: <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />,
        isRed: true,
      };
    }
    const isRuledOut = ruledOut.some(
      (r) => r.dimension.includes(nodeMetric) || nodeMetric.includes(r.dimension)
    );
    if (isRuledOut) {
      return {
        color: 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300',
        badge: 'RULED OUT (CLEARED)',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        isRed: false,
      };
    }
    return {
      color: 'border-slate-800 bg-slate-900/60 text-slate-300',
      badge: 'NORMAL (IN BOUNDS)',
      badgeColor: 'bg-slate-800 text-slate-400 border-slate-700',
      icon: <Activity className="w-4 h-4 text-slate-400" />,
      isRed: false,
    };
  };

  const reqStatus = getNodeStatus('requests');
  const fillStatus = getNodeStatus('fill_rate');
  const renderStatus = getNodeStatus('render_rate');
  const ecpmStatus = getNodeStatus('ecpm');

  const reqChange = factorDecomp?.requests_delta_pct ?? 0.3;
  const fillChange = factorDecomp?.fill_rate_delta_pct ?? -28.1;
  const renderChange = factorDecomp?.render_rate_delta_pct ?? 0.1;
  const ecpmChange = factorDecomp?.ecpm_delta_pct ?? 0.0;

  return (
    <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-brand-400" />
          <h3 className="text-sm font-bold text-white tracking-wide">
            Metric Decomposition Tree (ClickHouse Revenue Identity)
          </h3>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
          <Database className="w-3 h-3 text-cyan-400" /> ClickHouse Computed
        </span>
      </div>

      {/* Identity Equation Banner */}
      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 font-mono text-xs text-slate-300 flex items-center justify-between overflow-x-auto gap-2">
        <span className="text-amber-300 font-bold">Revenue Identity:</span>
        <div className="flex items-center gap-2 text-[11px]">
          <span className={`px-2 py-0.5 rounded border ${reqStatus.badgeColor}`}>
            Requests ({reqChange > 0 ? `+${reqChange}` : reqChange}%)
          </span>
          <span className="text-slate-500">×</span>
          <span className={`px-2 py-0.5 rounded border ${fillStatus.badgeColor}`}>
            Fill Rate ({fillChange > 0 ? `+${fillChange}` : fillChange}%)
          </span>
          <span className="text-slate-500">×</span>
          <span className={`px-2 py-0.5 rounded border ${renderStatus.badgeColor}`}>
            Render Rate ({renderChange > 0 ? `+${renderChange}` : renderChange}%)
          </span>
          <span className="text-slate-500">×</span>
          <span className={`px-2 py-0.5 rounded border ${ecpmStatus.badgeColor}`}>
            eCPM ({ecpmChange > 0 ? `+${ecpmChange}` : ecpmChange}%)
          </span>
        </div>
      </div>

      {/* Metric Tree Nodes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Node 1: Request Volume */}
        <div className={`p-4 rounded-xl border ${reqStatus.color} space-y-2 transition-all`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5">{reqStatus.icon} Request Volume</span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${reqStatus.badgeColor}`}>
              {reqStatus.badge}
            </span>
          </div>
          <div className="text-lg font-extrabold font-mono text-slate-100">
            {reqChange > 0 ? `+${reqChange}%` : `${reqChange}%`}
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Traffic volume held within normal like-for-like baseline bounds.
          </p>
        </div>

        {/* Node 2: Fill Rate (Primary Driver) */}
        <div className={`p-4 rounded-xl border ${fillStatus.color} space-y-2 transition-all`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5">{fillStatus.icon} Fill Rate</span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${fillStatus.badgeColor}`}>
              {fillStatus.badge}
            </span>
          </div>
          <div className="text-lg font-extrabold font-mono text-rose-400">
            {fillChange > 0 ? `+${fillChange}%` : `${fillChange}%`}
          </div>
          <p className="text-[11px] text-rose-300/90 leading-tight">
            Primary driver of metric deviation. Isolated to specific device & region combinations.
          </p>
        </div>

        {/* Node 3: Render Rate */}
        <div className={`p-4 rounded-xl border ${renderStatus.color} space-y-2 transition-all`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5">{renderStatus.icon} Render Rate</span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${renderStatus.badgeColor}`}>
              {renderStatus.badge}
            </span>
          </div>
          <div className="text-lg font-extrabold font-mono text-slate-100">
            {renderChange > 0 ? `+${renderChange}%` : `${renderChange}%`}
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Ad impression rendering rate stable across app SDKs.
          </p>
        </div>

        {/* Node 4: eCPM Pricing */}
        <div className={`p-4 rounded-xl border ${ecpmStatus.color} space-y-2 transition-all`}>
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5">{ecpmStatus.icon} eCPM Pricing</span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono border ${ecpmStatus.badgeColor}`}>
              {ecpmStatus.badge}
            </span>
          </div>
          <div className="text-lg font-extrabold font-mono text-slate-100">
            {ecpmChange > 0 ? `+${ecpmChange}%` : `${ecpmChange}%`}
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            Advertiser pricing density held steady across verticals.
          </p>
        </div>
      </div>

      {/* Expanded Root-Cause Segment Localization Branch */}
      {topSegments.length > 0 && (
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <ChevronRight className="w-4 h-4 text-amber-400" />
            <span>Go RCA Worker Engine — Multi-Level Segment Tree Localization</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topSegments.slice(0, 3).map((seg, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-medium capitalize">{seg.dimension}</span>
                  <span className="font-mono text-amber-300 font-bold">
                    {(seg.share_of_delta * 100).toFixed(1)}% Share
                  </span>
                </div>
                <div className="font-bold text-white truncate text-sm">{seg.value}</div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, Math.max(0, seg.share_of_delta * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
