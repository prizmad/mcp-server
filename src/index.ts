#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = process.env.PRIZMAD_BASE_URL ?? "https://prizmad.com";
const API_KEY = process.env.PRIZMAD_API_KEY ?? "";

if (!API_KEY) {
  console.error(
    "Error: PRIZMAD_API_KEY environment variable is required.\n" +
      "Get your API key at https://prizmad.com/api-keys"
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function api(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

function textResult(data: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    isError,
  };
}

function errorResult(status: number, data: unknown) {
  return textResult({ error: true, status, detail: data }, true);
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const server = new McpServer({
  name: "prizmad",
  version: "1.0.0",
});

// ── list_templates ──────────────────────────────────────────────────────────
server.tool(
  "list_templates",
  "List all available video ad templates with features, categories, and token costs. No API key required for this call.",
  {},
  async () => {
    const { ok, status, data } = await api("/api/v1/templates");
    return ok ? textResult(data) : errorResult(status, data);
  }
);

// ── list_avatars ────────────────────────────────────────────────────────────
server.tool(
  "list_avatars",
  "List all AI avatar presets with name, gender, age, image URL, and recommended voice ID. No API key required for this call.",
  {},
  async () => {
    const { ok, status, data } = await api("/api/v1/avatars");
    return ok ? textResult(data) : errorResult(status, data);
  }
);

// ── create_video ────────────────────────────────────────────────────────────
server.tool(
  "create_video",
  "Start generating an AI video ad. Provide a template ID and product data (URL to scrape OR direct product info). Returns a video ID for polling. Costs tokens.",
  {
    templateId: z.string().describe("Template ID from list_templates"),
    productUrl: z
      .string()
      .url()
      .optional()
      .describe("Product page URL to scrape (provide this OR product fields)"),
    productTitle: z
      .string()
      .optional()
      .describe("Product title (if not using productUrl)"),
    productDescription: z
      .string()
      .optional()
      .describe("Product description (if not using productUrl)"),
    productPrice: z.string().optional().describe("Product price"),
    productImages: z
      .array(z.string().url())
      .optional()
      .describe("Product image URLs"),
    language: z
      .string()
      .optional()
      .default("en")
      .describe("Language code: en, es, fr, de, ru, etc."),
    tone: z
      .enum(["energetic", "professional", "friendly", "luxury", "funny"])
      .optional()
      .default("professional"),
    script: z
      .string()
      .optional()
      .describe("Custom voiceover script. If omitted, AI generates one."),
    avatarPresetId: z
      .string()
      .optional()
      .describe("Avatar ID from list_avatars (e.g. 'F01', 'M04')"),
    voiceId: z
      .string()
      .optional()
      .describe("ElevenLabs voice ID. If omitted, uses avatar default."),
    duration: z
      .number()
      .int()
      .min(10)
      .max(60)
      .optional()
      .default(30)
      .describe("Video duration in seconds (10-60)"),
  },
  async (params) => {
    const body: Record<string, unknown> = {
      templateId: params.templateId,
      language: params.language,
      tone: params.tone,
      duration: params.duration,
    };

    if (params.productUrl) {
      body.productUrl = params.productUrl;
    } else if (params.productTitle) {
      body.product = {
        title: params.productTitle,
        description: params.productDescription ?? "",
        price: params.productPrice,
        images: params.productImages,
      };
    }

    if (params.script) body.script = params.script;
    if (params.avatarPresetId) body.avatarPresetId = params.avatarPresetId;
    if (params.voiceId) body.voiceId = params.voiceId;

    const { ok, status, data } = await api("/api/v1/videos", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!ok) return errorResult(status, data);

    return textResult({
      ...(data as object),
      hint: "Use get_video_status to poll until status is 'completed'.",
    });
  }
);

// ── get_video_status ────────────────────────────────────────────────────────
server.tool(
  "get_video_status",
  "Check video generation progress. Poll until status is 'completed' or 'failed'. Returns progress %, steps, and video URL when done.",
  {
    videoId: z.string().uuid().describe("Video ID from create_video"),
  },
  async ({ videoId }) => {
    const { ok, status, data } = await api(`/api/v1/videos/${videoId}`);
    return ok ? textResult(data) : errorResult(status, data);
  }
);

// ── get_download_url ────────────────────────────────────────────────────────
server.tool(
  "get_download_url",
  "Get the direct download URL for a completed video. Only works when status is 'completed'.",
  {
    videoId: z.string().uuid().describe("Video ID"),
  },
  async ({ videoId }) => {
    const { ok, status, data } = await api(`/api/v1/videos/${videoId}`);
    if (!ok) return errorResult(status, data);

    const d = data as Record<string, unknown>;
    if (d.status !== "completed") {
      return textResult(
        {
          error: true,
          message: `Video not ready. Status: ${d.status}, progress: ${d.progress}%`,
        },
        true
      );
    }

    return textResult({
      videoId: d.videoId,
      videoUrl: d.videoUrl,
      downloadUrl: `${BASE_URL}/api/v1/videos/${videoId}/download`,
      thumbnailUrl: d.thumbnailUrl,
    });
  }
);

// ── create_video_batch ──────────────────────────────────────────────────────
server.tool(
  "create_video_batch",
  "Launch up to 20 video generations in parallel. Pre-checks total token cost. Returns individual video IDs for polling.",
  {
    videos: z
      .array(
        z.object({
          templateId: z.string(),
          productUrl: z.string().url().optional(),
          productTitle: z.string().optional(),
          productDescription: z.string().optional(),
          productImages: z.array(z.string().url()).optional(),
          language: z.string().optional().default("en"),
          tone: z
            .enum([
              "energetic",
              "professional",
              "friendly",
              "luxury",
              "funny",
            ])
            .optional()
            .default("professional"),
          avatarPresetId: z.string().optional(),
          duration: z.number().int().min(10).max(60).optional(),
        })
      )
      .min(1)
      .max(20)
      .describe("Array of video creation requests (1-20)"),
    callbackUrl: z
      .string()
      .url()
      .optional()
      .describe("Webhook URL for completion notifications"),
  },
  async ({ videos, callbackUrl }) => {
    const body = {
      videos: videos.map((v) => {
        const item: Record<string, unknown> = {
          templateId: v.templateId,
          language: v.language,
          tone: v.tone,
          duration: v.duration,
        };
        if (v.productUrl) {
          item.productUrl = v.productUrl;
        } else if (v.productTitle) {
          item.product = {
            title: v.productTitle,
            description: v.productDescription ?? "",
            images: v.productImages,
          };
        }
        if (v.avatarPresetId) item.avatarPresetId = v.avatarPresetId;
        return item;
      }),
      callbackUrl,
    };

    const { ok, status, data } = await api("/api/v1/videos/batch", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return ok ? textResult(data) : errorResult(status, data);
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Prizmad MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
