import React, { useState, useEffect } from 'react';
import { LIVE_EVENT_SAMPLES } from '../../services/mockData';
import { Radio, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';

export const LiveEventStream: React.FC = () => {
  const [events, setEvents] = useState(LIVE_EVENT_SAMPLES);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-time event additions
      const newEvt = {
        id: `evt-${Math.floor(Math.random() * 900) + 100}`,
        app: Math.random() > 0.5 ? 'Subway Surfers (Tier 1)' : 'Candy Crush Saga',
        adFormat: Math.random() > 0.5 ? 'Rewarded Video' : 'Banner',
        geo: Math.random() > 0.4 ? 'US (iOS 17.5)' : 'IN (Android 14)',
        filled: Math.random() > 0.3,
        ecpm: `$${(Math.random() * 40 + 20).toFixed(2)}`,
        status: Math.random() > 0.3 ? 'Success' : 'Unfilled (Fill Rate Anomaly)',
      };
      setEvents((prev) => [newEvt, ...prev.slice(0, 5)]);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 glass-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
          <h3 className="text-base font-bold text-white">Live Ad Event Stream</h3>
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
            Realtime 9M Stream
          </span>
        </div>
        <span className="text-xs text-slate-400">ClickHouse ad_events fact table</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-800/80 uppercase font-semibold text-slate-400 border-b border-slate-700/80">
            <tr>
              <th className="px-4 py-3">Event ID</th>
              <th className="px-4 py-3">App Name</th>
              <th className="px-4 py-3">Ad Format</th>
              <th className="px-4 py-3">Geo / Device Profile</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">eCPM ($)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {events.map((evt) => (
              <tr key={evt.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3 font-mono font-medium text-slate-400">{evt.id}</td>
                <td className="px-4 py-3 font-semibold text-white">{evt.app}</td>
                <td className="px-4 py-3 text-slate-300">{evt.adFormat}</td>
                <td className="px-4 py-3 text-slate-400">{evt.geo}</td>
                <td className="px-4 py-3">
                  {evt.filled ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Filled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <ShieldAlert className="w-3 h-3" /> {evt.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-slate-200">{evt.ecpm}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
