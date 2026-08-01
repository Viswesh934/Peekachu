import { FastifyInstance } from "fastify";
import { VectorStoreIndex, Settings } from "llamaindex";
import { getIndex } from "../../services/llamaIndex.js";
import { getClickHouseService } from "../../services/clickhouse.js";
import { getClickHouseMCPLLMClient } from "../../clickhouseMcpClient.js";

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

    try {
      const index = getIndex();

      // Check if user request requires ClickHouse ad-hoc SQL query execution
      const chService = getClickHouseService();
      let dbContext = "";

      const queryLower = queryText.toLowerCase();
      if (
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
          // Fetch available tools from ClickHouse MCP server over stdio
          const mcpClient = getClickHouseMCPLLMClient();
          const mcpTools = await mcpClient.listTools();
          const toolNames = mcpTools.map((t: any) => t.name).join(", ");

          // Fetch table schema information using ClickHouseService
          const tables = await chService.listTables("default");
          const tableNames = tables.map((t) => t.name).join(", ");

          dbContext = `ClickHouse MCP Server active tools: [${toolNames}]. Tables: [${tableNames}]. Dictionaries: [apps_dict, advertisers_dict, geo_device_dict].`;
        } catch (dbErr) {
          console.warn("ClickHouse MCP / Service schema list warning:", dbErr);
        }
      }

      if (!index && Settings.llm) {
        console.log(`DeepSeek LLM chat turn with ClickHouse context: "${queryText}"`);

        const prompt = dbContext
          ? `System Context: You have access to ClickHouse Cloud database. ${dbContext}\n\nUser Question: ${queryText}`
          : queryText;

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
