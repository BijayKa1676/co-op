import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroqProvider } from './providers/groq.provider';
import { GoogleProvider } from './providers/google.provider';
import { HuggingFaceProvider } from './providers/huggingface.provider';
import {
  LlmProvider,
  LlmProviderService,
  LlmRouterConfig,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  StreamChunk,
  DEFAULT_ROUTER_CONFIG,
} from './types/llm.types';

export type AgentPhase = 'draft' | 'critique' | 'final';

@Injectable()
export class LlmRouterService {
  private readonly logger = new Logger(LlmRouterService.name);
  private readonly providers: Map<LlmProvider, LlmProviderService>;
  private readonly routerConfig: LlmRouterConfig;
  private readonly availableProviders: LlmProvider[];

  constructor(
    private readonly configService: ConfigService,
    private readonly groqProvider: GroqProvider,
    private readonly googleProvider: GoogleProvider,
    private readonly huggingFaceProvider: HuggingFaceProvider,
  ) {
    this.providers = new Map<LlmProvider, LlmProviderService>([
      ['groq', this.groqProvider],
      ['google', this.googleProvider],
      ['huggingface', this.huggingFaceProvider],
    ]);

    this.availableProviders = this.detectAvailableProviders();
    this.routerConfig = this.buildRouterConfig();

    this.logger.log(`LLM Router initialized with providers: ${this.availableProviders.join(', ')}`);
    this.logger.log(`Router config: draft=${this.routerConfig.draft}, critique=${this.routerConfig.critique}, final=${this.routerConfig.final}`);
  }

  private detectAvailableProviders(): LlmProvider[] {
    const available: LlmProvider[] = [];

    if (this.groqProvider.isAvailable()) available.push('groq');
    if (this.googleProvider.isAvailable()) available.push('google');
    if (this.huggingFaceProvider.isAvailable()) available.push('huggingface');

    if (available.length === 0) {
      throw new Error('No LLM providers configured. Set at least one of: GROQ_API_KEY, GOOGLE_AI_API_KEY, HUGGINGFACE_API_KEY');
    }

    return available;
  }

  private buildRouterConfig(): LlmRouterConfig {
    const configuredDraft = this.configService.get<LlmProvider>('LLM_DRAFT_PROVIDER');
    const configuredCritique = this.configService.get<LlmProvider>('LLM_CRITIQUE_PROVIDER');
    const configuredFinal = this.configService.get<LlmProvider>('LLM_FINAL_PROVIDER');

    const getProvider = (configured: LlmProvider | undefined, defaultProvider: LlmProvider): LlmProvider => {
      if (configured && this.availableProviders.includes(configured)) {
        return configured;
      }
      if (this.availableProviders.includes(defaultProvider)) {
        return defaultProvider;
      }
      return this.availableProviders[0];
    };

    return {
      draft: getProvider(configuredDraft, DEFAULT_ROUTER_CONFIG.draft),
      critique: getProvider(configuredCritique, DEFAULT_ROUTER_CONFIG.critique),
      final: getProvider(configuredFinal, DEFAULT_ROUTER_CONFIG.final),
    };
  }

  getProviderForPhase(phase: AgentPhase): LlmProviderService {
    const providerName = this.routerConfig[phase];
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`Provider ${providerName} not found for phase ${phase}`);
    }

    return provider;
  }

  async chatForPhase(
    phase: AgentPhase,
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    const provider = this.getProviderForPhase(phase);
    this.logger.debug(`Using ${provider.provider} for ${phase} phase`);

    try {
      return await provider.chat(messages, options);
    } catch (error) {
      this.logger.error(`${provider.provider} failed for ${phase}, attempting fallback`, error);
      return this.chatWithFallback(messages, options, provider.provider);
    }
  }

  async *streamForPhase(
    phase: AgentPhase,
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncGenerator<StreamChunk> {
    const provider = this.getProviderForPhase(phase);
    this.logger.debug(`Streaming with ${provider.provider} for ${phase} phase`);

    if (!provider.chatStream) {
      const result = await provider.chat(messages, options);
      yield { content: result.content, isComplete: true };
      return;
    }

    yield* provider.chatStream(messages, options);
  }

  private async chatWithFallback(
    messages: ChatMessage[],
    options: ChatCompletionOptions | undefined,
    excludeProvider: LlmProvider,
  ): Promise<ChatCompletionResult> {
    for (const providerName of this.availableProviders) {
      if (providerName === excludeProvider) continue;

      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        this.logger.log(`Falling back to ${providerName}`);
        return await provider.chat(messages, options);
      } catch (error) {
        this.logger.warn(`Fallback to ${providerName} also failed`, error);
      }
    }

    throw new Error('All LLM providers failed');
  }

  async generateWithSystemPrompt(
    phase: AgentPhase,
    systemPrompt: string,
    userPrompt: string,
    options?: ChatCompletionOptions,
  ): Promise<ChatCompletionResult> {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    return this.chatForPhase(phase, messages, options);
  }

  getAvailableProviders(): LlmProvider[] {
    return [...this.availableProviders];
  }

  getRouterConfig(): LlmRouterConfig {
    return { ...this.routerConfig };
  }
}
