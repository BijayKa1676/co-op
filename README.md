<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/NestJS-11-red?logo=nestjs" alt="NestJS">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen" alt="PRs Welcome">
</p>

<h1 align="center">Co-Op</h1>

<p align="center">
  <strong>AI-Powered Advisory Platform for Startups</strong>
</p>

<p align="center">
  Expert guidance across legal, finance, investor relations, and competitive analysis.<br/>
  Powered by a multi-model LLM Council architecture.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#api">API</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## The Problem

Early-stage founders need expert advice across multiple domains but lack resources to hire specialists:

- **Expensive consultants** — $300-500/hour for quality advice
- **Generic AI chatbots** — Lack domain expertise and context
- **Fragmented tools** — Different platforms for different needs

## The Solution

Co-Op provides an AI advisory board that understands your startup's context:

| Agent | Expertise |
|-------|-----------|
| **Legal** | Corporate structure, IP, compliance, contracts |
| **Finance** | Financial modeling, metrics, runway, valuation |
| **Investor** | VC matching, pitch optimization, fundraising |
| **Competitor** | Market landscape, positioning, intelligence |

---

## Features

### 🤖 LLM Council Architecture

Multiple AI models collaborate and critique each other's responses:

```
Question → [Llama 3.3] ──┐
          [GPT OSS]   ───┼──→ Cross-Critique → Synthesize → Final Response
          [Gemini 3]  ───┤
          [DeepSeek]  ───┘
```

- Reduces hallucinations through cross-validation
- Combines strengths of different model architectures
- Provides confidence scores based on consensus

### 🔗 A2A Protocol (Agent-to-Agent)

Complex questions trigger multi-agent collaboration:

```
"I'm building a fintech app. What do I need to know?"

[Legal]     → Regulatory requirements
[Finance]   → Unit economics, compliance costs
[Investor]  → Fintech-focused VCs
[Competitor]→ Market landscape
         ↓
    Cross-validation & synthesis
```

### 🔌 MCP Server

IDE integration via Model Context Protocol:

```json
{
  "tools": ["legal_analysis", "finance_analysis", "investor_search", "competitor_analysis"]
}
```

### 📡 Webhooks & API Keys

- Real-time event notifications
- Scoped API access control
- HMAC signature verification

### 📚 RAG Knowledge Base

- Lazy-loading document retrieval
- Sector-specific legal and finance documents
- Automatic vector cleanup

### 📝 Notion Integration

Export agent insights directly to your workspace.

---

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+ (for RAG service)
- PostgreSQL (or Neon account)
- Redis (or Upstash account)
- Supabase project

### 1. Clone & Setup

```bash
git clone https://github.com/Afnanksalal/co-op.git
cd co-op
```

### 2. Backend

```bash
cd Backend
cp .env.example .env
# Edit .env with your credentials
npm install
npm run db:push
npm run dev
```

### 3. Frontend

```bash
cd Frontend
cp .env.example .env.local
# Edit .env.local with your credentials
npm install
npm run dev
```

### 4. RAG Service (Optional)

```bash
cd RAG
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                    Next.js 14 (Vercel)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│                    NestJS 11 (Render)                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Agent Orchestrator                     │    │
│  │  [Legal] [Finance] [Investor] [Competitor]              │    │
│  │              ↓                                          │    │
│  │         LLM Council                                     │    │
│  │  [Llama] [GPT OSS] [Gemini] [DeepSeek]                  │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────────┐          ┌─────────────────────────────────┐
│    RAG Service      │          │         Data Layer              │
│  FastAPI (Koyeb)    │          │  PostgreSQL (Neon)              │
│  Upstash Vectors    │          │  Redis (Upstash)                │
└─────────────────────┘          │  Supabase (Auth + Storage)      │
                                 └─────────────────────────────────┘
```

---

## Project Structure

```
co-op/
├── Backend/           # NestJS API server
│   ├── src/
│   │   ├── modules/   # Feature modules
│   │   ├── common/    # Shared services (LLM, RAG, cache)
│   │   └── database/  # Drizzle ORM schemas
│   └── README.md
│
├── Frontend/          # Next.js web application
│   ├── src/
│   │   ├── app/       # App Router pages
│   │   ├── components/# UI components
│   │   └── lib/       # Utilities, hooks, API client
│   └── README.md
│
├── RAG/               # Document retrieval service
│   ├── app/           # FastAPI application
│   └── README.md
│
└── README.md          # This file
```

---

## Deployment

### Production URLs

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | Deploy from GitHub |
| Backend | Render | `https://co-op-80fi.onrender.com` |
| RAG | Koyeb | `https://apparent-nanice-afnan-3cac971c.koyeb.app` |

### Infrastructure

| Component | Provider |
|-----------|----------|
| Database | Neon (PostgreSQL) |
| Cache | Upstash (Redis) |
| Queue | Upstash (QStash) |
| Vectors | Upstash |
| Auth | Supabase |
| Storage | Supabase |

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Afnanksalal/co-op&project-name=co-op&root-directory=Frontend)

---

## API

### Authentication

```bash
# Bearer token (Supabase JWT)
curl -H "Authorization: Bearer <jwt>" \
  https://co-op-80fi.onrender.com/api/v1/users/me

# API key
curl -H "X-API-Key: <key>" \
  https://co-op-80fi.onrender.com/api/v1/agents/run
```

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/users/onboarding` | POST | Complete startup profile |
| `/sessions` | POST | Create advisory session |
| `/agents/run` | POST | Run agent query |
| `/agents/queue` | POST | Queue async agent job |
| `/webhooks` | CRUD | Manage webhooks |
| `/api-keys` | CRUD | Manage API keys |

See [Backend README](./Backend/README.md) for full API documentation.

---

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- TypeScript 5
- Tailwind CSS 3.4
- Radix UI
- Zustand
- Framer Motion

### Backend
- NestJS 11
- TypeScript 5
- Drizzle ORM
- QStash

### RAG Service
- FastAPI
- Upstash Vector
- Gemini Embeddings

### LLM Providers
- Groq (Llama 3.3 70B, GPT OSS 120B)
- Google AI (Gemini 3 Pro)
- HuggingFace (DeepSeek R1 32B)

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./Backend/CONTRIBUTING.md) for guidelines.

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/co-op.git

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and commit
git commit -m 'Add amazing feature'

# Push and create PR
git push origin feature/amazing-feature
```

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

<p align="center">
  Built with ❤️ for founders, by founders
</p>

<p align="center">
  <a href="https://github.com/Afnanksalal/co-op">GitHub</a> •
  <a href="https://github.com/Afnanksalal/co-op/issues">Issues</a> •
  <a href="https://github.com/Afnanksalal/co-op/discussions">Discussions</a>
</p>
