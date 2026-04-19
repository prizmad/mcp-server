# Prizmad MCP Server

MCP (Model Context Protocol) server for [Prizmad](https://prizmad.com) — create AI-powered UGC video ads from any product URL.

This server lets AI agents (Claude, ChatGPT, Cursor, etc.) generate professional video ads programmatically through the Prizmad API.

## Quick Start

### Option 1: Remote (Streamable HTTP)

Connect directly to the hosted MCP server — no installation needed:

```json
{
  "mcpServers": {
    "prizmad": {
      "url": "https://prizmad.com/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### Option 2: Local (npx)

```json
{
  "mcpServers": {
    "prizmad": {
      "command": "npx",
      "args": ["-y", "@prizmad/mcp-server"],
      "env": {
        "PRIZMAD_API_KEY": "przmad_sk_live_..."
      }
    }
  }
}
```

### Option 3: Local (installed)

```bash
npm install -g @prizmad/mcp-server
```

```json
{
  "mcpServers": {
    "prizmad": {
      "command": "prizmad-mcp",
      "env": {
        "PRIZMAD_API_KEY": "przmad_sk_live_..."
      }
    }
  }
}
```

## Get Your API Key

1. Sign up at [prizmad.com](https://prizmad.com)
2. Go to [API Keys](https://prizmad.com/api-keys)
3. Create a new key (format: `przmad_sk_live_...`)

## Available Tools

| Tool | Description |
|------|-------------|
| `list_templates` | List all video ad templates with features and token costs |
| `list_avatars` | List AI avatar presets with recommended voices |
| `create_video` | Generate a video ad from template + product data |
| `get_video_status` | Poll generation progress until completion |
| `get_download_url` | Get download URL for a completed video |
| `create_video_batch` | Launch up to 20 videos in parallel |

## Example Usage

Once connected, you can ask your AI agent:

> "Create a 30-second video ad for this Amazon product: https://amazon.com/dp/B0EXAMPLE using the personal-pitch template with avatar F01"

The agent will:
1. Call `create_video` with the product URL and template
2. Poll `get_video_status` until done
3. Return the download link via `get_download_url`

## Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `PRIZMAD_API_KEY` | Yes | Your Prizmad API key |
| `PRIZMAD_BASE_URL` | No | API base URL (default: `https://prizmad.com`) |

## Resources

- [Prizmad](https://prizmad.com) — Main site
- [API Documentation](https://prizmad.com/api/docs) — Interactive API docs
- [OpenAPI Spec](https://prizmad.com/openapi.json) — Machine-readable spec
- [MCP Server Card](https://prizmad.com/.well-known/mcp/server-card.json) — Discovery metadata

## License

MIT
