import { Injectable, Logger } from '@nestjs/common';
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
  AVAILABLE_MODELS,
} from './types/llm.types';

interface CritiqueJson {
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
}

@Injectable()
export class LlmCouncilService {
  private readonly logger = new Logger(LlmCouncilService.name);
  private readonly providers: Map<LlmProvider, LlmProviderService>;
  private readonly availableModels: ModelConfig[];

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

    this.availableModels = this.detectAvailableModels();
    this.logger.log(`LLM Council initialized with ${String(this.availableModels.length)} models`);
  }

  private detectAvailableModels(): ModelConfig[] {
    return AVAILABLE_MODELS.filter(model => {
      const provider = this.providers.get(model.provider);
      return provider?.isAvailable() ?? false;
    });
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
    this.logger.log(`Council convened with ${String(councilModels.length)} models: ${councilModels.map(m => m.name).join(', ')}`);

    // Phase 1: All models generate responses anonymously
    const responses = await this.generateResponses(
      councilModels,
      systemPrompt,
      userPrompt,
      { temperature: options?.temperature ?? 0.7, maxTokens: options?.maxTokens ?? 2048 },
    );

    // Shuffle responses for anonymous critique
    const shuffledResponses = this.shuffleArray(responses);

    // Phase 2: Each model critiques shuffled responses (not their own)
    const critiques = await this.generateCritiques(
      councilModels,
      shuffledResponses,
      systemPrompt,
      userPrompt,
    );

    // Phase 3: Synthesize final response based on critiques
    const { finalResponse, bestResponseId, averageScore } = await this.synthesizeFinal(
      shuffledResponses,
      critiques,
      systemPrompt,
      userPrompt,
    );

    const totalTokens = responses.reduce((sum, r) => sum + r.tokens, 0) +
      critiques.reduce((sum, _c) => sum + 500, 0); // Estimate critique tokens

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
    systemPrompt: string,
    originalPrompt: string,
  ): Promise<CouncilCritique | null> {
    const critiquePrompt = `You are evaluating an AI response for accuracy and quality.

Original context: ${systemPrompt}

Original question: ${originalPrompt}

Response to evaluate:
${response.content}

Provide a JSON critique with:
- score (1-10, where 10 is perfect)
- feedback (brief overall assessment)
- strengths (array of strong points)
- weaknesses (array of issues or improvements needed)

Respond ONLY with valid JSON, no markdown:`;

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

    const synthesisPrompt = `You are synthesizing the best response based on council feedback.

Original context: ${systemPrompt}
Original question: ${originalPrompt}

Best rated response:
${bestResponse.content}

Council feedback:
${relevantCritiques.map(c => `- ${c.feedback}\n  Strengths: ${c.strengths.join(', ')}\n  Weaknesses: ${c.weaknesses.join(', ')}`).join('\n\n')}

Create an improved final response that:
1. Keeps the strengths identified
2. Addresses the weaknesses
3. Maintains accuracy and reduces hallucination

Provide only the improved response:`;

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
