import React from 'react';
import { ModuleType } from '../../types';
import {
  LayoutDashboard,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface SidebarProps {
  activeModule: ModuleType;
  setActiveModule: (mod: ModuleType) => void;
  collapsed: boolean;
  setCollapsed: (col: boolean) => void;
  anomaliesCount: number;
  pendingCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  setActiveModule,
  collapsed,
  setCollapsed,
  anomaliesCount,
  pendingCount,
}) => {
  return (
    <aside
      className={`relative flex flex-col h-screen bg-slate-900 border-r border-slate-800/80 transition-all duration-300 z-30 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-brand-500/20 shrink-0">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                ClickStack <span className="text-xs px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">RCA</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Click-a-thon 2026</span>
            </div>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          {!collapsed ? 'Core Engine Modules' : 'Menu'}
        </div>

        {/* Dashboard Link */}
        <button
          onClick={() => setActiveModule('dashboard')}
          className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
            activeModule === 'dashboard'
              ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25 border border-brand-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 shrink-0 ${activeModule === 'dashboard' ? 'text-white' : 'text-slate-400'}`} />
          {!collapsed && <span className="truncate">Dashboard</span>}
        </button>

        {/* RCA Module Link */}
        <button
          onClick={() => setActiveModule('rca')}
          className={`w-full flex items-center justify-between px-3 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
            activeModule === 'rca'
              ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25 border border-brand-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-3.5 overflow-hidden">
            <BrainCircuit className={`w-5 h-5 shrink-0 ${activeModule === 'rca' ? 'text-white' : 'text-amber-400'}`} />
            {!collapsed && <span className="truncate">RCA & Human Loop</span>}
          </div>

          {!collapsed && pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Footer Info Box */}
      {!collapsed && (
        <div className="p-4 m-3 rounded-xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-brand-300">
            <Layers className="w-4 h-4 text-brand-400" />
            <span>Human-in-the-Loop</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Review root cause analyses, approve findings, or flag AI hallucinations for telemetry tuning.
          </p>
          <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">System Status:</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Online
            </span>
          </div>
        </div>
      )}
    </aside>
  );
};
