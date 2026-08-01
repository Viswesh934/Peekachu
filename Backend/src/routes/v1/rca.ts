import { FastifyInstance } from 'fastify'
import { Settings } from 'llamaindex'
import { trace } from '@opentelemetry/api'
import { traceRCAInvestigation } from '../../services/langfuseRcaService.js'
import { getClickHouseService } from '../../services/clickhouse.js'
import { generateTextEmbedding } from '../../services/embeddingService.js'

export default async function rcaRoutes(fastify: FastifyInstance) {
  // Analyze endpoint connecting Fastify -> Go RCA Engine -> DeepSeek Narrator -> Telemetry
  fastify.post('/analyze', async (request, reply) => {
    const { metric, window_start, window_end } = (request.body as any) || {}
    const startTime = Date.now()

    // Enrich active OpenTelemetry trace span with InMobi RCA request attributes
    const activeSpan = trace.getActiveSpan()
    if (activeSpan) {
      activeSpan.setAttribute('inmobi.metric', metric || 'revenue')
      activeSpan.setAttribute('inmobi.engine_stage', 'rca_analyze')
      activeSpan.setAttribute('service.name', 'peekachu-rca-backend')
      if (window_start) activeSpan.setAttribute('inmobi.window_start', window_start)
      if (window_end) activeSpan.setAttribute('inmobi.window_end', window_end)
    }

    try {
      const enginePort = process.env.RCA_ENGINE_PORT || '8082'
      const goEngineUrl = process.env.RCA_ENGINE_URL || `http://localhost:${enginePort}/analyze`
      reqLogInfo(fastify, `Delegating RCA calculation to Go Engine at ${goEngineUrl}...`)

      const rcaRes = await fetch(goEngineUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: metric || 'revenue',
          window_start,
          window_end,
        }),
      })

      if (!rcaRes.ok) {
        const errText = await rcaRes.text()
        reply.status(rcaRes.status)
        return { error: `Go RCA Engine returned error ${rcaRes.status}: ${errText}` }
      }

      const evidence = await rcaRes.json()

      if (activeSpan && evidence) {
        const topSeg = evidence.top_contributing_segments?.[0];
        if (topSeg) {
          activeSpan.setAttribute('inmobi.top_segment', `${topSeg.dimension}=${topSeg.value}`);
          activeSpan.setAttribute('inmobi.share_of_delta', topSeg.share_of_delta);
        }
        if (evidence.factor_decomposition?.primary_driver_factor) {
          activeSpan.setAttribute('inmobi.primary_driver', evidence.factor_decomposition.primary_driver_factor);
        }
        if (evidence.z_score !== undefined) {
          activeSpan.setAttribute('inmobi.z_score', evidence.z_score);
        }
      }

      // 2. Generate LLM Narration using DeepSeek via LlamaIndex Settings.llm
      let diagnosis = ''
      let promptText = ''

      if (Settings.llm) {
        promptText = `
You are an automated Root Cause Analysis narrator for an ad-tech platform (InMobi).
You are given a JSON evidence bundle produced by a deterministic ClickHouse analytical engine:

${JSON.stringify(evidence, null, 2)}

INSTRUCTIONS:
1. Write a 3-4 sentence plain-language diagnosis explaining why the metric moved.
2. State the metric name, time window, baseline vs current value, and percent change.
3. State the primary revenue identity factor driver and name the top contributing segment(s) with their share of delta.
4. Mention at least one item from the 'ruled_out' list that was checked and cleared.
5. STRICT RULE: Every number you state MUST appear verbatim in the JSON evidence bundle. Do not compute, estimate, or round differently.
`

        try {
          const llmRes = await Settings.llm.complete({ prompt: promptText })
          diagnosis = llmRes.text
        } catch (llmErr) {
          fastify.log.error(llmErr, 'LLM narration error')
          diagnosis = generateFallbackDiagnosis(evidence)
        }
      } else {
        diagnosis = generateFallbackDiagnosis(evidence)
      }

      const totalLatencyMs = Date.now() - startTime

      // 3. Emit hierarchical Trace & Scores if Langfuse service is configured
      let telemetryResult: any = null
      try {
        telemetryResult = await traceRCAInvestigation({
          metric: metric || evidence.metric || 'revenue',
          window_start,
          window_end,
          evidence,
          diagnosisText: diagnosis,
          promptText,
          llmModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
          totalLatencyMs,
        })
      } catch (tErr) {
        fastify.log.warn('Langfuse telemetry trace skipped/unreachable')
      }

      return {
        diagnosis,
        evidence,
        execution_time_ms: evidence.execution_time_ms || totalLatencyMs,
        ...(telemetryResult ? {
          langfuse: {
            traceId: telemetryResult.traceId,
            traceUrl: telemetryResult.traceUrl,
            faithfulnessScore: telemetryResult.faithfulnessScore,
            hallucinationDetected: telemetryResult.hallucinationDetected,
            status: 'traced',
          }
        } : {})
      }
    } catch (err: any) {
      console.error('RCA ANALYZE ERROR CAUSE:', err?.cause || err)
      fastify.log.error('RCA analyze endpoint failed:', err)
      reply.status(500)
      const causeDetails = err?.cause ? ` (cause: ${err.cause.message || err.cause.code || JSON.stringify(err.cause)})` : '';
      return { error: `RCA analysis failed: ${err.message || err}${causeDetails}` }
    }
  })

  // Get detected anomalies stream
  fastify.get('/detect', async (request, reply) => {
    try {
      const metric = (request.query as any)?.metric
      const enginePort = process.env.RCA_ENGINE_PORT || '8082'
      const defaultDetectUrl = `http://localhost:${enginePort}/detect${metric ? `?metric=${encodeURIComponent(metric)}` : ''}`
      const goDetectUrl = process.env.RCA_ENGINE_DETECT_URL || defaultDetectUrl
      const res = await fetch(goDetectUrl)
      if (!res.ok) {
        reply.status(res.status)
        return { error: 'Failed to fetch detected anomalies from Go Engine' }
      }
      return await res.json()
    } catch (err: any) {
      reply.status(500)
      const target = process.env.RCA_ENGINE_DETECT_URL || `http://127.0.0.1:${process.env.RCA_ENGINE_PORT || '8082'}/detect`
      return { error: `fetch failed trying to connect to ${target}: ${err.message || err}` }
    }
  })

  // Approve finding and store vector embeddings + metadata into ClickHouse
  fastify.post('/approve', async (request, reply) => {
    const {
      id,
      metric = 'revenue',
      title,
      diagnosisText,
      window_start,
      window_end,
      baseline_value,
      current_value,
      pct_change,
      z_score,
      evidence,
      reviewedBy = 'Umesh (AdOps Lead)',
    } = (request.body as any) || {}

    try {
      const chService = getClickHouseService()

      // Create approved_rca_embeddings table storing vector embeddings in ClickHouse
      await chService.exec(`
        CREATE TABLE IF NOT EXISTS approved_rca_embeddings (
          id String,
          metric String,
          title String,
          summary String,
          embedding Array(Float32),
          metadata String,
          created_at DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        ORDER BY (metric, id);
      `)

      const summaryText = `${title || 'Approved Anomaly'}. Metric: ${metric}. Window: ${window_start} to ${window_end}. Baseline: ${baseline_value}, Current: ${current_value}, Pct Change: ${pct_change}%, Z-Score: ${z_score}. Diagnosis: ${diagnosisText}`
      
      // Generate 384-dim float vector embedding for the finding
      const vector = await generateTextEmbedding(summaryText)

      const metadataObj = {
        window_start,
        window_end,
        baseline_value,
        current_value,
        pct_change,
        z_score,
        evidence: evidence || {},
        reviewed_by: reviewedBy,
      }

      // Insert vector embedding record into ClickHouse
      await chService.insert('approved_rca_embeddings', [
        {
          id: id || `INC-${Date.now()}`,
          metric: String(metric),
          title: String(title || 'Approved Anomaly Finding'),
          summary: String(summaryText),
          embedding: vector,
          metadata: JSON.stringify(metadataObj),
        },
      ])

      fastify.log.info(`Approved RCA finding vector embedding stored in ClickHouse table 'approved_rca_embeddings': ${id}`)

      return {
        success: true,
        stored_in_clickhouse: true,
        table: 'approved_rca_embeddings',
        vector_dim: vector.length,
        id,
      }
    } catch (err: any) {
      fastify.log.warn(`Failed to store approved vector in ClickHouse table: ${err.message}`)
      return {
        success: true,
        stored_in_clickhouse: false,
        warning: err.message,
        id,
      }
    }
  })
}

function generateFallbackDiagnosis(evidence: any): string {
  const topSeg = evidence.top_contributing_segments?.[0]
  const segInfo = topSeg ? ` driven primarily by ${topSeg.dimension} '${topSeg.value}' (share of delta: ${(topSeg.share_of_delta * 100).toFixed(1)}%).` : '.'
  return `${evidence.metric} moved from baseline ${evidence.baseline_value} to ${evidence.current_value} (${evidence.pct_change}% change)${segInfo}`
}

function reqLogInfo(fastify: FastifyInstance, msg: string) {
  fastify.log.info(msg)
}
