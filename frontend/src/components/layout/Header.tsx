import React from 'react';
import { ModuleType } from '../../types';
import {
  ChevronRight,
  Database,
  Activity,
  UserCheck,
  Bell,
  Search,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  activeModule: ModuleType;
  anomaliesCount: number;
  pendingCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeModule,
  anomaliesCount,
  pendingCount,
}) => {
  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400 font-medium">ClickHouse</span>
        <ChevronRight className="w-4 h-4 text-slate-600" />
        <span className="text-slate-300 font-medium">AdTech Analytics</span>
        <ChevronRight className="w-4 h-4 text-slate-600" />
        <span className="text-white font-semibold flex items-center gap-1.5">
          {activeModule === 'dashboard' ? 'Event Stream Dashboard' : 'RCA Engine (Human-in-the-Loop)'}
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* ClickHouse DB Status Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>ClickHouse Cloud</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
        </div>

        {/* Pending HITL Indicator */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 font-medium">
            <Activity className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span>{pendingCount} Pending Review</span>
          </div>
        )}

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-xs text-white shadow-sm ring-2 ring-brand-500/30">
            U
          </div>
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-semibold text-white">Umesh (AdOps)</span>
            <span className="text-[10px] text-slate-400">Human Operator</span>
          </div>
        </div>
      </div>
    </header>
  );
};
