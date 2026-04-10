import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const MODEL = process.env.JOHNNY_MODEL ?? "johnny";
const COMPRESS_TIMEOUT_MS = 5_000;

function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

async function compress(text: string): Promise<{
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  reductionPercent: number;
  skipped: boolean;
}> {
  const originalTokens = estimateTokens(text);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COMPRESS_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${OLLAMA_BASE_URL.replace(/\/+$/, "")}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, prompt: text, stream: false }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    if (!response.ok) {
      return { compressed: text, originalTokens, compressedTokens: originalTokens, reductionPercent: 0, skipped: true };
    }

    const data = (await response.json()) as { response?: string };
    const compressed = (data.response ?? "").trim().replace(/^["']|["']$/g, "");

    if (!compressed) {
      return { compressed: text, originalTokens, compressedTokens: originalTokens, reductionPercent: 0, skipped: true };
    }

    const compressedTokens = estimateTokens(compressed);
    const reductionPercent =
      originalTokens > 0
        ? Math.max(0, Math.round((1 - compressedTokens / originalTokens) * 100))
        : 0;

    return { compressed, originalTokens, compressedTokens, reductionPercent, skipped: false };
  } catch {
    clearTimeout(timeout);
    return { compressed: text, originalTokens, compressedTokens: originalTokens, reductionPercent: 0, skipped: true };
  }
}

const server = new McpServer({
  name: "johnny",
  version: "0.1.0",
});

server.tool(
  "johnny",
  "Compress verbose text into minimal shorthand tokens using a local Ollama model. Reduces token usage by 60-90%.",
  {
    text: z.string().describe("Verbose text to compress"),
    verbose: z.boolean().optional().describe("Show before/after comparison with token estimates"),
  },
  async ({ text, verbose }) => {
    const result = await compress(text);

    if (verbose) {
      const lines = [
        `--- ORIGINAL (${result.originalTokens} tok est) ---`,
        text,
        "",
        `--- COMPRESSED (${result.compressedTokens} tok est, ${result.reductionPercent}% reduction) ---`,
        result.compressed,
      ];
      if (result.skipped) {
        lines.push("", "(Compression skipped — Ollama unavailable or model missing)");
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    return { content: [{ type: "text", text: result.compressed }] };
  },
);

server.tool(
  "johnny_status",
  "Check if Ollama is running and the johnny model is available.",
  {},
  async () => {
    const lines: string[] = ["Johnny Health Check", ""];

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3_000);
      const response = await fetch(`${OLLAMA_BASE_URL.replace(/\/+$/, "")}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        lines.push(`  Ollama:  error (HTTP ${response.status})`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      }

      lines.push(`  Ollama:  running (${OLLAMA_BASE_URL})`);

      const data = (await response.json()) as { models?: Array<{ name?: string }> };
      const models = data.models ?? [];
      const found = models.some((m) => {
        const name = m.name ?? "";
        return name === MODEL || name.startsWith(`${MODEL}:`);
      });

      if (found) {
        lines.push(`  Model:   ${MODEL} (found)`);
        lines.push("");
        lines.push("  Status:  healthy");
      } else {
        lines.push(`  Model:   ${MODEL} (not found)`);
        lines.push("");
        lines.push("  Fix: ollama create johnny -f core/Modelfile");
      }
    } catch (err) {
      lines.push(`  Ollama:  not reachable (${OLLAMA_BASE_URL})`);
      lines.push(`           ${err instanceof Error ? err.message : String(err)}`);
      lines.push("");
      lines.push("  Fix: install Ollama (https://ollama.com) and run: ollama serve");
    }

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[johnny] model=${MODEL} ollama=${OLLAMA_BASE_URL}`);
