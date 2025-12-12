# Co-Op Backend

Enterprise-grade NestJS backend with LLM Council architecture, Supabase Auth, Drizzle ORM, and Upstash Redis.

## Tech Stack

- **Framework**: NestJS 11
- **Language**: TypeScript 5.6
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (Neon)
- **Cache/Queue**: Upstash Redis + BullMQ
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **LLM**: Multi-provider Council (Groq, Google AI, HuggingFace)
- **Web Research**: Google Gemini with Search Grounding
- **Validation**: class-validator + Zod
- **Documentation**: Swagger/OpenAPI
- **Hosting**: Render (Docker)

## Features

- **LLM Council**: Mandatory cross-critique between models for accuracy
- **4 Domain Agents**: Legal, Finance, Investor, Competitor
- **A2A Communication**: Agent-to-Agent task delegation
- **MCP Server**: Expose agents as MCP tools for external clients
- **Multi-Agent Queries**: Query multiple agents in parallel
- **Web Research**: Real-time grounded search via Google Gemini
- **Concise Outputs**: Bullet points, no fluff, token-efficient
- **RAG Integration**: Semantic search with external RAG service
- **BullMQ Queues**: Async task processing with SSE streaming

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your credentials

# Push database schema
npm run db:push

# Start development server
npm run dev
```

## LLM Council Architecture

Mandatory cross-critique between models:

1. **Generate**: 2-5 LLMs independently respond (concise, bullet points)
2. **Shuffle**: Responses anonymized
3. **Critique**: Each model critiques others (MANDATORY - fails if no critiques)
4. **Score**: 1-10 rating with strengths/weaknesses
5. **Synthesize**: Best response improved based on feedback

### Available Models (7 diverse families)

| Provider | Model | Family |
|----------|-------|--------|
| Groq | Llama 3.3 70B | Meta Llama |
| Groq | Llama 4 Scout | Meta Llama 4 |
| Groq | Qwen 3 32B | Alibaba Qwen |
| Groq | Kimi K2 | Moonshot |
| Google | Gemini 1.5 Flash | Google Gemini |
| HuggingFace | Mistral 7B | Mistral AI |
| HuggingFace | Phi-3 Mini | Microsoft Phi |

All models verified working Dec 2025.

## Environment Variables

See `.env.example` for full documentation. Key variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anon key | Yes |
| `UPSTASH_REDIS_URL` | Upstash Redis REST URL | Yes |
| `UPSTASH_REDIS_TOKEN` | Upstash Redis token | Yes |
| `UPSTASH_REDIS_HOST` | Upstash Redis host (BullMQ) | Yes |
| `UPSTASH_REDIS_PASSWORD` | Upstash Redis password | Yes |
| `GROQ_API_KEY` | Groq API key | At least 1 LLM |
| `GOOGLE_AI_API_KEY` | Google AI key (also enables research) | At least 1 LLM |
| `HUGGINGFACE_API_KEY` | HuggingFace API key | At least 1 LLM |

## Scripts

```bash
npm run dev          # Start dev server (watch mode)
npm run build        # Build for production
npm run start:prod   # Start production server
npm run lint         # Run ESLint
npm run db:push      # Push schema to database
npm run db:studio    # Open Drizzle Studio
```

## Deployment

### Render (Recommended)

**Option 1: Blueprint (Automatic)**
1. Push code to GitHub/GitLab
2. Go to Render Dashboard → Blueprints → New Blueprint Instance
3. Connect repo and select `render.yaml`
4. Configure environment variables (marked `sync: false`)
5. Deploy

**Option 2: Manual**
1. Create new Web Service on Render
2. Connect your repository
3. Settings:
   - Runtime: Docker
   - Dockerfile Path: `./Dockerfile`
   - Health Check: `/api/v1/health`
4. Add all environment variables from `.env.example`
5. Deploy

### Docker (Local/Self-hosted)

```bash
# Build image
docker build -t co-op-backend .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e SUPABASE_URL="..." \
  -e UPSTASH_REDIS_URL="..." \
  co-op-backend
```

### Required External Services

| Service | Purpose | Free Tier |
|---------|---------|-----------|
| [Neon](https://neon.tech) | PostgreSQL database | Yes |
| [Supabase](https://supabase.com) | Auth & Storage | Yes |
| [Upstash](https://upstash.com) | Redis (cache + queues) | Yes |
| [Groq](https://console.groq.com) | LLM inference | Yes |
| [Google AI](https://aistudio.google.com) | Gemini + Research | Yes |
| [HuggingFace](https://huggingface.co) | LLM inference | Yes |

## API Endpoints

### Health & Metrics
- `GET /api/v1/health` - Health check
- `GET /api/v1/metrics` - Prometheus metrics

### Users & Onboarding
- `GET /api/v1/users/me` - Get current user
- `GET /api/v1/users/me/onboarding-status` - Check onboarding
- `POST /api/v1/users/me/onboarding` - Complete onboarding
- `PATCH /api/v1/users/me/startup` - Update startup

### Sessions
- `POST /api/v1/sessions` - Create session
- `GET /api/v1/sessions` - List sessions
- `GET /api/v1/sessions/:id/messages` - Get messages

### Agents
- `POST /api/v1/agents/run` - Run agent (sync)
- `POST /api/v1/agents/queue` - Queue agent (async)
- `GET /api/v1/agents/tasks/:taskId` - Get task status
- `GET /api/v1/agents/stream/:taskId` - SSE stream

### Notion Integration
- `GET /api/v1/notion/status` - Integration status
- `GET /api/v1/notion/pages` - Search pages
- `POST /api/v1/notion/export` - Export to Notion

### MCP Server (Expose Agents as Tools)
- `GET /api/v1/mcp-server/discover` - List tools + A2A capabilities
- `POST /api/v1/mcp-server/execute` - Execute a tool

Tools:
- `legal_analysis` - Legal advice
- `finance_analysis` - Financial modeling
- `investor_search` - Find investors (web research)
- `competitor_analysis` - Competitive intel (web research)
- `multi_agent_query` - Query multiple agents at once

### Admin
- `POST /api/v1/admin/embeddings/upload` - Upload PDF
- `GET /api/v1/admin/embeddings` - List embeddings

Full API documentation available at `/docs` (Swagger UI).

## Authentication

### User Auth (Supabase)
```
Authorization: Bearer <supabase_access_token>
```

### Service Auth (API Key)
```
X-API-Key: coop_xxxxxxxxxxxxx
```

### MCP Server Auth (Master API Key)
```
X-API-Key: <MASTER_API_KEY>
```

## MCP Server Integration

The backend exposes its AI agents as MCP (Model Context Protocol) tools that can be used by:
- Claude Desktop
- Cursor IDE
- Kiro IDE
- Any MCP-compatible client

### Configuration for Claude Desktop / Cursor

Add to your MCP config:

```json
{
  "mcpServers": {
    "co-op": {
      "command": "curl",
      "args": ["-X", "GET", "https://your-backend.onrender.com/api/v1/mcp-server/discover", "-H", "X-API-Key: your-master-api-key"]
    }
  }
}
```

Or use the HTTP transport directly:
- Discovery: `GET /api/v1/mcp-server/discover`
- Execute: `POST /api/v1/mcp-server/execute`

### Example Tool Calls

Single agent:
```json
{
  "tool": "investor_search",
  "arguments": {
    "prompt": "Seed VCs for AI startups",
    "companyName": "MyStartup",
    "industry": "ai",
    "stage": "seed",
    "country": "US"
  }
}
```

Multi-agent:
```json
{
  "tool": "multi_agent_query",
  "arguments": {
    "prompt": "Prepare for Series A",
    "agents": ["legal", "finance", "investor"],
    "companyName": "MyStartup",
    "industry": "saas",
    "stage": "seed",
    "country": "US"
  }
}
```

## License

MIT
