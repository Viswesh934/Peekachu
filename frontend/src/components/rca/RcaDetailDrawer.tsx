import React, { useState } from 'react';
import { AnomalyIncident, HumanReviewStatus, ChatMessage } from '../../types';
import { HumanLoopControls } from './HumanLoopControls';
import { MetricTreeVisualizer } from './MetricTreeVisualizer';
import { sendChatMessage, triggerRcaAnalysis } from '../../services/api';
import {
  BrainCircuit,
  Layers,
  CheckCircle2,
  XCircle,
  FileText,
  Activity,
  Terminal,
  ExternalLink,
  ShieldCheck,
  TrendingDown,
  Sparkles,
  Play,
  Code2,
  MessageSquare,
  Send,
  Bot,
  User,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface RcaDetailDrawerProps {
  anomaly: AnomalyIncident;
  onApprove: (id: string) => void;
  onFlagHallucination: (id: string, reason: string, feedback: string) => void;
  onOpenLangfuseTrace: () => void;
  onOpenChatAgent: () => void;
}

export const RcaDetailDrawer: React.FC<RcaDetailDrawerProps> = ({
  anomaly,
  onApprove,
  onFlagHallucination,
  onOpenLangfuseTrace,
  onOpenChatAgent,
}) => {
  const [liveAnomaly, setLiveAnomaly] = useState<AnomalyIncident>(anomaly);
  const [selectedMetric, setSelectedMetric] = useState<string>(anomaly.metric || 'revenue');
  const [selectedWindow, setSelectedWindow] = useState<string>(`${anomaly.window_start} to ${anomaly.window_end}`);
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);
  const [showRawEvidence, setShowRawEvidence] = useState(false);

  // Embedded Inline MCP Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'c-1',
      sender: 'assistant',
      text: `Hello! I am your ClickHouse MCP & DeepSeek agent. Ask me any follow-up about ${anomaly.metric} anomaly or specific segment breakdowns.`,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const { evidence } = liveAnomaly;
  const isAnomalous = Math.abs(liveAnomaly.z_score) >= 3.0;

  React.useEffect(() => {
    setLiveAnomaly(anomaly);
    setSelectedMetric(anomaly.metric || 'revenue');
    setSelectedWindow(`${anomaly.window_start} to ${anomaly.window_end}`);
  }, [anomaly]);

  const handleRunAnalysis = async () => {
    setIsRunningAnalysis(true);
    const [windowStart, windowEnd] = selectedWindow.split(' to ');
    const result = await triggerRcaAnalysis(selectedMetric, windowStart?.trim(), windowEnd?.trim());
    setLiveAnomaly({
      ...result,
      id: anomaly.id,
      humanReview: anomaly.humanReview,
    });
    setTimeout(() => {
      setIsRunningAnalysis(false);
    }, 1200);
  };

  const handleSendInlineChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput;
    setChatInput('');
    setChatMessages((prev) => [
      ...prev,
      { id: `msg-${Date.now()}`, sender: 'user', text: userText, timestamp: new Date().toLocaleTimeString() },
    ]);
    setChatLoading(true);

    const reply = await sendChatMessage(userText);
    setChatMessages((prev) => [...prev, reply]);
    setChatLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* 1. CONTROL BAR: Metric Selector, Time Window, & Run Anomaly Button */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <Play className="w-4 h-4 text-emerald-400" />
            <span>Interactive Anomaly Execution Trigger</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">POST /api/v1/rca/analyze</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Metric Selector */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Target Metric</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 font-semibold uppercase"
            >
              <option value="revenue">Revenue ($) [PRIMARY TARGET]</option>
              <option value="fill_rate">Fill Rate (%) [Identity Factor]</option>
              <option value="ecpm">eCPM ($) [Identity Factor]</option>
              <option value="requests">Total Requests</option>
              <option value="ctr">CTR (%)</option>
            </select>
          </div>

          {/* Time Window Selector */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 block mb-1">Investigation Time Window</label>
            <select
              value={selectedWindow}
              onChange={(e) => setSelectedWindow(e.target.value)}
              className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono text-[11px]"
            >
              <option value="2026-08-01 14:00:00 to 15:00:00">2026-08-01 14:00:00 to 15:00:00 (Incident)</option>
              <option value="2026-08-01 11:00:00 to 12:00:00">2026-08-01 11:00:00 to 12:00:00 (APAC eCPM)</option>
              <option value="2026-07-31 18:00:00 to 19:00:00">2026-07-31 18:00:00 to 19:00:00 (EU Evening)</option>
            </select>
          </div>

          {/* Run Anomaly Button */}
          <div className="flex items-end">
            <button
              onClick={handleRunAnalysis}
              disabled={isRunningAnalysis}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {isRunningAnalysis ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-slate-950" />
                  Running ClickHouse & Go RCA...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-slate-950 fill-slate-950" />
                  Run Anomaly Detection & RCA
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. RESULT PANEL: Current vs Baseline, Delta, Percent Change, Z-Score, Anomaly Status */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 glass-panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/30">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-mono text-slate-400">ANALYSIS RESULT PANEL</span>
              <h2 className="text-xl font-extrabold text-white">{liveAnomaly.title}</h2>
            </div>
          </div>

          {/* Anomaly Status Badge */}
          <div className="flex items-center gap-3">
            {isAnomalous ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-extrabold shadow-lg shadow-rose-500/10">
                <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                ANOMALY DETECTED (|Z| ≥ 3.0)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-extrabold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                NORMAL (|Z| &lt; 3.0)
              </span>
            )}

            <button
              onClick={onOpenLangfuseTrace}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Langfuse Trace
            </button>
          </div>
        </div>

        {/* Core Metric KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block font-medium">Baseline Value</span>
              <span className="text-lg font-extrabold text-slate-200 font-mono mt-0.5 block">
              ${liveAnomaly.baseline_value.toLocaleString()}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block font-medium">Current Metric Value</span>
            <span className="text-lg font-extrabold text-rose-400 font-mono mt-0.5 block">
              ${liveAnomaly.current_value.toLocaleString()}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block font-medium">Net Delta & % Change</span>
            <span className="text-lg font-extrabold text-rose-400 flex items-center gap-1 font-mono mt-0.5">
              <TrendingDown className="w-4 h-4" /> {liveAnomaly.pct_change}% (${(liveAnomaly.evidence?.delta ?? (liveAnomaly as any).delta ?? 0).toLocaleString()})
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block font-medium">Z-Score Deviation</span>
            <span className="text-lg font-extrabold text-amber-300 font-mono mt-0.5 block">
              Z = {liveAnomaly.z_score}
            </span>
          </div>
        </div>
      </div>

      {/* ClickHouse Metric Decomposition Tree (Green / Amber / Red Status Lights) */}
      <MetricTreeVisualizer
        metric={liveAnomaly.metric}
        factorDecomp={evidence?.factor_decomposition}
        topSegments={evidence?.top_contributing_segments || []}
        ruledOut={evidence?.ruled_out || []}
      />

      {/* Human-in-the-Loop Control Panel (Buttons 1 & 2) */}
      <HumanLoopControls
        status={liveAnomaly.humanReview.status}
        reviewedAt={liveAnomaly.humanReview.reviewedAt}
        reviewedBy={liveAnomaly.humanReview.reviewedBy}
        hallucinationReason={liveAnomaly.humanReview.hallucinationReason}
        feedbackNote={liveAnomaly.humanReview.feedbackNote}
        onApprove={() => onApprove(liveAnomaly.id)}
        onFlagHallucination={(reason, feedback) => onFlagHallucination(liveAnomaly.id, reason, feedback)}
      />

      {/* DeepSeek AI Plain-Language Diagnosis */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-slate-800 pb-2">
          <FileText className="w-4 h-4 text-brand-400" />
          <span>DeepSeek AI LLM Narrative Explanation</span>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed font-sans bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          {liveAnomaly.diagnosisText}
        </p>
      </div>

      {/* 3. RANKED SEGMENT BREAKDOWN & RULED-OUT DIMENSIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Contributors (8 cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-400" />
              <span>Ranked Top Contributors (Go Fan-Out Worker Engine)</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">Share of Delta %</span>
          </div>

          <div className="space-y-3">
            {(evidence?.top_contributing_segments || []).map((seg, idx) => {
              const baseVal = seg.baseline_metric ?? (seg as any).base_metric ?? 0;
              const curVal = seg.current_metric ?? (seg as any).current_m ?? 0;
              const deltaVal = seg.segment_delta ?? 0;
              return (
                <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                      {idx + 1}. {seg.dimension}: <span className="text-brand-300">{seg.value}</span>
                    </span>
                    <span className="font-mono font-extrabold text-amber-300 text-sm">
                      {(seg.share_of_delta * 100).toFixed(1)}% Share of Delta
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, seg.share_of_delta * 100))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Baseline: ${baseVal.toLocaleString()}</span>
                    <span>Current: ${curVal.toLocaleString()}</span>
                    <span className="text-rose-400">Delta: ${deltaVal.toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
            {(!evidence?.top_contributing_segments || evidence.top_contributing_segments.length === 0) && (
              <p className="text-xs text-slate-400 font-mono">No top contributing segments found for this window.</p>
            )}
          </div>
        </div>

        {/* Ruled-Out Dimensions (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-slate-800 pb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Ruled-Out Dimensions (Cleared)</span>
          </div>
          <div className="space-y-2.5">
            {(evidence?.ruled_out || []).map((item, idx) => (
              <div key={idx} className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-200 capitalize">{item.dimension?.replace('_', ' ')}: </span>
                  <span className="text-slate-400 leading-relaxed block mt-0.5">{item.reason}</span>
                </div>
              </div>
            ))}
            {(!evidence?.ruled_out || evidence.ruled_out.length === 0) && (
              <p className="text-xs text-slate-400 font-mono">No ruled-out factors recorded.</p>
            )}
          </div>
        </div>
      </div>

      {/* 4. COMPUTED TRACE & RAW EVIDENCE JSON PANEL */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-3">
        <button
          onClick={() => setShowRawEvidence(!showRawEvidence)}
          className="w-full flex items-center justify-between text-sm font-bold text-white border-b border-slate-800 pb-2 focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-400" />
            <span>Computed Evidence & ClickHouse Trace Payload (Deterministic JSON)</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              {evidence?.execution_time_ms ?? 0}ms Execution
            </span>
          </div>
          {showRawEvidence ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showRawEvidence && (
          <div className="space-y-2">
            <p className="text-xs text-slate-400">
              This evidence JSON is produced directly by ClickHouse SQL & the Go RCA worker engine. Reviewers can verify every number is computed, not guessed.
            </p>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-80">
              {JSON.stringify(evidence, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* 5. FOLLOW-UP CHAT BOX (MCP-Backed Chat Route) */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Ad-Hoc Follow-Up Chat (ClickHouse MCP & DeepSeek Agent)</h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">POST /api/v1/chat</span>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  msg.sender === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-brand-300 border border-slate-700'
                }`}
              >
                {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              <div className={`space-y-1 max-w-[85%] ${msg.sender === 'user' ? 'text-right' : ''}`}>
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-brand-600 text-white rounded-tr-none'
                      : 'bg-slate-950 text-slate-200 border border-slate-800 rounded-tl-none'
                  }`}
                >
                  {msg.text}
                </div>
                {msg.sqlQuery && (
                  <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 text-left">
                    <span className="text-slate-500 block text-[10px]">// ClickHouse Tool Query:</span>
                    {msg.sqlQuery}
                  </div>
                )}
              </div>
            </div>
          ))}

          {chatLoading && (
            <div className="flex items-center gap-2 text-xs text-brand-300 animate-pulse p-2">
              <Sparkles className="w-4 h-4 animate-spin" /> Querying ClickHouse MCP Tool...
            </div>
          )}
        </div>

        <form onSubmit={handleSendInlineChat} className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask follow-up question (e.g. Compare iOS 17.5 vs Android 14 fill rate)..."
            className="flex-1 bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 font-sans"
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || chatLoading}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Send
          </button>
        </form>
      </div>
    </div>
  );
};
