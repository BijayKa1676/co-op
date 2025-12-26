# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-12-26

### Added
- **Customer Outreach Module** - Full lead discovery and campaign management
  - AI-powered lead discovery for people (influencers) and companies
  - Lead enrichment with social profiles, followers, engagement metrics
  - Lead scoring and status tracking (new → enriched → contacted → converted)
  - Campaign management with two modes:
    - Single Template: One email template for all leads
    - AI Personalized: Unique AI-generated emails per lead
  - Variable substitution ({{name}}, {{company}}, etc.)
  - Email tracking (opens, clicks, bounces)
  - Campaign analytics and stats
- **Secure Documents Module** - Encrypted user document storage with RAG
  - AES-256-GCM encryption for all document content
  - Original files deleted after processing (chunks only stored)
  - Per-user isolation (users only see their own documents)
  - Auto-expiry with configurable TTL
  - Semantic search via Upstash Vector
  - RAG integration for AI conversations
  - Supported formats: PDF, DOC, DOCX, TXT, MD, images
- New database tables: leads, campaigns, campaign_emails, user_documents, user_document_chunks
- Email tracking controller with pixel tracking and link wrapping
- User docs RAG service for encrypted document queries

### Changed
- Fixed ESLint errors (non-null assertions, unused imports)
- Improved type safety in campaigns and leads services

## [1.2.0] - 2025-12-16

### Added
- **Investor Database Module** - Full CRUD for investor management
  - 20+ real investors seeded (Y Combinator, Sequoia, a16z, etc.)
  - Admin management endpoints with bulk import
  - Filter by stage, sector, region
  - Featured investors support
- **Competitor Alerts Module** - Real-time monitoring system
  - 3 alerts per user (pilot limit)
  - Keywords and competitor tracking
  - Alert results with read/unread status
  - Email notification support
  - Daily/weekly/realtime frequency options
- **Financial Calculators** - Frontend tools page
  - Runway Calculator
  - Burn Rate Calculator
  - Valuation Calculator
  - Unit Economics Calculator (LTV, CAC, payback)
- **Legal Jurisdiction Selector** - Region-specific legal advice
  - 9 regions (Global, US, EU, UK, India, Canada, APAC, LATAM, MENA)
  - 25+ jurisdictions (GDPR, CCPA, SEC, HIPAA, etc.)
- Admin investors management page
- Seed script for initial investor data

### Changed
- Fixed route order in investors controller (admin/all before :id)
- Added PATCH endpoints for partial updates
- Improved alerts page with split-view UI for results

## [1.1.0] - 2025-12-15

### Changed
- Updated LLM model from `gemini-2.5-flash-preview-05-20` to `gemini-2.5-flash`
- Improved multi-agent synthesis prompts for more detailed, actionable responses
- Increased synthesis maxTokens to 3000 for comprehensive answers
- Enhanced task progress tracking with phases: gathering → critiquing → synthesizing

### Added
- Real-time progress updates with estimated time remaining
- `/metrics/admin` endpoint for admin metrics without API key
- Session message persistence for chat continuity
- "Continue Chat" functionality from session detail page

### Fixed
- Session persistence - chat loads existing messages when returning
- Admin analytics infinite loop issue using `useRef` for data loading
- Onboarding 400 error with NaN values

## [1.0.0] - 2024-12-13

### Added

#### Core Infrastructure
- NestJS 11 with modular architecture
- TypeScript 5.6 with strict mode
- Drizzle ORM with PostgreSQL
- Upstash Redis for caching + QStash for serverless queue
- Supabase Auth integration (JWT verification)
- Supabase Storage for file uploads
- Prometheus metrics endpoint
- Health check endpoint
- Swagger/OpenAPI documentation

#### LLM Council Architecture
- Multi-provider support: Groq, Google AI, HuggingFace
- Cross-critique consensus mechanism
- Automatic provider fallback
- Periodic health checks (5-minute intervals)
- Models: Llama 3.3 70B, Gemini 2.5 Flash, Llama 3 8B, Mistral 7B

#### AI Agents
- Legal agent with LLM Council + RAG
- Finance agent with LLM Council + RAG
- Investor agent with LLM Council + web research
- Competitor agent with LLM Council + web research
- Multi-agent orchestration (A2A protocol)
- QStash serverless queue for async processing
- SSE streaming (5-minute timeout)
- Task status polling and cancellation

#### Web Research
- Google Gemini with Search Grounding
- Real-time web search
- Company lookup, investor search, market research

#### MCP Server
- Tool discovery endpoint
- Tool execution endpoint
- A2A (Agent-to-Agent) protocol support
- Multi-agent query tool

#### User Management
- User registration and profiles
- Onboarding flow with startup creation
- OAuth provider tracking (Google, GitHub)
- Admin role management

#### Security
- JWT authentication (Supabase)
- API key authentication with timing-safe comparison
- Admin guard for privileged operations
- Rate limiting
- SSRF protection for webhooks
- Input validation with class-validator

### Security Fixes (Audit)
- Added timing-safe comparison to API key guard
- Added API key authentication to metrics endpoint
- Fixed UserThrottleGuard constructor

### Bug Fixes (Audit)
- Added `executeOnce` method to CircuitBreakerService
- Improved A2A polling with exponential backoff
- Fixed cache invalidation on session end

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.3.0 | 2025-12-26 | Customer outreach, secure documents with RAG |
| 1.2.0 | 2025-12-16 | Investor database, competitor alerts, financial tools |
| 1.1.0 | 2025-12-15 | LLM model updates, progress tracking |
| 1.0.0 | 2024-12-13 | Initial release |
