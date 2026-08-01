import React, { useState } from 'react';
import { HumanReviewStatus } from '../../types';
import {
  CheckCircle2,
  AlertTriangle,
  Flame,
  ThumbsUp,
  XCircle,
  HelpCircle,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface HumanLoopControlsProps {
  status: HumanReviewStatus;
  reviewedAt?: string;
  reviewedBy?: string;
  hallucinationReason?: string;
  feedbackNote?: string;
  onApprove: () => void;
  onFlagHallucination: (reason: string, feedback: string) => void;
}

export const HumanLoopControls: React.FC<HumanLoopControlsProps> = ({
  status,
  reviewedAt,
  reviewedBy,
  hallucinationReason,
  feedbackNote,
  onApprove,
  onFlagHallucination,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState('LLM exaggerated percentage change / numbers');
  const [customNote, setCustomNote] = useState('');

  const handleConfirmFlag = () => {
    onFlagHallucination(selectedReason, customNote);
    setShowModal(false);
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-400" />
          <h4 className="text-sm font-bold text-white">Human-in-the-Loop Verification</h4>
        </div>
        <span className="text-[11px] text-slate-400">Operator Review Interface</span>
      </div>

      {/* Current Status Badge */}
      {status === 'APPROVED' && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-emerald-300 block">Status: Approved by Operator</span>
            <span className="text-slate-400 block mt-0.5">
              Verified by {reviewedBy || 'Operator'} on {reviewedAt || 'Just now'}
            </span>
            {feedbackNote && <p className="text-slate-300 italic mt-1 font-mono">"{feedbackNote}"</p>}
          </div>
        </div>
      )}

      {status === 'HALLUCINATION' && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
          <Flame className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-rose-300 block">Status: Flagged as AI Hallucination</span>
            <span className="text-slate-400 block mt-0.5">Reason: {hallucinationReason}</span>
            {feedbackNote && <p className="text-slate-300 italic mt-1 font-mono">"{feedbackNote}"</p>}
          </div>
        </div>
      )}

      {status === 'PENDING' && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-amber-300 font-medium">
            <AlertTriangle className="w-4 h-4" />
            <span>Human verification needed before committing trace feedback</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 font-bold">
            Pending
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {/* Button 1: Human Approve */}
        <button
          onClick={onApprove}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md ${
            status === 'APPROVED'
              ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
          }`}
        >
          <ThumbsUp className="w-4 h-4" />
          Button 1: Approve RCA Finding
        </button>

        {/* Button 2: Flag as Hallucination */}
        <button
          onClick={() => setShowModal(true)}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md ${
            status === 'HALLUCINATION'
              ? 'bg-rose-600 text-white ring-2 ring-rose-400'
              : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
          }`}
        >
          <Flame className="w-4 h-4 text-rose-400" />
          Button 2: Flag as Hallucination
        </button>
      </div>

      {/* Flag Hallucination Feedback Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-400" /> Flag AI Hallucination / Discrepancy
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Select the primary reason why this AI RCA output is inaccurate or hallucinated. This feedback will be sent to Langfuse telemetry to fine-tune the DeepSeek narrator prompt.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 block">Hallucination Category</label>
              <select
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="LLM exaggerated percentage change / numbers">LLM exaggerated percentage change / numbers</option>
                <option value="Hallucinated non-existent segment or device model">Hallucinated non-existent segment or device model</option>
                <option value="Incorrect factor attribution (Requests vs Fill Rate)">Incorrect factor attribution (Requests vs Fill Rate)</option>
                <option value="Misquoted baseline metrics verbatim constraint violation">Misquoted baseline metrics verbatim constraint violation</option>
                <option value="Other model hallucination">Other model hallucination</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 block">Operator Note / Correction (Optional)</label>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                rows={3}
                placeholder="Describe the discrepancy observed..."
                className="w-full bg-slate-800 text-xs text-white border border-slate-700 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFlag}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30"
              >
                Confirm & Record Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
