export type LlmProvider = 'groq' | 'google' | 'huggingface';

export interface ModelConfig {
  provider: LlmProvider;
  model: string;
  name: string; // Human-readable name for logging
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface ChatCompletionResult {
  content: string;
  provider: LlmProvider;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export interface StreamChunk {
  content: string;
  isComplete: boolean;
}

export interface LlmProviderService {
  readonly provider: LlmProvider;
  chat(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<ChatCompletionResult>;
  chatStream?(messages: ChatMessage[], options?: ChatCompletionOptions): AsyncGenerator<StreamChunk>;
  isAvailable(): boolean;
}

// LLM Council types
export interface CouncilResponse {
  id: string; // Anonymous ID for shuffling
  content: string;
  provider: LlmProvider;
  model: string;
  tokens: number;
}

export interface CouncilCritique {
  responseId: string;
  criticId: string;
  score: number; // 1-10
  feedback: string;
  strengths: string[];
  weaknesses: string[];
}

export interface CouncilResult {
  responses: CouncilResponse[];
  critiques: CouncilCritique[];
  finalResponse: string;
  consensus: {
    averageScore: number;
    bestResponseId: string;
    synthesized: boolean;
  };
  metadata: {
    totalTokens: number;
    modelsUsed: string[];
    processingTimeMs: number;
  };
}

// LLM Router config (for simple phase-based routing)
export interface LlmRouterConfig {
  draft: LlmProvider;
  critique: LlmProvider;
  final: LlmProvider;
}

export const DEFAULT_ROUTER_CONFIG: LlmRouterConfig = {
  draft: 'groq',
  critique: 'google',
  final: 'huggingface',
};

// Model health check result
export interface ModelHealthCheck {
  model: string;
  provider: LlmProvider;
  name: string;
  status: 'healthy' | 'deprecated' | 'error' | 'unavailable';
  latencyMs: number;
  error?: string;
  checkedAt: Date;
}

// Available models configuration - updated Dec 2025
// Health check validates on boot - only healthy models used
export const AVAILABLE_MODELS: ModelConfig[] = [
  // Groq - verified working
  { provider: 'groq', model: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
  { provider: 'groq', model: 'openai/gpt-oss-120b', name: 'GPT OSS 120B' },

  // Google AI - Gemini 3 Pro
  { provider: 'google', model: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },

  // HuggingFace - serverless inference
  { provider: 'huggingface', model: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B', name: 'DeepSeek R1 32B' },
  { provider: 'huggingface', model: 'meta-llama/Meta-Llama-3-8B-Instruct', name: 'Llama 3 8B' },
];
