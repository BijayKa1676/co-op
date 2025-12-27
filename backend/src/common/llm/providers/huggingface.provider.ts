import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InferenceClient } from '@huggingface/inference';
import {
  LlmProviderService,
  LlmProvider,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  StreamChunk,
} from '../types/llm.types';

const DEFAULT_MODEL = 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B';

@Injectable()
export class HuggingFaceProvider implements LlmProviderService {
  readonly provider: LlmProvider = 'huggingface';
  private readonly logger = new Logger(HuggingFaceProvider.name);
  private readonly client: InferenceClient | null;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('HUGGINGFACE_API_KEY');

    if (!apiKey) {
      this.logger.warn('HUGGINGFACE_API_KEY not configured - HuggingFace provider disabled');
      this.client = null;
    } else {
      this.client = new InferenceClient(apiKey);
      this.defaultModel = this.configService.get<string>('HUGGINGFACE_MODEL', DEFAULT_MODEL);
      this.logger.log(`HuggingFace provider initialized with model: ${this.defaultModel}`);
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async chat(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<ChatCompletionResult> {
    if (!this.client) {
      throw new Error('HuggingFace provider not configured');
    }

    const model = options?.model ?? this.defaultModel;

    const response = await this.client.chatCompletion({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      top_p: options?.topP ?? 1,
    });

    const choice = response.choices[0];
    
    // Guard against empty choices array
    if (!choice) {
      throw new Error('HuggingFace returned empty response');
    }

    return {
      content: choice.message.content ?? '',
      provider: this.provider,
      model,
      usage: {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0),
      },
      finishReason: choice.finish_reason ?? 'unknown',
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatCompletionOptions,
  ): AsyncGenerator<StreamChunk> {
    if (!this.client) {
      throw new Error('HuggingFace provider not configured');
    }

    const model = options?.model ?? this.defaultModel;

    const stream = this.client.chatCompletionStream({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      top_p: options?.topP ?? 1,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content ?? '';
      const isComplete = chunk.choices[0]?.finish_reason !== null;
      yield { content, isComplete };
    }
  }
}
