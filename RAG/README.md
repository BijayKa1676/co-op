# Co-Op RAG Service

Python vector search service with **lazy vectorization**, **domain** (legal/finance) and **sector** filtering using Supabase Storage, Upstash Vector, and Neon PostgreSQL.

**Important**: This service returns context only - NO LLM answer generation. The backend's LLM Council handles all answer generation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Lazy Vectorization Architecture                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  UPLOAD (Admin via Backend):                                                 │
│  PDF → Backend → Supabase Storage → Register with RAG (status: pending)     │
│                                                                              │
│  QUERY (User via Backend):                                                   │
│  Question → Backend → RAG Service → Check pending files → Lazy vectorize    │
│                                    ↓                                         │
│                    Download from Supabase → Chunk → Embed → Upstash         │
│                                    ↓                                         │
│                    Search vectors (filtered by domain+sector)                │
│                                    ↓                                         │
│                    Return context chunks to Backend                          │
│                                    ↓                                         │
│                    Backend LLM Council generates answer                      │
│                                                                              │
│  CLEANUP (Cron):                                                             │
│  Files not accessed in 30 days → Remove vectors → Status: expired           │
│  (Files remain in Supabase Storage for future re-vectorization)             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Features

- **Vector Search Only**: Returns context chunks, NOT answers (backend handles LLM)
- **Lazy Vectorization**: Vectors created on-demand when user queries, not at upload time
- **TTL Management**: Vectors expire after 30 days of no access, freeing space
- **Persistent Storage**: PDFs stored permanently in Supabase Storage
- **Re-vectorization**: Expired files automatically re-vectorized on next query
- **Domain/Sector Filtering**: Precise document retrieval based on user's sector
- **Gemini Embeddings**: Uses text-embedding-004 (768 dimensions)

## Domains & Sectors

| Domain | Description |
|--------|-------------|
| `legal` | Legal documents, contracts, compliance |
| `finance` | Financial models, reports, projections |

| Sector | Description |
|--------|-------------|
| `fintech` | Financial technology |
| `greentech` | Clean/green technology |
| `healthtech` | Healthcare technology |
| `saas` | Software as a Service |
| `ecommerce` | E-commerce |

## Prerequisites

1. **Supabase Project**
   - Storage bucket: `documents`
   - Service role key (for server-side access)

2. **Upstash Vector Index**
   - Create at [console.upstash.com](https://console.upstash.com)
   - **Dimensions**: `768` (Gemini text-embedding-004)
   - **Distance Metric**: `Cosine`

3. **Neon Database**
   - PostgreSQL connection string from [neon.tech](https://neon.tech)
   - Schema managed by backend (Drizzle ORM)

4. **Google AI API Key**
   - For Gemini embeddings from [aistudio.google.com](https://aistudio.google.com)

## Local Development

```bash
cd RAG
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your credentials
uvicorn app.main:app --reload --port 8000
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Register File (called by backend after Supabase upload)
```bash
POST /rag/register
Content-Type: application/json
X-API-Key: your-api-key

{
  "file_id": "uuid",
  "filename": "contract.pdf",
  "storage_path": "legal/fintech/uuid/contract.pdf",
  "domain": "legal",
  "sector": "fintech",
  "content_type": "application/pdf"
}
```

### Force Vectorize (admin pre-warming)
```bash
POST /rag/vectorize/{file_id}
X-API-Key: your-api-key
```

### Query RAG (returns context only)
```bash
POST /rag/query
Content-Type: application/json
X-API-Key: your-api-key

{
  "query": "What are the key compliance requirements?",
  "domain": "legal",
  "sector": "fintech",
  "limit": 5
}
```

Response:
```json
{
  "context": "[Source: contract.pdf]\nThe key compliance requirements include...\n\n---\n\n[Source: regulations.pdf]\nAdditional requirements...",
  "sources": [
    {
      "file_id": "uuid",
      "filename": "contract.pdf",
      "score": 0.8542,
      "domain": "legal",
      "sector": "fintech",
      "chunk_index": 3
    }
  ],
  "domain": "legal",
  "sector": "fintech",
  "vectors_loaded": 0,
  "chunks_found": 2
}
```

### List Files
```bash
GET /rag/files
GET /rag/files?domain=legal
GET /rag/files?sector=fintech
GET /rag/files?domain=legal&sector=fintech
```

### Get File
```bash
GET /rag/files/{file_id}
```

### Delete File
```bash
DELETE /rag/files/{file_id}
```

### Cleanup Expired Vectors (cron job)
```bash
POST /rag/cleanup?days=30
X-API-Key: your-api-key
```

---

## Deployment

### Koyeb (Recommended)

1. **Create Koyeb Account**: [koyeb.com](https://www.koyeb.com)

2. **Connect Repository**:
   - Go to Koyeb Dashboard → Create App
   - Select "GitHub" and connect your repo
   - Set the **Dockerfile path**: `RAG/Dockerfile`
   - Set the **Working directory**: `RAG`

3. **Configure Environment Variables**:
   ```
   DATABASE_URL=postgres://...
   UPSTASH_VECTOR_REST_URL=https://...
   UPSTASH_VECTOR_REST_TOKEN=...
   GOOGLE_AI_API_KEY=...
   SUPABASE_URL=https://...
   SUPABASE_SERVICE_KEY=...
   SUPABASE_STORAGE_BUCKET=documents
   RAG_API_KEY=your-secure-api-key
   ```

4. **Configure Service**:
   - **Port**: 8000
   - **Health check path**: `/health`
   - **Instance type**: nano (free tier) or small
   - **Region**: Choose closest to your backend

5. **Deploy**: Click "Deploy"

6. **Get URL**: Copy the service URL (e.g., `https://your-app-xxx.koyeb.app`)

7. **Update Backend**: Set `RAG_SERVICE_URL` and `RAG_API_KEY` in your Render backend

### Docker (Self-hosted)

```bash
cd RAG

# Build
docker build -t co-op-rag .

# Run
docker run -p 8000:8000 \
  -e DATABASE_URL="postgres://..." \
  -e UPSTASH_VECTOR_REST_URL="https://..." \
  -e UPSTASH_VECTOR_REST_TOKEN="..." \
  -e GOOGLE_AI_API_KEY="..." \
  -e SUPABASE_URL="https://..." \
  -e SUPABASE_SERVICE_KEY="..." \
  -e SUPABASE_STORAGE_BUCKET="documents" \
  -e RAG_API_KEY="your-secure-api-key" \
  co-op-rag
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon PostgreSQL URL | Yes |
| `UPSTASH_VECTOR_REST_URL` | Upstash Vector REST URL | Yes |
| `UPSTASH_VECTOR_REST_TOKEN` | Upstash Vector token | Yes |
| `GOOGLE_AI_API_KEY` | Google AI API key (embeddings only) | Yes |
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name (default: documents) | No |
| `RAG_API_KEY` | API key for authentication | Yes |
| `CORS_ORIGINS` | Allowed CORS origins | No |

---

## Integration with Backend

The NestJS backend (on Render) orchestrates the flow:

### Upload Flow
1. **Admin uploads PDF** → Backend uploads to Supabase Storage (`domain/sector/fileId/filename`)
2. **Backend registers file** → Calls `/rag/register` with storage path
3. **File status**: `pending` (no vectors yet)

### Query Flow
1. **User asks question** → Backend calls `/rag/query` with user's sector
2. **RAG checks pending files** → Downloads from Supabase, vectorizes on-demand
3. **RAG searches vectors** → Filtered by domain + sector
4. **RAG updates timestamps** → Tracks last access for TTL
5. **RAG returns context** → Backend injects into LLM Council prompt
6. **LLM Council generates answer** → Cross-critique between multiple models

### Cleanup Flow (Daily Cron)
1. **Cron calls** `/rag/cleanup?days=30`
2. **RAG finds expired files** → Not accessed in 30 days
3. **RAG removes vectors** → Frees Upstash space
4. **File status**: `expired` (will re-vectorize on next query)

### Backend Configuration

In your Render backend, set:
```bash
RAG_SERVICE_URL=https://your-rag-service.koyeb.app
RAG_API_KEY=your-secure-api-key
```

---

## Database Schema

The `rag_files` table is managed by the backend's Drizzle ORM. The RAG service only reads/writes to it.

```sql
CREATE TABLE rag_files (
    id UUID PRIMARY KEY,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    content_type TEXT DEFAULT 'application/pdf',
    domain TEXT NOT NULL,
    sector TEXT NOT NULL,
    vector_status TEXT DEFAULT 'pending',  -- pending | indexed | expired
    chunk_count INT DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Why No LLM in RAG?

The RAG service intentionally does NOT include LLM answer generation:

1. **Single Source of Truth**: Backend's LLM Council handles ALL answer generation
2. **Cross-Critique**: Multiple models validate each other's responses
3. **No Duplicate Dependencies**: No need for Groq/OpenAI keys in RAG
4. **Simpler Architecture**: RAG focuses on retrieval, backend focuses on generation
5. **Cost Efficiency**: One LLM layer instead of two

The backend receives context from RAG and uses it to augment the LLM Council prompt, ensuring accurate, cross-validated answers.

---

## Troubleshooting

### "No relevant documents found"
- Check that documents were registered with the correct domain/sector
- Verify the query domain/sector matches registered documents
- Use `/rag/files` to list registered documents and their `vector_status`

### Vectors not loading
- Check Supabase Storage bucket permissions
- Verify `SUPABASE_SERVICE_KEY` has access to the bucket
- Check file exists at the `storage_path`

### Embedding errors
- Verify `GOOGLE_AI_API_KEY` is valid
- Check Upstash Vector index has 768 dimensions

### Database errors
- Verify `DATABASE_URL` includes `?sslmode=require` for Neon
- Check Neon dashboard for connection limits
- Schema is managed by backend - ensure backend has run migrations

### Authentication errors
- Verify `RAG_API_KEY` matches between RAG service and backend
- Check `X-API-Key` header is being sent
