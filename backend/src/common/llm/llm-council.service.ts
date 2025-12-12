import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { GroqProvider } from './providers/groq.provider';
import { GoogleProvider } from './providers/google.provider';
import { HuggingFaceProvider } from './providers/huggingface.provider';
import {
  LlmProvider,
  LlmProviderService,
  ChatMessage,
  ChatCompletionOptions,
  CouncilResponse,
  CouncilCritique,
  CouncilResult,
  ModelConfig,
  ModelHealthCheck,
  AVAILABLE_MODELS,
} from './types/llm.types';

interface CritiqueJson {
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
}

const CONCISE_INSTRUCTION = `
CRITICAL: Be concise. No fluff. Bullet points preferred. Max 3-5 sentences per point.
- Skip introductions and conclusions
- No "I think" or "In my opinion"
- Direct answers only
- Use lists and structure
- Cite specifics, not generalities`;

@Injectable()
export class LlmCouncilService implements OnModuleInit {
  private readonly logger = new Logger(LlmCouncilService.name);
  private readonly providers: Map<LlmProvider, LlmProviderService>;
  private availableModels: ModelConfig[] = [];
  private healthCheckResults = new Map<string, ModelHealthCheck>();

  constructor(
    private readonly groqProvider: GroqProvider,
    private readonly googleProvider: GoogleProvider,
    private readonly huggingFaceProvider: HuggingFaceProvider,
  ) {
    this.providers = new Map<LlmProvider, LlmProviderService>([
      ['groq', this.groqProvider],
      ['google', this.googleProvider],
      ['huggingface', this.huggingFaceProvider],
    ]);
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Running LLM model health checks on boot...');
    await this.runHealthChecks();
  }

  async runHealthChecks(): Promise<ModelHealthCheck[]> {
    const configuredModels = this.detectConfiguredModels();
    this.logger.log(`Checking ${String(configuredModels.length)} configured models...`);

    const results: ModelHealthCheck[] = [];
    const healthyModels: ModelConfig[] = [];

    for (const model of configuredModels) {
      const result = await this.checkModelHealth(model);
      results.push(result);
      this.healthCheckResults.set(`${model.provider}:${model.model}`, result);

      const statusIcon = result.status === 'healthy' ? '✓' : '✗';
      const latency = result.latencyMs > 0 ? `${String(result.latencyMs)}ms` : '-';
      
      if (result.status === 'healthy') {
        this.logger.log(`  ${statusIcon} ${model.name} (${model.provider}) - ${latency}`);
        healthyModels.push(model);
      } else {
        this.logger.warn(`  ${statusIcon} ${model.name} (${model.provider}) - ${result.status}: ${result.error ?? 'unknown'}`);
      }
    }

    this.availableModels = healthyModels;
    
    const healthyCount = healthyModels.length;
    const totalCount = configuredModels.length;
    
    if (healthyCount < 2) {
      this.logger.error(`CRITICAL: Only ${String(healthyCount)} healthy models. Council requires minimum 2.`);
    } else {
      this.logger.log(`LLM Council ready: ${String(healthyCount)}/${String(totalCount)} models healthy`);
    }

    return results;
  }

  private async checkModelHealth(model: ModelConfig): Promise<ModelHealthCheck> {
    const provider = this.providers.get(model.provider);
    const startTime = Date.now();

    if (!provider?.isAvailable()) {
      return {
        model: model.model,
        provider: model.provider,
        name: model.name,
        status: 'unavailable',
        latencyMs: 0,
        error: 'Provider not configured (missing API key)',
        checkedAt: new Date(),
      };
    }

    try {
      // Simple health check prompt - minimal tokens
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Reply with only: OK' },
      ];

      await provider.chat(messages, {
        model: model.model,
        temperature: 0,
        maxTokens: 10,
      });

      return {
        model: model.model,
        provider: model.provider,
        name: model.name,
        status: 'healthy',
        latencyMs: Date.now() - startTime,
        checkedAt: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isDeprecated = errorMessage.toLowerCase().includes('decommissioned') ||
                          errorMessage.toLowerCase().includes('deprecated') ||
                          errorMessage.toLowerCase().includes('not found') ||
                          errorMessage.toLowerCase().includes('not supported');

      return {
        model: model.model,
        provider: model.provider,
        name: model.name,
        status: isDeprecated ? 'deprecated' : 'error',
        latencyMs: Date.now() - startTime,
        error: errorMessage.slice(0, 200),
        checkedAt: new Date(),
      };
    }
  }

  private detectConfiguredModels(): ModelConfig[] {
    return AVAILABLE_MODELS.filter(model => {
      const provider = this.providers.get(model.provider);
      return provider?.isAvailable() ?? false;
    });
  }

  getHealthCheckResults(): ModelHealthCheck[] {
    return Array.from(this.healthCheckResults.values());
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async runCouncil(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      minModels?: number;
      maxModels?: number;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<CouncilResult> {
    const startTime = Date.now();
    const minModels = options?.minModels ?? 3;
    const maxModels = options?.maxModels ?? 5;

    // Select models for the council
    const councilModels = this.selectCouncilModels(minModels, maxModels);

    // MANDATORY: Must have at least 2 models for cross-critique
    if (councilModels.length < 2) {
      throw new BadRequestException(
        `Council requires minimum 2 models for cross-critique. Only ${String(councilModels.length)} available.`,
      );
    }

    this.logger.log(`Council: ${String(councilModels.length)} models: ${councilModels.map(m => m.name).join(', ')}`);

    // Inject concise instruction into system prompt
    const enhancedSystemPrompt = `${systemPrompt}\n${CONCISE_INSTRUCTION}`;

    // Phase 1: All models generate responses anonymously
    const responses = await this.generateResponses(
      councilModels,
      enhancedSystemPrompt,
      userPrompt,
      { temperature: options?.temperature ?? 0.7, maxTokens: options?.maxTokens ?? 1024 },
    );

    // MANDATORY: Must have at least 2 responses
    if (responses.length < 2) {
      throw new BadRequestException(
        `Council requires minimum 2 responses. Only ${String(responses.length)} succeeded.`,
      );
    }

    // Shuffle responses for anonymous critique
    const shuffledResponses = this.shuffleArray(responses);

    // Phase 2: MANDATORY cross-critique - each model critiques others
    const critiques = await this.generateCritiques(
      councilModels,
      shuffledResponses,
      enhancedSystemPrompt,
      userPrompt,
    );

    // MANDATORY: Must have critiques
    if (critiques.length === 0) {
      throw new BadRequestException('Council critique phase failed. No critiques generated.');
    }

    this.logger.log(`Council: ${String(critiques.length)} critiques generated`);

    // Phase 3: Synthesize final response based on critiques
    const { finalResponse, bestResponseId, averageScore } = await this.synthesizeFinal(
      shuffledResponses,
      critiques,
      enhancedSystemPrompt,
      userPrompt,
    );

    const totalTokens = responses.reduce((sum, r) => sum + r.tokens, 0) +
      critiques.length * 300; // Estimate critique tokens

    return {
      responses: shuffledResponses,
      critiques,
      finalResponse,
      consensus: {
        averageScore,
        bestResponseId,
        synthesized: true,
      },
      metadata: {
        totalTokens,
        modelsUsed: councilModels.map(m => m.name),
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  private selectCouncilModels(min: number, max: number): ModelConfig[] {
    if (this.availableModels.length === 0) {
      throw new Error('No LLM models available. Configure at least one provider.');
    }

    const available = this.shuffleArray(this.availableModels);
    // Use what we have, even if less than min
    const count = Math.min(available.length, max);

    if (count < min) {
      this.logger.warn(`Only ${String(count)} models available, requested minimum ${String(min)}`);
    }

    return available.slice(0, count);
  }

  private async generateResponses(
    models: ModelConfig[],
    systemPrompt: string,
    userPrompt: string,
    options: ChatCompletionOptions,
  ): Promise<CouncilResponse[]> {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const responsePromises = models.map(async (model): Promise<CouncilResponse | null> => {
      const provider = this.providers.get(model.provider);
      if (!provider) return null;

      try {
        const result = await provider.chat(messages, { ...options, model: model.model });
        return {
          id: uuid(),
          content: result.content,
          provider: model.provider,
          model: model.model,
          tokens: result.usage.totalTokens,
        };
      } catch (error) {
        this.logger.warn(`Model ${model.name} failed to generate response`, error);
        return null;
      }
    });

    const results = await Promise.all(responsePromises);
    return results.filter((r): r is CouncilResponse => r !== null);
  }

  private async generateCritiques(
    models: ModelConfig[],
    responses: CouncilResponse[],
    systemPrompt: string,
    originalPrompt: string,
  ): Promise<CouncilCritique[]> {
    const critiques: CouncilCritique[] = [];

    // Each model critiques responses (excluding their own)
    for (const model of models) {
      const provider = this.providers.get(model.provider);
      if (!provider) continue;

      // Find responses not from this model
      const otherResponses = responses.filter(
        r => !(r.provider === model.provider && r.model === model.model),
      );

      for (const response of otherResponses) {
        try {
          const critique = await this.critiqueResponse(
            provider,
            model,
            response,
            systemPrompt,
            originalPrompt,
          );
          if (critique) {
            critiques.push(critique);
          }
        } catch (error) {
          this.logger.warn(`Model ${model.name} failed to critique response ${response.id}`, error);
        }
      }
    }

    return critiques;
  }

  private async critiqueResponse(
    provider: LlmProviderService,
    criticModel: ModelConfig,
    response: CouncilResponse,
    _systemPrompt: string,
    originalPrompt: string,
  ): Promise<CouncilCritique | null> {
    const critiquePrompt = `Evaluate this response. Be harsh but fair.

Question: ${originalPrompt}

Response:
${response.content}

JSON format only:
{"score":1-10,"feedback":"1 sentence","strengths":["max 2"],"weaknesses":["max 2"]}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a critical evaluator. Respond only with valid JSON.' },
      { role: 'user', content: critiquePrompt },
    ];

    const result = await provider.chat(messages, {
      model: criticModel.model,
      temperature: 0.3,
      maxTokens: 1024,
    });

    try {
      const parsed = JSON.parse(result.content.trim()) as CritiqueJson;
      return {
        responseId: response.id,
        criticId: `${criticModel.provider}:${criticModel.model}`,
        score: Math.min(10, Math.max(1, parsed.score)),
        feedback: parsed.feedback,
        strengths: parsed.strengths ?? [],
        weaknesses: parsed.weaknesses ?? [],
      };
    } catch {
      this.logger.warn(`Failed to parse critique from ${criticModel.name}`);
      return null;
    }
  }

  private async synthesizeFinal(
    responses: CouncilResponse[],
    critiques: CouncilCritique[],
    systemPrompt: string,
    originalPrompt: string,
  ): Promise<{ finalResponse: string; bestResponseId: string; averageScore: number }> {
    // Calculate average scores per response
    const scoreMap = new Map<string, number[]>();
    for (const critique of critiques) {
      const scores = scoreMap.get(critique.responseId) ?? [];
      scores.push(critique.score);
      scoreMap.set(critique.responseId, scores);
    }

    let bestResponseId = responses[0]?.id ?? '';
    let highestAvg = 0;
    let totalAvg = 0;
    let count = 0;

    for (const [responseId, scores] of scoreMap) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      totalAvg += avg;
      count++;
      if (avg > highestAvg) {
        highestAvg = avg;
        bestResponseId = responseId;
      }
    }

    const averageScore = count > 0 ? totalAvg / count : 0;

    // Get the best response and key critiques
    const bestResponse = responses.find(r => r.id === bestResponseId);
    const relevantCritiques = critiques.filter(c => c.responseId === bestResponseId);

    // Use an available model to synthesize
    const synthModel = this.availableModels[0];
    if (!synthModel || !bestResponse) {
      return {
        finalResponse: bestResponse?.content ?? responses[0]?.content ?? '',
        bestResponseId,
        averageScore,
      };
    }

    const provider = this.providers.get(synthModel.provider);
    if (!provider) {
      return { finalResponse: bestResponse.content, bestResponseId, averageScore };
    }

    const synthesisPrompt = `Improve this response based on feedback. Be concise.

Question: ${originalPrompt}

Best response:
${bestResponse.content}

Feedback:
${relevantCritiques.map(c => `Score ${String(c.score)}/10: ${c.feedback}`).join('\n')}
Fix: ${relevantCritiques.flatMap(c => c.weaknesses).slice(0, 3).join(', ')}

Output improved response only. No preamble.`;

    try {
      const result = await provider.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: synthesisPrompt },
        ],
        { model: synthModel.model, temperature: 0.3, maxTokens: 2048 },
      );

      return { finalResponse: result.content, bestResponseId, averageScore };
    } catch {
      return { finalResponse: bestResponse.content, bestResponseId, averageScore };
    }
  }

  getAvailableModels(): ModelConfig[] {
    return [...this.availableModels];
  }
}
