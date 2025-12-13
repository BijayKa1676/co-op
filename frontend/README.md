# Co-Op Frontend

Modern, responsive web application for the Co-Op AI advisory platform. Built with Next.js 14, React 18, and Tailwind CSS.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3.4
- **UI Components**: Radix UI primitives
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod
- **Auth**: Supabase Auth
- **Animations**: Framer Motion
- **Icons**: Phosphor Icons

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase project

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes |
| `NEXT_PUBLIC_APP_URL` | Frontend app URL | No |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/        # Authenticated dashboard routes
│   │   ├── admin/          # Admin panel (RAG management)
│   │   ├── agents/         # Individual agent pages
│   │   ├── analytics/      # Analytics dashboard
│   │   ├── chat/           # Multi-agent chat
│   │   ├── dashboard/      # Main dashboard
│   │   ├── developers/     # API documentation
│   │   ├── sessions/       # Session history
│   │   └── settings/       # User settings, API keys, webhooks
│   ├── auth/               # Auth callback handler
│   ├── login/              # Login page
│   ├── onboarding/         # Startup onboarding flow
│   └── page.tsx            # Landing page
├── components/
│   └── ui/                 # Reusable UI components
├── lib/
│   ├── api/                # API client and types
│   ├── hooks/              # Custom React hooks
│   ├── supabase/           # Supabase client setup
│   ├── store.ts            # Zustand stores
│   └── utils.ts            # Utility functions
└── middleware.ts           # Auth middleware
```

## Available Scripts

```bash
# Development
npm run dev           # Start dev server on port 3001

# Build
npm run build         # Production build
npm run start         # Start production server

# Code Quality
npm run lint          # Run ESLint
npm run format        # Format with Prettier
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

The `vercel.json` configuration handles:
- API rewrites to backend
- Security headers
- CORS configuration

### Manual Deployment

```bash
npm run build
npm run start
```

## Features

### Dashboard
- Overview of startup profile
- Quick access to all agents
- Recent session history

### AI Agents
- **Legal**: Corporate structure, compliance, contracts
- **Finance**: Financial modeling, metrics, runway
- **Investor**: VC matching, pitch optimization
- **Competitor**: Market analysis, positioning

### Chat
- Multi-agent conversations
- Real-time streaming responses
- Notion export integration
- Session persistence

### Settings
- Profile management
- API key generation
- Webhook configuration
- Startup profile editing

### Admin (Admin users only)
- RAG document management
- PDF upload and vectorization
- Analytics dashboard

## Code Style

- TypeScript strict mode
- ESLint + Prettier
- Tailwind CSS class sorting
- Component-based architecture

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` and `npm run format`
5. Submit a pull request

## License

MIT License - see [LICENSE](../LICENSE) for details.
