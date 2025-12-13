# Co-Op Frontend Developer Guide

Complete integration guide for the Co-Op backend API. This document covers all endpoints, parameters, and UI requirements.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Environment Setup](#environment-setup)
3. [Authentication](#authentication)
4. [User Onboarding](#user-onboarding)
5. [Sessions & Chat](#sessions--chat)
6. [AI Agents](#ai-agents)
7. [Admin Dashboard](#admin-dashboard)
8. [RAG Document Management](#rag-document-management)
9. [Analytics](#analytics)
10. [MCP Server](#mcp-server)
11. [API Keys](#api-keys)
12. [Webhooks](#webhooks)
13. [Notion Integration](#notion-integration)
14. [TypeScript Types](#typescript-types)
15. [Error Handling](#error-handling)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  React/Next.js  │  Supabase Auth Client  │  API Client                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
┌─────────────────┐       ┌─────────────────────┐       ┌─────────────────┐
│  SUPABASE AUTH  │       │   BACKEND (Render)  │       │  RAG (Koyeb)    │
├─────────────────┤       ├─────────────────────┤       ├─────────────────┤
│ Google OAuth    │       │ NestJS API          │       │ Vector Search   │
│ Email/Password  │       │ LLM Council         │       │ (Legal/Finance) │
│ JWT Tokens      │       │ Web Research        │       │ Lazy Vectorize  │
└─────────────────┘       │ PostgreSQL (Neon)   │       └─────────────────┘
                          │ Redis (Upstash)     │
                          └─────────────────────┘
```

| Service | Purpose | URL |
|---------|---------|-----|
| Backend | Main API | `https://your-backend.onrender.com/api/v1` |
| RAG | Document search | `https://your-rag.koyeb.app` (internal) |
| Supabase | Auth only | `https://your-project.supabase.co` |
| Swagger | API Docs | `https://your-backend.onrender.com/docs` |

---

## Environment Setup

```env
# Supabase (Auth Only)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# Backend API
NEXT_PUBLIC_API_URL="https://your-backend.onrender.com/api/v1"
```


---

## Authentication

### Supabase Client Setup

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

### Auth Functions

```typescript
// lib/auth.ts
import { supabase } from './supabase';

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
}

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string) {
  return supabase.auth.signUp({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
```

### API Client

```typescript
// lib/api-client.ts
import { getAccessToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

class ApiClient {
  private async getHeaders(): Promise<HeadersInit> {
    const token = await getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async get<T>(endpoint: string): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, { headers: await this.getHeaders() });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return json.data;
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return json.data;
  }

  async patch<T>(endpoint: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: await this.getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return json.data;
  }

  async delete(endpoint: string): Promise<void> {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = await getAccessToken();
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    const json = await res.json();
    return json.data;
  }
}

export const api = new ApiClient();
```

### Auth Flow

1. User clicks "Sign in with Google" → `signInWithGoogle()`
2. Supabase redirects to Google → User authenticates
3. Google redirects to `/auth/callback` with code
4. Exchange code for session → Redirect to `/dashboard`
5. Call `GET /users/me` → Backend syncs user to Neon DB
6. If `onboardingCompleted === false` → Redirect to `/onboarding`


---

## User Onboarding

### Check User Status

```typescript
// GET /users/me
const user = await api.get<User>('/users/me');

if (!user.onboardingCompleted) {
  // Redirect to onboarding
}
```

### Onboarding Form Fields

The onboarding form creates the user's startup profile. **IMPORTANT**: The `sector` field determines which RAG documents are used for legal/finance agents.

```typescript
// POST /users/me/onboarding
interface OnboardingData {
  // === FOUNDER INFO (required) ===
  founderName: string;           // "John Doe"
  founderRole: FounderRole;      // Dropdown: ceo, cto, coo, cfo, cpo, founder, cofounder

  // === COMPANY BASICS (required) ===
  companyName: string;           // "Acme Inc"
  description: string;           // Textarea, min 20 chars
  tagline?: string;              // Optional one-liner
  website?: string;              // Optional URL

  // === BUSINESS CLASSIFICATION (required) ===
  industry: Industry;            // Dropdown: saas, fintech, healthtech, etc.
  sector: Sector;                // ⚠️ CRITICAL: fintech, greentech, healthtech, saas, ecommerce
  businessModel: BusinessModel;  // Dropdown: b2b, b2c, b2b2c, marketplace, etc.
  revenueModel?: RevenueModel;   // Optional: subscription, freemium, etc.

  // === COMPANY STAGE (required) ===
  stage: Stage;                  // Dropdown: idea, prototype, mvp, beta, launched, growth, scale
  foundedYear: number;           // Number input: 1990-2100
  launchDate?: string;           // Optional date picker (ISO format)

  // === TEAM (required) ===
  teamSize: TeamSize;            // Dropdown: 1-5, 6-20, 21-50, 51-200, 200+
  cofounderCount: number;        // Number input: 1-10

  // === LOCATION (required) ===
  country: string;               // Country selector
  city?: string;                 // Optional
  operatingRegions?: string;     // Optional comma-separated

  // === FINANCIALS ===
  fundingStage?: FundingStage;   // Optional: bootstrapped, pre_seed, seed, series_a, etc.
  totalRaised?: number;          // Optional USD amount
  monthlyRevenue?: number;       // Optional MRR in USD
  isRevenue: RevenueStatus;      // Required: yes, no, pre_revenue

  // === TARGET MARKET (optional) ===
  targetCustomer?: string;       // Textarea
  problemSolved?: string;        // Textarea
  competitiveAdvantage?: string; // Textarea
}
```

### Sector Selection UI

**This is critical for RAG functionality.** Display a clear selector:

```tsx
// components/SectorSelector.tsx
const SECTORS = [
  { value: 'fintech', label: 'Fintech', description: 'Financial technology, payments, banking' },
  { value: 'greentech', label: 'Greentech', description: 'Clean energy, sustainability, climate' },
  { value: 'healthtech', label: 'Healthtech', description: 'Healthcare, medical, wellness' },
  { value: 'saas', label: 'SaaS', description: 'Software as a Service, B2B tools' },
  { value: 'ecommerce', label: 'E-commerce', description: 'Online retail, marketplaces' },
];

function SectorSelector({ value, onChange }) {
  return (
    <div>
      <label>Sector (determines document search)</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {SECTORS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label} - {s.description}
          </option>
        ))}
      </select>
      <p className="hint">
        Legal and Finance agents will search documents specific to your sector.
      </p>
    </div>
  );
}
```

### Submit Onboarding

```typescript
const user = await api.post<User>('/users/me/onboarding', onboardingData);
// Redirect to dashboard
```

### Update Startup Later

```typescript
// PATCH /users/me/startup
await api.patch('/users/me/startup', {
  monthlyRevenue: 25000,
  teamSize: '6-20',
  sector: 'saas', // Can change sector
});
```


---

## Sessions & Chat

Sessions track conversations with AI agents.

### Create Session

```typescript
// POST /sessions
const session = await api.post<Session>('/sessions', {
  startupId: user.startup.id,
  metadata: { source: 'web' },
});
```

### List Sessions

```typescript
// GET /sessions
const sessions = await api.get<Session[]>('/sessions');
```

### Get Session with Messages

```typescript
// GET /sessions/:id/history
const { session, messages } = await api.get<{ session: Session; messages: Message[] }>(
  `/sessions/${sessionId}/history`
);
```

### Add Message

```typescript
// POST /sessions/:id/messages
// Call this AFTER agent returns response to save to history
await api.post(`/sessions/${sessionId}/messages`, {
  role: 'user',
  content: userMessage,
});

await api.post(`/sessions/${sessionId}/messages`, {
  role: 'assistant',
  content: agentResponse.content,
  agent: 'legal', // legal, finance, investor, competitor
  metadata: { confidence: agentResponse.confidence },
});
```

### End Session

```typescript
// POST /sessions/:id/end
await api.post(`/sessions/${sessionId}/end`);
```

---

## AI Agents

Four specialized agents with mandatory LLM Council cross-critique.

| Agent | Data Source | Use Case |
|-------|-------------|----------|
| `legal` | RAG (documents) | Contracts, compliance, IP, corporate structure |
| `finance` | RAG (documents) | Financial modeling, metrics, runway, valuation |
| `investor` | Web Research | VC search, pitch feedback, fundraising strategy |
| `competitor` | Web Research | Market analysis, competitive landscape |

### Agent Selection UI

```tsx
const AGENTS = [
  { 
    id: 'legal', 
    name: 'Legal Advisor', 
    icon: '⚖️',
    description: 'Corporate structure, contracts, compliance',
    dataSource: 'Documents (RAG)',
  },
  { 
    id: 'finance', 
    name: 'Finance Advisor', 
    icon: '📊',
    description: 'Financial modeling, metrics, projections',
    dataSource: 'Documents (RAG)',
  },
  { 
    id: 'investor', 
    name: 'Investor Relations', 
    icon: '💰',
    description: 'Find investors, pitch feedback',
    dataSource: 'Web Research',
  },
  { 
    id: 'competitor', 
    name: 'Competitive Intel', 
    icon: '🔍',
    description: 'Market analysis, competitor tracking',
    dataSource: 'Web Research',
  },
];
```

### Synchronous Execution (Quick queries)

```typescript
// POST /agents/run
const results = await api.post<AgentPhaseResult[]>('/agents/run', {
  agentType: 'legal',
  prompt: 'What legal structure should I use for my SaaS startup?',
  sessionId: session.id,
  startupId: user.startup.id,
  documents: [], // Optional additional context
});

// Results contain 3 phases: draft → critique → final
const finalResult = results.find(r => r.phase === 'final');
console.log(finalResult.output.content);
console.log(finalResult.output.confidence); // 0-1
console.log(finalResult.output.sources);    // URLs
```

### Async Execution (Recommended for production)

```typescript
// POST /agents/queue
const { taskId } = await api.post<{ taskId: string }>('/agents/queue', {
  agentType: 'investor',
  prompt: 'Find seed VCs for AI startups',
  sessionId: session.id,
  startupId: user.startup.id,
  documents: [],
});

// Poll for status
const status = await api.get<TaskStatus>(`/agents/tasks/${taskId}`);
```

### SSE Streaming (Real-time updates)

```typescript
function streamTask(taskId: string, onUpdate: (status: TaskStatus) => void) {
  const eventSource = new EventSource(
    `${API_URL}/agents/stream/${taskId}`,
    { withCredentials: true }
  );

  eventSource.addEventListener('status', (e) => {
    onUpdate(JSON.parse(e.data));
  });

  eventSource.addEventListener('done', () => {
    eventSource.close();
  });

  return () => eventSource.close();
}
```

### Cancel Task

```typescript
// DELETE /agents/tasks/:taskId
await api.delete(`/agents/tasks/${taskId}`);
```


---

## Admin Dashboard

Admin features require `role: 'admin'` in user profile. Set via Supabase user metadata: `app_metadata.role = "admin"`.

### Check Admin Status

```typescript
const user = await api.get<User>('/users/me');
const isAdmin = user.role === 'admin';
```

### Admin Routes

| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard overview |
| `/admin/users` | User management |
| `/admin/startups` | Startup management |
| `/admin/documents` | RAG document management |
| `/admin/analytics` | Usage analytics |
| `/admin/mcp` | MCP server configuration |

---

## RAG Document Management

Admins upload PDFs that are used by Legal and Finance agents. Documents are filtered by **domain** (legal/finance) and **sector** (fintech/greentech/healthtech/saas/ecommerce).

### Document Upload UI

```tsx
// components/admin/DocumentUpload.tsx
const DOMAINS = [
  { value: 'legal', label: 'Legal', description: 'Contracts, compliance, regulations' },
  { value: 'finance', label: 'Finance', description: 'Financial models, reports, projections' },
];

const SECTORS = [
  { value: 'fintech', label: 'Fintech' },
  { value: 'greentech', label: 'Greentech' },
  { value: 'healthtech', label: 'Healthtech' },
  { value: 'saas', label: 'SaaS' },
  { value: 'ecommerce', label: 'E-commerce' },
];

function DocumentUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [domain, setDomain] = useState<'legal' | 'finance'>('legal');
  const [sector, setSector] = useState<string>('saas');

  async function handleUpload() {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    formData.append('domain', domain);
    formData.append('sector', sector);

    const result = await api.upload('/admin/embeddings/upload', formData);
    // result: { id, status: 'pending', storagePath, domain, sector }
  }

  return (
    <form onSubmit={handleUpload}>
      <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files[0])} />
      
      <select value={domain} onChange={(e) => setDomain(e.target.value)}>
        {DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>
      
      <select value={sector} onChange={(e) => setSector(e.target.value)}>
        {SECTORS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      
      <button type="submit">Upload PDF</button>
      <p>Max 50MB. Vectors created on first user query (lazy loading).</p>
    </form>
  );
}
```

### List Documents

```typescript
// GET /admin/embeddings
// GET /admin/embeddings?domain=legal
// GET /admin/embeddings?sector=fintech
// GET /admin/embeddings?domain=legal&sector=fintech&page=1&limit=20

const { data, meta } = await api.get<PaginatedResult<Embedding>>(
  '/admin/embeddings?domain=legal&sector=fintech'
);

interface Embedding {
  id: string;
  filename: string;
  storagePath: string;
  domain: 'legal' | 'finance';
  sector: 'fintech' | 'greentech' | 'healthtech' | 'saas' | 'ecommerce';
  status: 'pending' | 'indexed' | 'expired';
  chunksCreated: number;
  lastAccessed?: Date;
  createdAt: Date;
}
```

### Document Status Badges

```tsx
function StatusBadge({ status }: { status: string }) {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    indexed: 'bg-green-100 text-green-800',
    expired: 'bg-gray-100 text-gray-800',
  };
  
  const labels = {
    pending: 'Pending (will vectorize on first query)',
    indexed: 'Indexed (ready for search)',
    expired: 'Expired (will re-vectorize on next query)',
  };

  return <span className={colors[status]}>{labels[status]}</span>;
}
```

### Force Vectorize (Pre-warm)

```typescript
// POST /admin/embeddings/:id/vectorize
const { chunksCreated } = await api.post(`/admin/embeddings/${id}/vectorize`);
// Use this to pre-warm documents before users query them
```

### Delete Document

```typescript
// DELETE /admin/embeddings/:id
await api.delete(`/admin/embeddings/${id}`);
// Removes vectors from Upstash + file from Supabase Storage
```

### Cleanup Expired Vectors

```typescript
// POST /admin/embeddings/cleanup?days=30
const { filesCleaned, vectorsRemoved } = await api.post('/admin/embeddings/cleanup?days=30');
// Run this as a scheduled job (e.g., daily cron)
```


---

## Analytics

### Dashboard Stats

```typescript
// GET /analytics/dashboard
const stats = await api.get<DashboardStats>('/analytics/dashboard');

interface DashboardStats {
  totalUsers: number;
  totalSessions: number;
  totalStartups: number;
  activeSessions: number;
  eventsToday: number;
  eventsByType: { type: string; count: number }[];
}
```

### Event Aggregation (Charts)

```typescript
// GET /analytics/events/aggregation?days=7
const events = await api.get<EventAggregation[]>('/analytics/events/aggregation?days=7');

interface EventAggregation {
  date: string;
  count: number;
  type: string;
}

// Use with chart library (e.g., Recharts, Chart.js)
```

### Health Check

```typescript
// GET /health (public, no auth)
const health = await fetch(`${API_URL}/health`).then(r => r.json());

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: 'healthy' | 'degraded' | 'unhealthy';
    redis: 'healthy' | 'degraded' | 'unhealthy';
    supabase: 'healthy' | 'degraded' | 'unhealthy';
    llm: 'healthy' | 'degraded' | 'unhealthy';
    rag: 'healthy' | 'degraded' | 'unhealthy';
  };
}
```

---

## MCP Server

The backend exposes AI agents as MCP (Model Context Protocol) tools for Claude Desktop, Cursor, Kiro, etc.

### Discover Available Tools

```typescript
// GET /mcp-server/discover
// Header: X-API-Key: <MASTER_API_KEY>

const response = await fetch(`${API_URL}/mcp-server/discover`, {
  headers: { 'X-API-Key': MASTER_API_KEY },
});

const { tools, a2aCapabilities } = await response.json();

// tools: legal_analysis, finance_analysis, investor_search, competitor_analysis, multi_agent_query
```

### Tool Schemas

```typescript
// Single agent tools (legal, finance, investor, competitor)
interface SingleAgentInput {
  prompt: string;           // Required: User question
  companyName: string;      // Required: Company name
  industry: string;         // Required: Industry
  stage: string;            // Required: Funding stage
  country: string;          // Required: Country
  sector?: string;          // Optional: fintech, greentech, healthtech, saas, ecommerce
  additionalContext?: string; // Optional: Extra context
}

// Multi-agent tool
interface MultiAgentInput {
  prompt: string;
  agents: string[];         // e.g., ['legal', 'finance', 'investor']
  companyName: string;
  industry: string;
  stage: string;
  country: string;
  sector?: string;
}
```

### Execute Tool

```typescript
// POST /mcp-server/execute
const result = await fetch(`${API_URL}/mcp-server/execute`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': MASTER_API_KEY,
  },
  body: JSON.stringify({
    tool: 'legal_analysis',
    arguments: {
      prompt: 'Delaware C-Corp vs LLC?',
      companyName: 'Acme Inc',
      industry: 'saas',
      stage: 'seed',
      country: 'United States',
      sector: 'fintech',
    },
  }),
});

interface McpToolResult {
  success: boolean;
  result: {
    content: string;
    confidence: number;
    sources: string[];
  } | null;
  error: string | null;
  executionTimeMs: number;
  councilMetadata: {
    modelsUsed: string[];
    critiquesCount: number;
    consensusScore: number;
    synthesized: boolean;
  } | null;
}
```

### A2A (Agent-to-Agent) Capabilities

```typescript
// Returned in /mcp-server/discover
interface A2ACapability {
  agent: string;
  actions: string[];
  description: string;
}

// Available actions per agent:
// legal: analyze_contract, check_compliance, review_terms
// finance: calculate_runway, analyze_metrics, valuation_estimate
// investor: find_investors, match_profile, research_vc
// competitor: analyze_market, compare_features, research_competitor
```

### Multi-Agent Query (A2A Council)

```typescript
// POST /mcp-server/execute
const result = await fetch(`${API_URL}/mcp-server/execute`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': MASTER_API_KEY,
  },
  body: JSON.stringify({
    tool: 'multi_agent_query',
    arguments: {
      prompt: 'Prepare for Series A fundraise',
      agents: ['legal', 'finance', 'investor'],
      companyName: 'Acme Inc',
      industry: 'saas',
      stage: 'seed',
      country: 'United States',
      sector: 'fintech',
    },
  }),
});

// Multi-agent flow:
// 1. All agents generate responses in parallel
// 2. Responses shuffled (anonymized)
// 3. Each agent critiques other agents' responses
// 4. Best response synthesized with critique feedback
```


---

## API Keys

Users can create API keys for programmatic access.

### Create API Key

```typescript
// POST /api-keys
const { key, ...apiKey } = await api.post<ApiKeyCreated>('/api-keys', {
  name: 'Production API Key',
  scopes: ['agents:read', 'agents:write', 'sessions:read'],
});

// ⚠️ IMPORTANT: Save `key` immediately - shown only once!
console.log('API Key:', key); // coop_xxxxxxxxxxxx

// Available scopes:
// read, write, admin
// agents, agents:read, agents:write
// sessions, sessions:read, sessions:write
// webhooks, webhooks:read, webhooks:write
// users:read, startups:read
// notion, mcp
// * (all permissions)
```

### List API Keys

```typescript
// GET /api-keys
const keys = await api.get<ApiKey[]>('/api-keys');

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string; // "coop_abc..."
  scopes: string[];
  createdAt: string;
  lastUsedAt: string;
}
```

### Revoke API Key

```typescript
// DELETE /api-keys/:id
await api.delete(`/api-keys/${keyId}`);
```

---

## Webhooks

Receive HTTP callbacks when events occur.

### Create Webhook

```typescript
// POST /webhooks
const webhook = await api.post<Webhook>('/webhooks', {
  name: 'My Webhook',
  url: 'https://example.com/webhook',
  events: ['agent.completed', 'session.created'],
});

// Available events:
// session.created, session.ended, session.expired
// user.created, user.updated, user.deleted
// startup.created, startup.updated, startup.deleted
// agent.started, agent.completed, agent.failed
// * (all events)
```

### List Webhooks

```typescript
// GET /webhooks
const webhooks = await api.get<Webhook[]>('/webhooks');
```

### Update Webhook

```typescript
// PATCH /webhooks/:id
await api.patch(`/webhooks/${id}`, {
  events: ['agent.completed'],
  isActive: false,
});
```

### Regenerate Secret

```typescript
// POST /webhooks/:id/regenerate-secret
const { secret } = await api.post(`/webhooks/${id}/regenerate-secret`);
```

### Delete Webhook

```typescript
// DELETE /webhooks/:id
await api.delete(`/webhooks/${id}`);
```

### Webhook Payload

```typescript
// Your endpoint receives:
interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// Verify with X-Webhook-Signature header (HMAC-SHA256)
```

---

## Notion Integration

Export agent outputs to Notion pages.

### Check Status

```typescript
// GET /notion/status
const status = await api.get<NotionStatus>('/notion/status');

interface NotionStatus {
  connected: boolean;
  workspaceName: string | null;
  defaultPageId: string | null;
}
```

### Search Pages

```typescript
// GET /notion/pages?query=startup
const pages = await api.get<NotionPage[]>('/notion/pages?query=startup');
```

### Export to Notion

```typescript
// POST /notion/export
const result = await api.post<NotionExportResult>('/notion/export', {
  pageId: 'notion-page-id', // Optional, uses default if not provided
  title: 'Legal Analysis - Acme Inc',
  agentType: 'legal',
  content: 'The analysis content...',
  sources: ['https://source1.com'],
  metadata: { confidence: 0.85 },
});
```


---

## TypeScript Types

```typescript
// types/api.ts

// === ENUMS ===
type FounderRole = 'ceo' | 'cto' | 'coo' | 'cfo' | 'cpo' | 'founder' | 'cofounder';

type Industry = 
  | 'saas' | 'fintech' | 'healthtech' | 'edtech' | 'ecommerce' | 'marketplace'
  | 'ai_ml' | 'artificial_intelligence' | 'cybersecurity' | 'cleantech' | 'biotech'
  | 'proptech' | 'insurtech' | 'legaltech' | 'hrtech' | 'agritech' | 'logistics'
  | 'media_entertainment' | 'gaming' | 'food_beverage' | 'travel_hospitality'
  | 'social' | 'developer_tools' | 'hardware' | 'other';

type Sector = 'fintech' | 'greentech' | 'healthtech' | 'saas' | 'ecommerce';

type BusinessModel = 'b2b' | 'b2c' | 'b2b2c' | 'marketplace' | 'd2c' | 'enterprise' | 'smb' | 'consumer' | 'platform' | 'api' | 'other';

type RevenueModel = 'subscription' | 'transaction_fee' | 'freemium' | 'usage_based' | 'licensing' | 'advertising' | 'commission' | 'one_time' | 'hybrid' | 'not_yet';

type Stage = 'idea' | 'prototype' | 'mvp' | 'beta' | 'launched' | 'growth' | 'scale';

type TeamSize = '1-5' | '6-20' | '21-50' | '51-200' | '200+';

type FundingStage = 'bootstrapped' | 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'series_c_plus' | 'profitable';

type RevenueStatus = 'yes' | 'no' | 'pre_revenue';

type AgentType = 'legal' | 'finance' | 'investor' | 'competitor';

type RagDomain = 'legal' | 'finance';

type VectorStatus = 'pending' | 'indexed' | 'expired';

// === USER ===
interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  authProvider: 'google' | 'email' | null;
  onboardingCompleted: boolean;
  startup: StartupSummary | null;
  createdAt: string;
  updatedAt: string;
}

interface StartupSummary {
  id: string;
  companyName: string;
  industry: string;
  sector: Sector;
  stage: string;
  fundingStage: string | null;
}

// === STARTUP ===
interface Startup {
  id: string;
  founderName: string;
  founderRole: string;
  companyName: string;
  tagline: string | null;
  description: string;
  website: string | null;
  industry: string;
  sector: Sector;
  businessModel: string;
  revenueModel: string | null;
  stage: string;
  foundedYear: number;
  launchDate: string | null;
  teamSize: string;
  cofounderCount: number;
  country: string;
  city: string | null;
  operatingRegions: string | null;
  fundingStage: string | null;
  totalRaised: string | null;
  monthlyRevenue: string | null;
  isRevenue: string;
  targetCustomer: string | null;
  problemSolved: string | null;
  competitiveAdvantage: string | null;
  createdAt: string;
  updatedAt: string;
}

// === SESSION ===
interface Session {
  id: string;
  userId: string;
  startupId: string;
  status: 'active' | 'ended' | 'expired';
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// === MESSAGE ===
interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent: AgentType | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// === AGENT ===
interface AgentOutput {
  content: string;
  confidence: number;
  sources: string[];
  metadata: Record<string, unknown>;
}

interface AgentPhaseResult {
  phase: 'draft' | 'critique' | 'final';
  output: AgentOutput;
  timestamp: string;
}

interface TaskStatus {
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused' | 'unknown';
  progress: number;
  result?: {
    success: boolean;
    results: AgentPhaseResult[];
    error: string;
    completedAt: string;
  };
  error?: string;
}

// === EMBEDDING (RAG) ===
interface Embedding {
  id: string;
  filename: string;
  storagePath: string;
  domain: RagDomain;
  sector: Sector;
  status: VectorStatus;
  chunksCreated: number;
  lastAccessed?: string;
  createdAt: string;
}

// === WEBHOOK ===
interface Webhook {
  id: string;
  userId: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// === API KEY ===
interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string;
}

interface ApiKeyCreated extends ApiKey {
  key: string;
}

// === PAGINATION ===
interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// === API RESPONSE ===
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  timestamp: string;
}
```


---

## Error Handling

### API Error Response

```typescript
interface ApiError {
  success: false;
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}
```

### HTTP Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Bad Request | Check request body/params |
| 401 | Unauthorized | Refresh token or re-login |
| 403 | Forbidden | User lacks permission (check role) |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource |
| 429 | Too Many Requests | Rate limited, wait and retry |
| 500 | Server Error | Contact support |

### Error Handler

```typescript
// lib/error-handler.ts
import { signOut } from './auth';

export async function handleApiError(error: unknown) {
  if (error instanceof Response) {
    const data = await error.json();
    
    switch (error.status) {
      case 401:
        await signOut();
        window.location.href = '/login';
        break;
      case 403:
        throw new Error('You do not have permission');
      case 404:
        throw new Error('Resource not found');
      case 429:
        throw new Error('Too many requests. Please wait.');
      default:
        throw new Error(data.message || 'An error occurred');
    }
  }
  throw error;
}
```

---

## UI Component Checklist

### Authentication
- [ ] Login page (Google OAuth + Email/Password)
- [ ] Sign up page
- [ ] Auth callback handler
- [ ] Protected route wrapper
- [ ] Logout button

### Onboarding
- [ ] Multi-step onboarding form
- [ ] Sector selector (critical for RAG)
- [ ] Industry dropdown
- [ ] Funding stage selector
- [ ] Form validation

### Dashboard
- [ ] User profile card
- [ ] Startup summary
- [ ] Recent sessions list
- [ ] Quick agent access

### Chat Interface
- [ ] Agent selector (4 agents)
- [ ] Message input
- [ ] Message history
- [ ] Loading states
- [ ] SSE streaming support
- [ ] Confidence indicator
- [ ] Source links

### Admin Panel
- [ ] Dashboard stats
- [ ] User management table
- [ ] Startup management table
- [ ] Document upload form
- [ ] Document list with filters
- [ ] Analytics charts
- [ ] Health status

### Settings
- [ ] Profile editor
- [ ] Startup editor
- [ ] API key management
- [ ] Webhook management
- [ ] Notion integration

---

## API Endpoints Summary

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

### User (Bearer Token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get current user |
| GET | `/users/me/onboarding-status` | Check onboarding |
| POST | `/users/me/onboarding` | Complete onboarding |
| PATCH | `/users/me` | Update profile |
| PATCH | `/users/me/startup` | Update startup |

### Sessions (Bearer Token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sessions` | Create session |
| GET | `/sessions` | List sessions |
| GET | `/sessions/:id` | Get session |
| GET | `/sessions/:id/history` | Get with messages |
| POST | `/sessions/:id/messages` | Add message |
| POST | `/sessions/:id/end` | End session |

### Agents (Bearer Token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/agents/run` | Run agent (sync) |
| POST | `/agents/queue` | Queue agent (async) |
| GET | `/agents/tasks/:id` | Get task status |
| GET | `/agents/stream/:id` | SSE stream |
| DELETE | `/agents/tasks/:id` | Cancel task |

### Admin (Bearer Token + Admin Role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/embeddings/upload` | Upload PDF |
| GET | `/admin/embeddings` | List documents |
| GET | `/admin/embeddings/:id` | Get document |
| POST | `/admin/embeddings/:id/vectorize` | Force vectorize |
| DELETE | `/admin/embeddings/:id` | Delete document |
| POST | `/admin/embeddings/cleanup` | Cleanup expired |
| GET | `/analytics/dashboard` | Dashboard stats |
| GET | `/analytics/events/aggregation` | Event data |

### MCP Server (X-API-Key Header)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/mcp-server/discover` | List tools |
| POST | `/mcp-server/execute` | Execute tool |

### API Keys (Bearer Token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api-keys` | Create key |
| GET | `/api-keys` | List keys |
| DELETE | `/api-keys/:id` | Revoke key |

### Webhooks (Bearer Token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks` | Create webhook |
| GET | `/webhooks` | List webhooks |
| PATCH | `/webhooks/:id` | Update webhook |
| DELETE | `/webhooks/:id` | Delete webhook |
| POST | `/webhooks/:id/regenerate-secret` | New secret |

### Notion (Bearer Token)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notion/status` | Check connection |
| GET | `/notion/pages` | Search pages |
| POST | `/notion/export` | Export content |

---

## Quick Start

1. Set up environment variables
2. Initialize Supabase client
3. Implement auth flow (login → callback → dashboard)
4. Build onboarding form with sector selector
5. Create chat interface with agent selection
6. Add admin panel for document management
7. Implement settings pages

**Swagger Docs**: `https://your-backend.onrender.com/docs`
