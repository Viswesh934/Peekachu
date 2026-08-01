import { AnomalyIncident, ChatMessage } from '../types';
import { INITIAL_ANOMALIES } from './mockData';

// const BASE_URL = '/api/v1';

/**
 * Fetch anomalies list (Static mock mode active).
 * Uncomment the fetch logic below when backend API integration is required.
 */
export async function fetchAnomalies(): Promise<AnomalyIncident[]> {
  /*
  // UNCOMMENT WHEN BACKEND API IS READY:
  try {
    const res = await fetch(`${BASE_URL}/rca/detect`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend API offline, using static mock data:', err);
  }
  */

  // Return static mock dataset directly
  return INITIAL_ANOMALIES;
}

/**
 * Trigger RCA analysis for a specific metric and window (Static mock mode active).
 * Uncomment the fetch logic below when backend API integration is required.
 */
export async function triggerRcaAnalysis(metric: string, windowStart?: string, windowEnd?: string) {
  /*
  // UNCOMMENT WHEN BACKEND API IS READY:
  try {
    const res = await fetch(`${BASE_URL}/rca/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metric, window_start: windowStart, window_end: windowEnd }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend RCA endpoint error, using static fallback:', err);
  }
  */

  // Return static RCA evidence bundle
  const found = INITIAL_ANOMALIES.find((a) => a.metric === metric) || INITIAL_ANOMALIES[0];
  return found;
}

/**
 * Send interactive chat query to ClickHouse MCP & DeepSeek agent (Static mock mode active).
 * Uncomment the fetch logic below when backend API integration is required.
 */
export async function sendChatMessage(prompt: string): Promise<ChatMessage> {
  /*
  // UNCOMMENT WHEN BACKEND API IS READY:
  try {
    const res = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: data.response || data.message || 'Analysis complete.',
        timestamp: new Date().toLocaleTimeString(),
        sqlQuery: data.sqlQuery,
      };
    }
  } catch (err) {
    console.warn('Backend Chat endpoint error, using static fallback:', err);
  }
  */

  // Return static assistant response with ClickHouse SQL tool query
  return {
    id: `msg-${Date.now()}`,
    sender: 'assistant',
    text: `Static Response for: "${prompt}". Evaluated ClickHouse ad_events dictionaries for Apps, Advertisers, and Geo-Device dimensions. The primary metric delta is concentrated on iOS 17.5 in US-East region.`,
    timestamp: new Date().toLocaleTimeString(),
    sqlQuery: `SELECT device_model, count(), sum(is_filled)/count() as fill_rate FROM ad_events WHERE event_time >= '2026-08-01 14:00:00' GROUP BY device_model ORDER BY fill_rate ASC LIMIT 5;`,
  };
}
