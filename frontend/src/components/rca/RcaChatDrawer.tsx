import React, { useState } from 'react';
import { ChatMessage } from '../../types';
import { sendChatMessage } from '../../services/api';
import { Sparkles, Send, Terminal, XCircle, Bot, User } from 'lucide-react';

interface RcaChatDrawerProps {
  onClose: () => void;
}

export const RcaChatDrawer: React.FC<RcaChatDrawerProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'assistant',
      text: 'Hello! I am your ClickHouse MCP & DeepSeek ReAct follow-up agent. Ask me any question about the ad events, publisher tiers, device profiles, or RCA evidence.',
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: input,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    const userPrompt = input;
    setInput('');
    setLoading(true);

    const res = await sendChatMessage(userPrompt);
    setMessages((prev) => [...prev, res]);
    setLoading(false);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600/30 border border-brand-500/40 flex items-center justify-center text-brand-300">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">ClickHouse MCP Chat Agent</h3>
            <span className="text-[11px] text-slate-400">DeepSeek-V3 ReAct Agent</span>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                msg.sender === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-brand-300 border border-slate-700'
              }`}
            >
              {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`space-y-1.5 max-w-[82%] ${msg.sender === 'user' ? 'text-right' : ''}`}>
              <div
                className={`p-3 rounded-2xl text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-brand-600 text-white rounded-tr-none'
                    : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>

              {/* Render SQL Query if tool was invoked */}
              {msg.sqlQuery && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 space-y-1 text-left">
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-emerald-400" /> ClickHouse SQL Tool Invocation:
                  </div>
                  <div className="overflow-x-auto">{msg.sqlQuery}</div>
                </div>
              )}

              <span className="text-[10px] text-slate-500 block px-1">{msg.timestamp}</span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-brand-300 animate-pulse p-2">
            <Sparkles className="w-4 h-4 animate-spin" /> Querying ClickHouse MCP & DeepSeek...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask follow-up (e.g. Which publisher tier had the lowest CTR?)..."
            className="flex-1 bg-slate-800 text-xs text-white border border-slate-700 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50 transition-colors shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
