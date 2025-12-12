# Co-Op Backend

Enterprise-grade NestJS backend with Drizzle ORM, Upstash Redis, and PostgreSQL.

## Tech Stack

- **Framework**: NestJS 11
- **Language**: TypeScript 5
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **Cache**: Upstash Redis
- **Queue**: BullMQ
- **Auth**: JWT with bcrypt
- **Validation**: class-validator + Zod
- **Documentation**: Swagger/OpenAPI
- **Hosting**: Render

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Push database schema
npm run db:push

# Start development server
npm run dev
```

## Project Structure

```
src/
├── common/                 # Shared utilities
│   ├── decorators/         # Custom decorators (@CurrentUser)
│   ├── dto/                # Common DTOs (ApiResponse, Pagination)
│   ├── filters/            # Exception filters
│   ├── guards/             # Auth & Admin guards
│   └── redis/              # Upstash Redis service
├── config/                 # Zod-validated env config
├── database/               # Drizzle setup
│   ├── migrations/         # SQL migrations
│   └── schema/             # Table definitions
└── modules/                # Feature modules
    ├── admin/              # Embeddings management
    ├── agents/             # Agent orchestration
    │   ├── domains/        # Domain-specific agents
    │   │   ├── competitor/
    │   │   ├── finance/
    │   │   ├── investor/
    │   │   └── legal/
    │   ├── orchestrator/   # Agent orchestrator
    │   └── queue/          # BullMQ job processing
    ├── analytics/          # Event tracking
    ├── auth/               # JWT authentication
    ├── health/             # Health checks
    ├── mcp/                # MCP integration
    ├── sessions/           # Session management
    └── users/              # User management
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `UPSTASH_REDIS_URL` | Upstash Redis REST URL | Yes |
| `UPSTASH_REDIS_TOKEN` | Upstash Redis token | Yes |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | Yes |
| `REDIS_HOST` | Redis host for BullMQ | No (default: localhost) |
| `REDIS_PORT` | Redis port for BullMQ | No (default: 6379) |
| `PORT` | Server port | No (default: 3000) |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | No |

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start:prod   # Start production server
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
npm run db:push      # Push schema (dev only)
npm run db:studio    # Open Drizzle Studio
npm run lint         # Run ESLint
npm run test         # Run tests
```

## API Endpoints

### Auth
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login with email/password
- `POST /api/v1/auth/refresh` - Refresh access token

### Health
- `GET /api/v1/health` - Health check

### Users
- `GET /api/v1/users/me` - Get current user profile
- `PATCH /api/v1/users/me` - Update current user
- `GET /api/v1/users/:id` - Get user by ID
- `POST /api/v1/users` - Create user (admin)
- `PATCH /api/v1/users/:id` - Update user (admin)
- `DELETE /api/v1/users/:id` - Delete user (admin)

### Sessions
- `POST /api/v1/sessions` - Create session
- `GET /api/v1/sessions` - List user sessions
- `GET /api/v1/sessions/:id` - Get session
- `POST /api/v1/sessions/:id/end` - End session

### Agents
- `POST /api/v1/agents/run` - Run agent synchronously
- `POST /api/v1/agents/queue` - Queue agent task (async)
- `GET /api/v1/agents/tasks/:taskId` - Get task status
- `DELETE /api/v1/agents/tasks/:taskId` - Cancel task
- `GET /api/v1/agents/stream/:taskId` - SSE stream

### Admin
- `POST /api/v1/admin/embeddings/upload` - Upload PDF
- `GET /api/v1/admin/embeddings` - List embeddings
- `GET /api/v1/admin/embeddings/:id` - Get embedding
- `DELETE /api/v1/admin/embeddings/:id` - Delete embedding

## Authentication

The API uses JWT Bearer tokens. Include the token in the Authorization header:

```
Authorization: Bearer <access_token>
```

Access tokens expire in 15 minutes. Use the refresh endpoint to get new tokens.

## Deployment

### Render

1. Connect your repository to Render
2. Use the `render.yaml` blueprint or configure manually:
   - Build: `npm install && npm run build`
   - Start: `npm run start:prod`
3. Add environment variables
4. Set up Redis for BullMQ (Render Redis or external)
5. Deploy

### Docker

```bash
docker build -t co-op-backend .
docker run -p 3000:3000 --env-file .env co-op-backend
```

## API Documentation

Swagger UI available at `/docs` in development mode.

## License

MIT
