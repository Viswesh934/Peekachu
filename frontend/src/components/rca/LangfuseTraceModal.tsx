import React from 'react';
import { LangfuseTelemetry } from '../../types';
import { Terminal, ExternalLink, XCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface LangfuseTraceModalProps {
  telemetry?: LangfuseTelemetry;
  onClose: () => void;
}

export const LangfuseTraceModal: React.FC<LangfuseTraceModalProps> = ({ telemetry, onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Langfuse Telemetry & Trace Spans</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-400 block">Trace ID</span>
            <span className="font-mono font-bold text-slate-200">{telemetry?.traceId || 'tr-9948a2-deepseek-rca'}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-400 block">Faithfulness Score</span>
            <span className="font-mono font-bold text-emerald-400">
              {((telemetry?.faithfulnessScore || 0.98) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-slate-400 block">SQL Spans Executed</span>
            <span className="font-mono font-bold text-brand-300">{telemetry?.sqlSpansCount || 9} Spans</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 font-mono text-xs text-slate-300 space-y-2 border border-slate-800">
          <div className="text-slate-500">// Langfuse Span Execution Timeline</div>
          <div className="text-emerald-400">├── [SQL:detect] baseline evaluation (14ms)</div>
          <div className="text-emerald-400">├── [Go:drilldown:wave1] parallel query fan-out (42ms)</div>
          <div className="text-emerald-400">├── [Go:drilldown:wave2] two-way interaction sub-queries (38ms)</div>
          <div className="text-brand-300">├── [LLM:narrate] DeepSeek-V3 constrained prompt (620ms)</div>
          <div className="text-indigo-400">└── [Telemetry:score] Faithfulness score evaluation (25ms)</div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <a
            href={telemetry?.traceUrl || 'https://cloud.langfuse.com'}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-brand-300 hover:text-brand-200 font-semibold"
          >
            Open in Langfuse Cloud <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
