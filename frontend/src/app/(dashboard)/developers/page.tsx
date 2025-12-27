'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { copyToClipboard } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.co-op.ai/api/v1';

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-border/60 bg-muted/30">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border/40">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{language}</span>
        <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-2 text-muted-foreground hover:text-foreground">
          <span className="text-[10px]">{copied ? 'Copied!' : 'Copy'}</span>
        </Button>
      </div>
      <div className="overflow-x-auto">
        <pre className="p-3 text-xs font-mono leading-relaxed">
          <code className="text-foreground/90">{code}</code>
        </pre>
      </div>
    </div>
  );
}

const endpoints = [
  { method: 'POST', path: '/agents/run', desc: 'Run sync' },
  { method: 'POST', path: '/agents/queue', desc: 'Queue task' },
  { method: 'GET', path: '/agents/tasks/:id', desc: 'Get status' },
  { method: 'GET', path: '/agents/stream/:id', desc: 'SSE stream' },
  { method: 'POST', path: '/sessions', desc: 'Create session' },
  { method: 'POST', path: '/api-keys', desc: 'Create key' },
];

const agents = [
  { id: 'legal', name: 'Legal', description: 'Corporate structure, contracts, compliance', source: 'RAG' },
  { id: 'finance', name: 'Finance', description: 'Financial modeling, metrics, runway', source: 'RAG' },
  { id: 'investor', name: 'Investor', description: 'VC matching, pitch optimization', source: 'Web Research' },
  { id: 'competitor', name: 'Competitor', description: 'Market analysis, positioning', source: 'Web Research' },
];

const llmModels = [
  { name: 'Llama 3.3 70B', provider: 'Groq' },
  { name: 'Kimi K2', provider: 'Groq' },
  { name: 'Gemini 2.5', provider: 'Google' },
  { name: 'DeepSeek R1', provider: 'HF' },
  { name: 'Phi-3 Mini', provider: 'HF' },
  { name: 'Qwen 2.5', provider: 'HF' },
];

const agentCapabilities = [
  { agent: 'legal', actions: ['contracts', 'compliance'] },
  { agent: 'finance', actions: ['runway', 'metrics'] },
  { agent: 'investor', actions: ['find_vcs', 'match'] },
  { agent: 'competitor', actions: ['market', 'compare'] },
];

const a2aSteps = [
  { step: '1', title: 'Generate', desc: 'Agents respond in parallel' },
  { step: '2', title: 'Shuffle', desc: 'Anonymize for fair critique' },
  { step: '3', title: 'Critique', desc: 'Cross-critique (1-10 score)' },
  { step: '4', title: 'Synthesize', desc: 'Best response + feedback' },
];

export default function DevelopersPage() {
  const [activeTab, setActiveTab] = useState('rest');

  return (
    <div className="max-w-4xl mx-auto pb-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl font-medium tracking-tight">Developer Docs</h1>
        <p className="text-muted-foreground text-sm mt-1">Integrate Co-Op&apos;s AI agents via REST API, MCP, or A2A.</p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link href="/settings/api-keys">
          <Card className="border-border/40 hover:border-border transition-colors h-full">
            <CardContent className="p-3 text-center">
              <p className="font-medium text-sm">API Keys</p>
              <p className="text-xs text-muted-foreground">Create keys</p>
            </CardContent>
          </Card>
        </Link>
        <a href="https://github.com/Afnanksalal/co-op" target="_blank" rel="noopener noreferrer">
          <Card className="border-border/40 hover:border-border transition-colors h-full">
            <CardContent className="p-3 text-center">
              <p className="font-medium text-sm">GitHub</p>
              <p className="text-xs text-muted-foreground">Source code</p>
            </CardContent>
          </Card>
        </a>
        <a href={`${API_URL.replace('/api/v1', '')}/docs`} target="_blank" rel="noopener noreferrer">
          <Card className="border-border/40 hover:border-border transition-colors h-full">
            <CardContent className="p-3 text-center">
              <p className="font-medium text-sm">Swagger</p>
              <p className="text-xs text-muted-foreground">API explorer</p>
            </CardContent>
          </Card>
        </a>
      </div>

      {/* Main Documentation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="rest">REST</TabsTrigger>
          <TabsTrigger value="mcp">MCP</TabsTrigger>
          <TabsTrigger value="a2a">A2A</TabsTrigger>
        </TabsList>

        {/* REST API Tab */}
        <TabsContent value="rest" className="mt-0">
          <Card className="border-border/40">
            <CardHeader className="pb-4">
              <CardTitle className="font-serif text-xl">REST API</CardTitle>
              <CardDescription>Full REST API access. Authenticate with Bearer token or API key.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium text-sm mb-3">Base URL</h4>
                <CodeBlock code={API_URL} />
              </div>

              <div>
                <h4 className="font-medium text-sm mb-3">Authentication</h4>
                <p className="text-sm text-muted-foreground mb-3">Use Supabase JWT token or API key from settings.</p>
                <CodeBlock code={`# Bearer Token (User Auth)
curl -X GET ${API_URL}/users/me \\
  -H "Authorization: Bearer <supabase_access_token>"

# API Key (Service Auth)
curl -X GET ${API_URL}/mcp-server/discover \\
  -H "X-API-Key: coop_xxxxxxxxxxxxx"`} />
              </div>

              <div>
                <h4 className="font-medium text-sm mb-3">Run Agent (Sync)</h4>
                <CodeBlock code={`curl -X POST ${API_URL}/agents/run \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentType": "legal",
    "prompt": "What legal structure?",
    "sessionId": "<uuid>",
    "startupId": "<uuid>"
  }'`} />
              </div>

              <div>
                <h4 className="font-medium text-sm mb-3">Key Endpoints</h4>
                <div className="space-y-2">
                  {endpoints.map((ep) => (
                    <div key={ep.path} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                      <Badge variant={ep.method === 'GET' ? 'secondary' : 'default'} className="text-[10px] w-12 justify-center">{ep.method}</Badge>
                      <code className="text-xs flex-1">{ep.path}</code>
                      <span className="text-xs text-muted-foreground">{ep.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MCP Tab */}
        <TabsContent value="mcp" className="mt-0">
          <Card className="border-border/40">
            <CardHeader className="pb-4">
              <CardTitle className="font-serif text-xl">MCP Protocol</CardTitle>
              <CardDescription>Use in Claude Desktop, Cursor, Kiro, and MCP clients.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm"><strong>MCP</strong> lets AI assistants use external tools. Co-Op exposes agents as MCP tools.</p>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-3">Discover Tools</h4>
                <CodeBlock code={`curl -X GET ${API_URL}/mcp-server/discover \\
  -H "X-API-Key: coop_your_api_key_here"`} />
                <p className="text-xs text-muted-foreground mt-2">Create an API key in <Link href="/settings/api-keys" className="underline">Settings → API Keys</Link></p>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-3">Execute Tool</h4>
                <CodeBlock code={`curl -X POST ${API_URL}/mcp-server/execute \\
  -H "X-API-Key: coop_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "investor_search",
    "arguments": {
      "prompt": "Find seed VCs for AI startups",
      "companyName": "MyStartup",
      "industry": "ai",
      "stage": "seed"
    }
  }'`} />
              </div>

              <div>
                <h4 className="font-medium text-sm mb-3">Claude Desktop Config</h4>
                <p className="text-sm text-muted-foreground mb-3">Add to <code className="text-xs bg-muted px-1 py-0.5 rounded">claude_desktop_config.json</code>:</p>
                <CodeBlock code={`{
  "mcpServers": {
    "co-op": {
      "command": "curl",
      "args": ["-X", "GET", "${API_URL}/mcp-server/discover"],
      "env": { "X_API_KEY": "coop_your_api_key_here" }
    }
  }
}`} language="json" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* A2A Tab */}
        <TabsContent value="a2a" className="mt-0">
          <Card className="border-border/40">
            <CardHeader className="pb-4">
              <CardTitle className="font-serif text-xl">A2A Protocol</CardTitle>
              <CardDescription>Multi-agent queries with cross-critique consensus.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm"><strong>A2A</strong> enables agents to collaborate, cross-critique, and synthesize consensus answers.</p>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-3">How It Works</h4>
                <div className="space-y-3">
                  {a2aSteps.map((item) => (
                    <div key={item.step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-medium">{item.step}</div>
                      <div>
                        <p className="font-medium text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-3">Multi-Agent Query</h4>
                <CodeBlock code={`curl -X POST ${API_URL}/mcp-server/execute \\
  -H "X-API-Key: coop_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "multi_agent_query",
    "arguments": {
      "prompt": "Prepare for Series A fundraising",
      "agents": ["legal", "finance", "investor"]
    }
  }'`} />
              </div>

              <div>
                <h4 className="font-medium text-sm mb-3">Agent Capabilities</h4>
                <div className="grid grid-cols-2 gap-3">
                  {agentCapabilities.map((item) => (
                    <div key={item.agent} className="p-3 rounded-lg border border-border/40">
                      <p className="font-medium text-sm capitalize mb-2">{item.agent}</p>
                      <div className="flex flex-wrap gap-1">
                        {item.actions.map((action) => (
                          <Badge key={action} variant="outline" className="text-[10px]">{action}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Agents Section - BELOW TABS */}
      <Card className="border-border/40 mb-6">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-xl">Agents</CardTitle>
          <CardDescription>Four specialized agents with LLM Council.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agents.map((agent) => (
              <div key={agent.id} className="p-4 rounded-lg border border-border/40">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">{agent.name}</p>
                  <Badge variant="outline" className="text-[10px]">{agent.source}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{agent.description}</p>
                <code className="text-[10px] text-muted-foreground mt-1 block">&quot;{agent.id}&quot;</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* LLM Council Section - BELOW AGENTS */}
      <Card className="border-border/40">
        <CardHeader className="pb-4">
          <CardTitle className="font-serif text-xl">LLM Council</CardTitle>
          <CardDescription>Cross-validated by multiple AI models.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">2-5 AI models generate, cross-critique anonymously, then synthesize the best answer.</p>
          <div className="grid grid-cols-3 gap-3">
            {llmModels.map((model) => (
              <div key={model.name} className="p-3 rounded-lg bg-muted/30 text-center">
                <p className="text-xs font-medium truncate">{model.name}</p>
                <p className="text-[10px] text-muted-foreground">{model.provider}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
