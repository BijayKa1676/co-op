import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import {
  LlmProviderService,
  LlmProvider,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  StreamChunk,
} from '../types/llm.types';

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

@Injectable()
export class GroqProvider implements LlmProviderService {
  readonly provider: LlmProvider = 'groq';
  private readonly logger = new Logger(GroqProvider.name);
  private readonly client: Groq;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');

    if (!apiKey) {
      this.logger.warn('GROQ_API_KEY not configured - Groq provider disabled');
      this.client = null as unknown as Groq;
    } else {
      this.client = new Groq({ apiKey });
      this.defaultModel = this.configService.get<string>('GROQ_MODEL', DEFAULT_MODEL);
      this.logger.log(`Groq provider initialized with model: ${this.defaultModel}`);
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async chat(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<ChatCompletionResult> {
    if (!this.client) {
      throw new Error('Groq provider not configured');
    }

    const model = options?.model ?? this.defaultModel;

    const response = await this.client.chat.completions.create({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      top_p: options?.topP ?? 1,
    });

    const choice = response.choices[0];
    
    // Guard against empty choices array
    if (!choice) {
      throw new Error('Groq returned empty response');
    }

    return {
      content: choice.message.content ?? '',
      provider: this.provider,
      model: response.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      finishReason: choice.finish_reason ?? 'unknown',
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncGenerator<StreamChunk> {
    if (!this.client) {
      throw new Error('Groq provider not configured');
    }

    const model = options?.model ?? this.defaultModel;

    const stream = await this.client.chat.completions.create({
      model,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      top_p: options?.topP ?? 1,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content ?? '';
      const isComplete = chunk.choices[0]?.finish_reason !== null;
      yield { content, isComplete };
    }
  }
}
