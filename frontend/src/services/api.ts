import { AnomalyIncident, ChatMessage, FactorDecomposition, LangfuseTelemetry, RCAEvidence } from '../types';
import { INITIAL_ANOMALIES } from './mockData';

const BACKEND_BASE_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) || '/api';
const DEFAULT_METRIC = 'revenue';

type BackendDetectRecord = {
  timestamp: string;
  metric: string;
  current_value: number;
  baseline_value: number;
  z_score: number;
  pct_change: number;
};

type BackendRcaResponse = {
  diagnosis?: string;
  evidence: RCAEvidence;
  execution_time_ms?: number;
  langfuse?: LangfuseTelemetry;
};

type SupportedMetric = {
  id: string;
  label: string;
  description: string;
  aliases: string[];
  isRatio: boolean;
};

type MetricsResponse = {
  default_metric: string;
  data: SupportedMetric[];
};

function formatTimestamp(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : new Date().toISOString();
  }
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function hourLater(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return new Date(date.getTime() + 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

function severityFromRca(evidence: RCAEvidence): AnomalyIncident['severity'] {
  const magnitude = Math.max(Math.abs(evidence.z_score), Math.abs(evidence.pct_change));
  if (magnitude >= 25 || Math.abs(evidence.z_score) >= 3.5) return 'CRITICAL';
  if (magnitude >= 10 || Math.abs(evidence.z_score) >= 3.0) return 'MAJOR';
  return 'WARNING';
}

function titleFromEvidence(evidence: RCAEvidence): string {
  const direction = evidence.pct_change >= 0 ? 'Surge' : 'Drop';
  return `${evidence.metric.toUpperCase()} ${direction} (${evidence.pct_change >= 0 ? '+' : ''}${evidence.pct_change.toFixed(1)}%)`;
}

function toAnomalyIncident(
  evidence: RCAEvidence,
  diagnosisText: string,
  langfuse?: LangfuseTelemetry,
  idOverride?: string
): AnomalyIncident {
  const windowStart = evidence.window_start;
  const windowEnd = evidence.window_end || hourLater(windowStart);
  return {
    id: idOverride || `INC-${windowStart}-${evidence.metric}`,
    title: titleFromEvidence(evidence),
    metric: evidence.metric,
    severity: severityFromRca(evidence),
    timestamp: `${formatTimestamp(windowStart)} UTC`,
    window_start: windowStart,
    window_end: windowEnd,
    z_score: evidence.z_score,
    baseline_value: evidence.baseline_value,
    current_value: evidence.current_value,
    pct_change: evidence.pct_change,
    evidence,
    diagnosisText,
    langfuse,
    humanReview: {
      status: 'PENDING',
    },
  };
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Backend request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchSupportedMetrics(): Promise<MetricsResponse> {
  try {
    return await fetchJson<MetricsResponse>('/v1/metrics');
  } catch (err) {
    console.warn('Backend metrics endpoint unavailable, using default revenue-only contract.', err);
    return { default_metric: DEFAULT_METRIC, data: [{ id: 'revenue', label: 'Revenue', description: 'Money earned on impressions.', aliases: ['revenue'], isRatio: false }] };
  }
}

export async function fetchAnomalies(): Promise<AnomalyIncident[]> {
  try {
    const detectResult = await fetchJson<BackendDetectRecord[] | BackendDetectRecord>('/detect?metric=revenue');
    const records = Array.isArray(detectResult) ? detectResult : [detectResult];

    const topRecord = records[0];
    if (!topRecord) {
      return INITIAL_ANOMALIES;
    }

    const analysis = await triggerRcaAnalysis(topRecord.metric || 'revenue', formatTimestamp(topRecord.timestamp), hourLater(formatTimestamp(topRecord.timestamp)));
    return [analysis];
  } catch (err) {
    console.warn('Backend detect/analyze unavailable, using static mock data:', err);
    return INITIAL_ANOMALIES;
  }
}

export async function triggerRcaAnalysis(metric: string, windowStart?: string, windowEnd?: string): Promise<AnomalyIncident> {
  try {
    const result = await fetchJson<BackendRcaResponse>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ metric, window_start: windowStart, window_end: windowEnd }),
    });

    const diagnosisText = result.diagnosis || 'Analysis complete.';
    return toAnomalyIncident(result.evidence, diagnosisText, result.langfuse);
  } catch (err) {
    console.warn('Backend RCA endpoint unavailable, using static fallback:', err);
    const found = INITIAL_ANOMALIES.find((a) => a.metric === metric) || INITIAL_ANOMALIES[0];
    return found;
  }
}

export async function sendChatMessage(prompt: string): Promise<ChatMessage> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], model: 'deepseek-chat', stream: false }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || data?.message?.content || data?.response || 'Analysis complete.';
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text,
        timestamp: new Date().toLocaleTimeString(),
      };
    }
  } catch (err) {
    console.warn('Backend Chat endpoint unavailable, using static fallback:', err);
  }

  return {
    id: `msg-${Date.now()}`,
    sender: 'assistant',
    text: `Static Response for: "${prompt}". Evaluated ClickHouse ad_events dictionaries for the current revenue RCA context.`,
    timestamp: new Date().toLocaleTimeString(),
    sqlQuery: `SELECT sum(revenue) AS revenue, sum(is_filled) / nullIf(count(), 0) AS fill_rate FROM ad_events WHERE event_time >= '2026-08-01 14:00:00' GROUP BY toStartOfHour(event_time);`,
  };
}
