import { FastifyInstance } from "fastify";
import { VectorStoreIndex, Settings } from "llamaindex";
import { getIndex } from "../../services/llamaIndex.js";
import { getClickHouseService } from "../../services/clickhouse.js";
import { getClickHouseMCPLLMClient } from "../../clickhouseMcpClient.js";
import { DEFAULT_METRIC, detectMetricFromText } from "../../data/metrics.js";

export default async function chatRoutes(fastify: FastifyInstance) {
  // Chat completions endpoint supporting ad-hoc ClickHouse MCP queries
  fastify.post("/v1/chat/completions", async (request, reply) => {
    const { messages, stream, model } = (request.body as any) || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      reply.status(400);
      return { error: "Invalid request body: 'messages' array is required." };
    }

    // Get the last user message
    const userMessages = messages.filter((m: any) => m.role === "user");
    let queryText = "";
    const lastUserContent = userMessages[userMessages.length - 1]?.content;

    if (typeof lastUserContent === "string") {
      queryText = lastUserContent;
    } else if (Array.isArray(lastUserContent)) {
      const textPart = lastUserContent.find((p: any) => p.type === "text" || p.text);
      queryText = textPart?.text || "";
    }

    if (!queryText) {
      reply.status(400);
      return { error: "No user query found in messages history." };
    }

    const requestedMetric = detectMetricFromText(queryText) || DEFAULT_METRIC;

    try {
      const chService = getClickHouseService();
      let dbContext = "";
      let approvedFindingsContext = "";

      // Query approved RCA findings stored in ClickHouse
      try {
        const approvedRows = await chService.query<any>(
          "SELECT id, metric, title, diagnosis, window_start, window_end, baseline_value, current_value, pct_change, z_score, reviewed_by, reviewed_at FROM approved_rca_findings ORDER BY reviewed_at DESC LIMIT 5"
        );
        if (approvedRows && approvedRows.length > 0) {
          approvedFindingsContext = `\n\nApproved RCA Findings in ClickHouse (Human Verified):\n` +
            approvedRows.map((r: any) => 
              `- [ID: ${r.id}] Metric: ${r.metric}, Title: "${r.title}", Window: ${r.window_start} to ${r.window_end}, Baseline: ${r.baseline_value}, Current: ${r.current_value}, Change: ${r.pct_change}%, Z-Score: ${r.z_score}. Verified by ${r.reviewed_by} at ${r.reviewed_at}. Diagnosis: ${r.diagnosis}`
            ).join("\n");
        }
      } catch (apErr) {
        // Table may not exist yet or no findings stored
      }

      // Check if query is asking for anomaly verification or ClickHouse database context
      const queryLower = queryText.toLowerCase();
      const isVerificationQuery =
        queryLower.includes("verify") ||
        queryLower.includes("validate") ||
        queryLower.includes("confirm") ||
        queryLower.includes("spike") ||
        queryLower.includes("anomaly") ||
        queryLower.includes("root cause") ||
        queryLower.includes("rca");

      if (
        isVerificationQuery ||
        queryLower.includes("table") ||
        queryLower.includes("ad_events") ||
        queryLower.includes("count") ||
        queryLower.includes("select") ||
        queryLower.includes("revenue") ||
        queryLower.includes("fill rate") ||
        queryLower.includes("ecpm") ||
        queryLower.includes("query") ||
        queryLower.includes("app") ||
        queryLower.includes("device") ||
        queryLower.includes("mcp")
      ) {
        try {
          const mcpClient = getClickHouseMCPLLMClient();
          const mcpTools = await mcpClient.listTools();
          const toolNames = mcpTools.map((t: any) => t.name).join(", ");
          const tables = await chService.listTables("default");
          const tableNames = tables.map((t) => t.name).join(", ");

          dbContext = `ClickHouse MCP Server active tools: [${toolNames}]. Tables: [${tableNames}]. Dictionaries: [apps_dict, advertisers_dict, geo_device_dict].`;
        } catch (dbErr) {
          console.warn("ClickHouse MCP / Service schema list warning:", dbErr);
        }
      }

      const index = getIndex();

      if (!index && Settings.llm) {
        console.log(`DeepSeek LLM chat turn with ClickHouse context: "${queryText}"`);

        const now = new Date();
        const formatClickHouseDateTime = (date: Date) =>
          date.toISOString().slice(0, 19).replace("T", " ");

        const windowEnd = formatClickHouseDateTime(now);

        const windowStartDate = new Date(now);
        windowStartDate.setHours(windowStartDate.getHours() - 24);
        const windowStart = formatClickHouseDateTime(windowStartDate);

        const baselineStartDate = new Date(windowStartDate);
        baselineStartDate.setHours(baselineStartDate.getHours() - 24);
        const baselineStart = formatClickHouseDateTime(baselineStartDate);
        const baselineEnd = windowStart;

        const verificationInstruction = isVerificationQuery
          ? `
SPECIAL INSTRUCTION:

The user is asking to verify a revenue metric anomaly using the latest available data.

Current analysis time: ${windowEnd} UTC

Current anomaly window:
[${windowStart}, ${windowEnd})

Baseline comparison window:
[${baselineStart}, ${baselineEnd})

Use ClickHouse to verify the anomaly from the underlying data.

1. Compare baseline vs current window using:
   - sum(revenue) AS revenue
   - count() AS requests
   - sum(is_filled) / count() AS fill_rate
   - avg(ecpm) AS ecpm

2. Break down the revenue change by relevant dimensions including:
   - campaign_type
   - publisher_tier
   - ad_format
   - region

3. Calculate contribution/delta shares from the actual ClickHouse results.
Do NOT assume previously observed percentages such as CPM 46.2%, tier_2 46.1%,
banner 34.8%, NAM 29.9%, or APAC 28.4%.

4. Determine whether the anomaly is primarily caused by:
   - traffic/request volume
   - fill rate
   - eCPM
   - segment mix
   - or another measurable factor.

5. Do NOT assume eCPM was ruled out.
Calculate its actual percentage change from ClickHouse.

Use half-open time ranges:
event_time >= start AND event_time < end.

Show the ClickHouse SQL used and base conclusions only on query results.
`
          : "";

        const prompt = `System Context: You are an AdTech RCA assistant connected to ClickHouse Cloud. ${dbContext}${approvedFindingsContext}

${verificationInstruction}

TIME RULES:
- Treat ClickHouse event_time as UTC.
- Use ClickHouse now() as the authoritative current time.
- Use half-open intervals: >= start AND < end.
- Never assume a historical anomaly window unless the user explicitly specifies one.
- When the user says "today", derive today from ClickHouse time.
- When the user says "current", "latest", or "now", query the latest available data.

Primary metric: revenue. Default metric: ${requestedMetric}.

User Question: ${queryText}`;

        const llmResponse = await Settings.llm.complete({ prompt });
        const contentText = llmResponse.text;

        if (stream) {
          reply.raw.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
          });
          const chunkId = `chatcmpl-${Date.now()}`;
          reply.raw.write(
            `data: ${JSON.stringify({
              id: chunkId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: model || "deepseek-chat",
              choices: [{ index: 0, delta: { content: contentText }, finish_reason: null }],
            })}\n\n`
          );
          reply.raw.write(
            `data: ${JSON.stringify({
              id: chunkId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: model || "deepseek-chat",
              choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            })}\n\n`
          );
          reply.raw.write("data: [DONE]\n\n");
          reply.raw.end();
          return;
        } else {
          return reply.send({
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: model || "deepseek-chat",
            choices: [
              { index: 0, message: { role: "assistant", content: contentText }, finish_reason: "stop" },
            ],
          });
        }
      }

      // If VectorStoreIndex is initialized
      const queryEngine = (index as VectorStoreIndex).asQueryEngine();
      if (stream) {
        console.log(`Streaming query with LlamaIndex: "${queryText}"`);
        const responseStream = await queryEngine.query({ query: queryText, stream: true });

        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });

        const chunkId = `chatcmpl-${Date.now()}`;
        for await (const chunk of responseStream) {
          const text = chunk.response;
          const dataPayload = {
            id: chunkId,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: model || "deepseek-chat",
            choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
          };
          reply.raw.write(`data: ${JSON.stringify(dataPayload)}\n\n`);
        }

        const finalPayload = {
          id: chunkId,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: model || "deepseek-chat",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        };
        reply.raw.write(`data: ${JSON.stringify(finalPayload)}\n\n`);
        reply.raw.write("data: [DONE]\n\n");
        reply.raw.end();
      } else {
        const result = await queryEngine.query({ query: queryText });
        return reply.send({
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: model || "deepseek-chat",
          choices: [
            { index: 0, message: { role: "assistant", content: result.response }, finish_reason: "stop" },
          ],
        });
      }
    } catch (err: any) {
      console.error("Chat route execution failed:", err);
      reply.status(500);
      return { error: `Error executing query: ${err.message || err}` };
    }
  });
}
