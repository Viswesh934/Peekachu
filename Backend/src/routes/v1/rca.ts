import { FastifyInstance } from 'fastify'
import { Settings } from 'llamaindex'

export default async function rcaRoutes(fastify: FastifyInstance) {
  // Analyze endpoint connecting Fastify -> Go RCA Engine -> DeepSeek Narrator
  fastify.post('/analyze', async (request, reply) => {
    const { metric, window_start, window_end } = (request.body as any) || {}

    try {
      // 1. Call Go RCA Engine
      const goEngineUrl = process.env.RCA_ENGINE_URL || 'http://localhost:8081/analyze'
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
        reply.status(502)
        return { error: `Go RCA Engine returned error ${rcaRes.status}: ${errText}` }
      }

      const evidence = await rcaRes.json()

      // 2. Generate LLM Narration using DeepSeek via LlamaIndex Settings.llm
      let diagnosis = ''
      if (Settings.llm) {
        const prompt = `
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
          const llmRes = await Settings.llm.complete({ prompt })
          diagnosis = llmRes.text
        } catch (llmErr) {
          fastify.log.error('LLM narration error:', llmErr)
          diagnosis = generateFallbackDiagnosis(evidence)
        }
      } else {
        diagnosis = generateFallbackDiagnosis(evidence)
      }

      return {
        diagnosis,
        evidence,
        execution_time_ms: evidence.execution_time_ms,
      }
    } catch (err: any) {
      fastify.log.error('RCA analyze endpoint failed:', err)
      reply.status(500)
      return { error: `RCA analysis failed: ${err.message || err}` }
    }
  })

  // Get detected anomalies stream
  fastify.get('/detect', async (request, reply) => {
    try {
      const goDetectUrl = process.env.RCA_ENGINE_DETECT_URL || 'http://localhost:8081/detect'
      const res = await fetch(goDetectUrl)
      if (!res.ok) {
        reply.status(502)
        return { error: 'Failed to fetch detected anomalies from Go Engine' }
      }
      return await res.json()
    } catch (err: any) {
      reply.status(500)
      return { error: err.message }
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
