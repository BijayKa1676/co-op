import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * Context Quality Assessment
 */
export interface ContextQuality {
  score: number; // 0-100
  issues: ContextIssue[];
  recommendations: string[];
  tokenCount: number;
  compressionRatio: number;
  documentRelevance?: number; // 0-100, how relevant documents are to query
}

export interface ContextIssue {
  type: 'pollution' | 'truncation' | 'redundancy' | 'irrelevance' | 'staleness';
  severity: 'low' | 'medium' | 'high';
  description: string;
  location?: string;
}

/**
 * Context Summary for transfer between agents
 */
export interface ContextSummary {
  id: string;
  originalTokens: number;
  compressedTokens: number;
  keyPoints: string[];
  entities: string[];
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  createdAt: Date;
  hash: string;
}

/**
 * Enhanced Confidence Calculation Result
 */
export interface ConfidenceResult {
  overall: number; // 0-100
  breakdown: {
    consensusScore: number;      // Model agreement (30%)
    critiqueAgreement: number;   // Critique consistency (20%)
    sourceQuality: number;       // Context/document quality (20%)
    responseQuality: number;     // Response completeness (15%)
    crossValidation: number;     // Cross-model validation (15%)
  };
  level: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  explanation: string;
  factors: string[];
}

// Token estimation constants
const AVG_CHARS_PER_TOKEN = 4;
const MAX_CONTEXT_TOKENS = 8000;
const OPTIMAL_CONTEXT_TOKENS = 4000;
const MAX_DOCUMENT_CHUNKS = 50; // Limit chunks to prevent token overflow

// Pollution detection patterns
const POLLUTION_PATTERNS = [
  { pattern: /\[.*?\]\(.*?\)/g, type: 'markdown_links' as const, weight: 0.1 },
  { pattern: /```[\s\S]*?```/g, type: 'code_blocks' as const, weight: 0.2 },
  { pattern: /#{1,6}\s+/g, type: 'headers' as const, weight: 0.05 },
  { pattern: /\*{1,2}[^*]+\*{1,2}/g, type: 'emphasis' as const, weight: 0.05 },
  { pattern: /\n{3,}/g, type: 'excessive_newlines' as const, weight: 0.1 },
  { pattern: /(.{50,})\1+/g, type: 'repetition' as const, weight: 0.5 },
  { pattern: /<[^>]+>/g, type: 'html_tags' as const, weight: 0.3 },
  { pattern: /\b(undefined|null|NaN|error|exception)\b/gi, type: 'error_artifacts' as const, weight: 0.4 },
];

// Irrelevance detection keywords (off-topic for startup advisory)
const IRRELEVANCE_KEYWORDS = [
  'weather', 'sports', 'celebrity', 'recipe', 'movie review',
  'personal relationship', 'dating', 'horoscope', 'lottery',
];

// Domain-specific keywords for relevance scoring
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  legal: ['contract', 'agreement', 'compliance', 'regulation', 'law', 'legal', 'attorney', 'liability', 'intellectual property', 'trademark', 'patent', 'copyright'],
  finance: ['funding', 'revenue', 'investment', 'valuation', 'runway', 'burn', 'capital', 'equity', 'debt', 'cash flow', 'profit', 'loss', 'budget'],
  investor: ['vc', 'investor', 'pitch', 'term sheet', 'equity', 'dilution', 'round', 'seed', 'series', 'angel', 'portfolio'],
  competitor: ['market', 'competitor', 'competition', 'positioning', 'differentiation', 'market share', 'competitive advantage'],
  general: ['startup', 'business', 'company', 'growth', 'strategy', 'product', 'customer', 'team', 'founder'],
};

@Injectable()
export class ContextManagerService {
  /**
   * Estimate token count from text
   */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / AVG_CHARS_PER_TOKEN);
  }

  /**
   * Generate hash for context deduplication
   */
  generateContextHash(text: string): string {
    return createHash('sha256').update(text).digest('hex').slice(0, 16);
  }

  /**
   * Get maximum allowed document chunks
   */
  getMaxDocumentChunks(): number {
    return MAX_DOCUMENT_CHUNKS;
  }

  /**
   * Assess context quality and detect issues
   */
  assessContextQuality(context: string, query?: string): ContextQuality {
    const issues: ContextIssue[] = [];
    const recommendations: string[] = [];
    const tokenCount = this.estimateTokens(context);
    let qualityScore = 100;

    // Check for context pollution
    for (const { pattern, type, weight } of POLLUTION_PATTERNS) {
      const matches = context.match(pattern);
      if (matches && matches.length > 0) {
        const severity = matches.length > 10 ? 'high' : matches.length > 3 ? 'medium' : 'low';
        const penalty = weight * matches.length * (severity === 'high' ? 3 : severity === 'medium' ? 2 : 1);
        qualityScore -= Math.min(penalty * 5, 20);
        
        issues.push({
          type: 'pollution',
          severity,
          description: `Found ${matches.length} instances of ${type.replace('_', ' ')}`,
        });
      }
    }

    // Check for truncation indicators
    if (context.includes('...') || context.includes('[truncated]') || context.includes('[...]')) {
      issues.push({
        type: 'truncation',
        severity: 'medium',
        description: 'Context appears to be truncated',
      });
      qualityScore -= 10;
      recommendations.push('Consider fetching complete context or summarizing properly');
    }

    // Check for redundancy (repeated sentences)
    const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
    const redundancyRatio = 1 - (uniqueSentences.size / Math.max(sentences.length, 1));
    if (redundancyRatio > 0.2) {
      issues.push({
        type: 'redundancy',
        severity: redundancyRatio > 0.4 ? 'high' : 'medium',
        description: `${Math.round(redundancyRatio * 100)}% redundant content detected`,
      });
      qualityScore -= redundancyRatio * 30;
      recommendations.push('Remove duplicate information to improve context efficiency');
    }

    // Check for irrelevance
    const lowerContext = context.toLowerCase();
    const irrelevantMatches = IRRELEVANCE_KEYWORDS.filter(kw => lowerContext.includes(kw));
    if (irrelevantMatches.length > 0) {
      issues.push({
        type: 'irrelevance',
        severity: irrelevantMatches.length > 2 ? 'high' : 'medium',
        description: `Off-topic content detected: ${irrelevantMatches.join(', ')}`,
      });
      qualityScore -= irrelevantMatches.length * 10;
      recommendations.push('Filter out off-topic content before processing');
    }

    // Check context size
    if (tokenCount > MAX_CONTEXT_TOKENS) {
      issues.push({
        type: 'truncation',
        severity: 'high',
        description: `Context exceeds max tokens (${tokenCount}/${MAX_CONTEXT_TOKENS})`,
      });
      qualityScore -= 15;
      recommendations.push('Compress or summarize context to fit within limits');
    } else if (tokenCount > OPTIMAL_CONTEXT_TOKENS) {
      recommendations.push('Consider summarizing for optimal performance');
    }

    // Calculate compression ratio
    const compressionRatio = tokenCount / MAX_CONTEXT_TOKENS;

    // Calculate document relevance if query provided
    let documentRelevance: number | undefined;
    if (query) {
      documentRelevance = this.calculateDocumentRelevance(context, query);
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(qualityScore))),
      issues,
      recommendations,
      tokenCount,
      compressionRatio,
      documentRelevance,
    };
  }

  /**
   * Calculate how relevant document content is to the query
   */
  calculateDocumentRelevance(documentContent: string, query: string): number {
    const lowerDoc = documentContent.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    // Extract query keywords (words > 3 chars, not common words)
    const commonWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'would', 'could', 'should', 'what', 'when', 'where', 'which', 'their', 'there', 'this', 'that', 'with', 'from', 'they', 'will', 'about', 'into', 'more', 'some', 'than', 'them', 'then', 'these', 'only', 'other', 'also', 'just', 'over', 'such', 'make', 'like', 'most', 'very', 'after', 'before', 'being', 'between', 'both', 'each', 'first', 'through', 'under', 'while', 'does', 'doing', 'during', 'without', 'again', 'because', 'same', 'different', 'however', 'therefore', 'although', 'though', 'since', 'until', 'unless', 'whether', 'either', 'neither', 'rather', 'quite', 'still', 'already', 'always', 'never', 'often', 'sometimes', 'usually', 'really', 'actually', 'probably', 'certainly', 'definitely', 'perhaps', 'maybe', 'might', 'must', 'shall', 'need', 'want', 'know', 'think', 'believe', 'feel', 'seem', 'appear', 'become', 'remain', 'stay', 'keep', 'let', 'help', 'show', 'tell', 'ask', 'give', 'take', 'come', 'go', 'see', 'look', 'find', 'get', 'put', 'say', 'said', 'made', 'went', 'came', 'took', 'gave', 'found', 'told', 'asked', 'used', 'using', 'work', 'working', 'works', 'worked', 'way', 'ways', 'thing', 'things', 'time', 'times', 'year', 'years', 'day', 'days', 'week', 'weeks', 'month', 'months', 'people', 'person', 'place', 'places', 'part', 'parts', 'number', 'numbers', 'point', 'points', 'case', 'cases', 'fact', 'facts', 'group', 'groups', 'problem', 'problems', 'question', 'questions', 'answer', 'answers', 'example', 'examples', 'reason', 'reasons', 'result', 'results', 'change', 'changes', 'level', 'levels', 'kind', 'kinds', 'type', 'types', 'form', 'forms', 'area', 'areas', 'side', 'sides', 'line', 'lines', 'word', 'words', 'name', 'names', 'home', 'house', 'world', 'country', 'state', 'city', 'school', 'family', 'student', 'students', 'child', 'children', 'hand', 'hands', 'head', 'eye', 'eyes', 'face', 'body', 'life', 'water', 'money', 'story', 'stories', 'book', 'books', 'room', 'friend', 'friends', 'right', 'left', 'high', 'low', 'long', 'short', 'small', 'large', 'big', 'little', 'old', 'new', 'young', 'good', 'bad', 'great', 'important', 'possible', 'able', 'available', 'free', 'full', 'sure', 'clear', 'true', 'real', 'whole', 'own', 'next', 'last', 'early', 'late', 'hard', 'easy', 'open', 'close', 'public', 'private', 'local', 'national', 'international', 'social', 'political', 'economic', 'human', 'personal', 'special', 'general', 'common', 'simple', 'major', 'main', 'best', 'better', 'worse', 'worst']);
    
    const queryWords = lowerQuery
      .split(/\s+/)
      .filter(w => w.length > 3 && !commonWords.has(w));
    
    if (queryWords.length === 0) return 50; // Default if no meaningful keywords
    
    // Count keyword matches
    let matchCount = 0;
    for (const word of queryWords) {
      if (lowerDoc.includes(word)) {
        matchCount++;
      }
    }
    
    // Calculate base relevance from keyword matches
    const keywordRelevance = (matchCount / queryWords.length) * 100;
    
    // Check for domain-specific relevance
    let domainBonus = 0;
    for (const [, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      const domainMatches = keywords.filter(kw => lowerDoc.includes(kw) && lowerQuery.includes(kw));
      if (domainMatches.length > 0) {
        domainBonus += domainMatches.length * 5;
      }
    }
    
    return Math.min(100, Math.round(keywordRelevance + domainBonus));
  }


  /**
   * Clean and optimize context by removing pollution while preserving structure
   */
  cleanContext(context: string, preserveStructure = true): string {
    let cleaned = context;

    // Remove HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, '');
    
    if (preserveStructure) {
      // Preserve numbered lists and bullet points
      cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links - keep text
      cleaned = cleaned.replace(/^#{1,6}\s+(.+)$/gm, '$1:'); // Headers - convert to text with colon
      cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold - keep text
      cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1'); // Italic - keep text
      cleaned = cleaned.replace(/`([^`]+)`/g, '$1'); // Inline code - keep text
      // Keep numbered lists as-is
      // Keep bullet points but normalize
      cleaned = cleaned.replace(/^[\*\-]\s+/gm, '- ');
    } else {
      // Remove all markdown formatting
      cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      cleaned = cleaned.replace(/#{1,6}\s+/g, '');
      cleaned = cleaned.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1');
      cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    }
    
    // Remove code blocks but keep content
    cleaned = cleaned.replace(/```[\w]*\n?([\s\S]*?)```/g, '$1');
    
    // Normalize whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    
    // Remove error artifacts
    cleaned = cleaned.replace(/\b(undefined|null|NaN)\b/gi, '');
    
    return cleaned.trim();
  }

  /**
   * Create a compressed summary of context for transfer between agents
   */
  createContextSummary(context: string, maxPoints = 5): ContextSummary {
    const cleaned = this.cleanContext(context);
    const originalTokens = this.estimateTokens(context);
    
    // Extract key sentences (simple extractive summarization)
    const sentences = cleaned.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 30 && s.length < 300);
    
    // Score sentences by position and keyword density
    const scoredSentences = sentences.map((sentence, index) => {
      let score = 0;
      // Position bias (first and last sentences often important)
      if (index < 3) score += 2;
      if (index >= sentences.length - 2) score += 1;
      // Keyword density
      const keywords = ['important', 'key', 'must', 'should', 'recommend', 'critical', 'essential', 'required', 'necessary'];
      keywords.forEach(kw => {
        if (sentence.toLowerCase().includes(kw)) score += 1;
      });
      // Length preference (medium length sentences)
      if (sentence.length > 50 && sentence.length < 200) score += 1;
      return { sentence, score };
    });

    // Sort by score and take top N
    const keyPoints = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPoints)
      .map(s => s.sentence);

    // Extract entities (simple NER-like extraction)
    const entityPatterns = [
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g, // Proper nouns
      /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|M|B|K))?\b/gi, // Money
      /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, // Dates
      /\b(?:Inc|LLC|Ltd|Corp|Co)\b\.?/gi, // Company suffixes
    ];
    
    const entities = new Set<string>();
    entityPatterns.forEach(pattern => {
      const matches = cleaned.match(pattern);
      if (matches) matches.forEach(m => entities.add(m.trim()));
    });

    // Extract topics (keyword-based)
    const topics: string[] = [];
    const lowerCleaned = cleaned.toLowerCase();
    for (const [topic, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      const matchCount = keywords.filter(kw => lowerCleaned.includes(kw)).length;
      if (matchCount >= 2) topics.push(topic);
    }

    // Simple sentiment analysis
    const positiveWords = ['success', 'growth', 'opportunity', 'strong', 'excellent', 'great', 'positive', 'profit', 'gain'];
    const negativeWords = ['risk', 'challenge', 'problem', 'issue', 'concern', 'difficult', 'fail', 'loss', 'decline'];
    const posCount = positiveWords.filter(w => lowerCleaned.includes(w)).length;
    const negCount = negativeWords.filter(w => lowerCleaned.includes(w)).length;
    const sentiment = posCount > negCount + 2 ? 'positive' : negCount > posCount + 2 ? 'negative' : 'neutral';

    const compressedText = keyPoints.join(' ');
    const compressedTokens = this.estimateTokens(compressedText);

    return {
      id: this.generateContextHash(context),
      originalTokens,
      compressedTokens,
      keyPoints,
      entities: Array.from(entities).slice(0, 10),
      topics,
      sentiment,
      createdAt: new Date(),
      hash: this.generateContextHash(compressedText),
    };
  }

  /**
   * Calculate comprehensive confidence score from council results
   * Premium-level multi-factor confidence calculation
   */
  calculateConfidence(
    responses: Array<{ id: string; content: string }>,
    critiques: Array<{ responseId: string; score: number; feedback: string; strengths: string[]; weaknesses: string[] }>,
    contextQuality: ContextQuality,
    hasRagContext: boolean,
    hasUserDocuments: boolean,
  ): ConfidenceResult {
    const factors: string[] = [];
    
    // 1. Consensus Score (30% weight) - How well do models agree?
    const scores = critiques.map(c => c.score);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 5;
    const scoreVariance = scores.length > 1 
      ? scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length 
      : 0;
    const scoreStdDev = Math.sqrt(scoreVariance);
    
    // High consensus = low variance, scores clustered together
    // Perfect consensus (stdDev=0) = 100, high variance (stdDev=3) = 0
    const consensusScore = Math.max(0, Math.min(100, 100 - (scoreStdDev * 33)));
    
    if (consensusScore >= 80) factors.push('strong model consensus');
    else if (consensusScore < 50) factors.push('models disagreed significantly');

    // 2. Critique Agreement (20% weight) - Do critiques identify similar issues?
    const allStrengths = critiques.flatMap(c => c.strengths);
    const allWeaknesses = critiques.flatMap(c => c.weaknesses);
    
    // Calculate semantic overlap in identified issues
    const strengthWords = new Set(allStrengths.flatMap(s => s.toLowerCase().split(/\s+/).filter(w => w.length > 3)));
    const weaknessWords = new Set(allWeaknesses.flatMap(w => w.toLowerCase().split(/\s+/).filter(w => w.length > 3)));
    
    // More critiques with similar findings = higher agreement
    const uniqueStrengthRatio = strengthWords.size / Math.max(allStrengths.length * 3, 1);
    const uniqueWeaknessRatio = weaknessWords.size / Math.max(allWeaknesses.length * 3, 1);
    
    // Lower unique ratio = more agreement (critiques saying similar things)
    const critiqueAgreement = Math.max(0, Math.min(100, 
      100 - ((uniqueStrengthRatio + uniqueWeaknessRatio) * 25)
    ));

    // 3. Source Quality (20% weight) - Quality of input context
    let sourceQuality = contextQuality.score;
    
    // Bonuses for having external sources
    if (hasUserDocuments) {
      sourceQuality = Math.min(100, sourceQuality + 15);
      factors.push('user documents analyzed');
      
      // Additional bonus if documents are relevant
      if (contextQuality.documentRelevance && contextQuality.documentRelevance > 70) {
        sourceQuality = Math.min(100, sourceQuality + 10);
        factors.push('highly relevant documents');
      }
    }
    if (hasRagContext) {
      sourceQuality = Math.min(100, sourceQuality + 10);
      factors.push('knowledge base referenced');
    }
    if (!hasUserDocuments && !hasRagContext) {
      sourceQuality = Math.max(0, sourceQuality - 15);
      factors.push('no external sources');
    }

    // 4. Response Quality (15% weight) - Based on response characteristics
    const avgResponseLength = responses.reduce((sum, r) => sum + r.content.length, 0) / Math.max(responses.length, 1);
    
    // Good responses are 200-1500 chars
    let responseQuality = 100;
    if (avgResponseLength < 100) {
      responseQuality = 40;
      factors.push('responses too brief');
    } else if (avgResponseLength < 200) {
      responseQuality = 70;
    } else if (avgResponseLength > 2000) {
      responseQuality = 85; // Slightly penalize very long
    }
    
    // Check for incomplete indicators
    const incompleteIndicators = responses.filter(r => 
      r.content.includes('...') ||
      r.content.toLowerCase().includes('i cannot') ||
      r.content.toLowerCase().includes("i don't have") ||
      r.content.toLowerCase().includes('i am unable')
    ).length;
    
    if (incompleteIndicators > 0) {
      responseQuality = Math.max(0, responseQuality - (incompleteIndicators * 15));
      factors.push('some responses incomplete');
    }

    // 5. Cross-Validation Score (15% weight) - Based on critique scores
    // Higher average critique scores = better cross-validation
    const crossValidation = Math.min(100, avgScore * 10);
    
    if (avgScore >= 8) factors.push('high critique scores');
    else if (avgScore < 5) factors.push('low critique scores');

    // Calculate weighted overall score
    const overall = Math.round(
      (consensusScore * 0.30) +
      (critiqueAgreement * 0.20) +
      (sourceQuality * 0.20) +
      (responseQuality * 0.15) +
      (crossValidation * 0.15)
    );

    // Determine confidence level
    let level: ConfidenceResult['level'];
    if (overall >= 85) level = 'very_high';
    else if (overall >= 70) level = 'high';
    else if (overall >= 55) level = 'medium';
    else if (overall >= 40) level = 'low';
    else level = 'very_low';

    // Add context quality issues to factors
    if (contextQuality.issues.length > 0) {
      const highSeverity = contextQuality.issues.filter(i => i.severity === 'high').length;
      if (highSeverity > 0) factors.push(`${highSeverity} context issues detected`);
    }

    // Generate explanation
    const explanation = factors.length > 0 
      ? `Confidence based on: ${factors.slice(0, 4).join(', ')}`
      : 'Standard confidence assessment';

    return {
      overall,
      breakdown: {
        consensusScore: Math.round(consensusScore),
        critiqueAgreement: Math.round(critiqueAgreement),
        sourceQuality: Math.round(sourceQuality),
        responseQuality: Math.round(responseQuality),
        crossValidation: Math.round(crossValidation),
      },
      level,
      explanation,
      factors,
    };
  }

  /**
   * Validate LLM response for quality and safety
   */
  validateResponse(response: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for empty or too short response
    if (!response || response.trim().length < 20) {
      issues.push('Response is too short or empty');
    }

    // Check for refusal patterns
    const refusalPatterns = [
      /i cannot|i can't|i am unable|i'm unable/i,
      /as an ai|as a language model/i,
      /i don't have access|i don't have the ability/i,
    ];
    for (const pattern of refusalPatterns) {
      if (pattern.test(response)) {
        issues.push('Response contains refusal or limitation statement');
        break;
      }
    }

    // Check for hallucination indicators
    const hallucIndicators = [
      /according to my training data/i,
      /as of my knowledge cutoff/i,
    ];
    for (const pattern of hallucIndicators) {
      if (pattern.test(response)) {
        issues.push('Response may contain uncertain or hallucinated content');
        break;
      }
    }

    // Check for system prompt leakage
    const leakagePatterns = [
      /system prompt|system instruction/i,
      /you are an? (ai|assistant|language model)/i,
      /my instructions|my programming/i,
    ];
    for (const pattern of leakagePatterns) {
      if (pattern.test(response)) {
        issues.push('Response may contain system prompt leakage');
        break;
      }
    }

    // Check for excessive repetition
    const words = response.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();
    words.forEach(w => wordCounts.set(w, (wordCounts.get(w) || 0) + 1));
    const maxRepetition = Math.max(...Array.from(wordCounts.values()));
    if (maxRepetition > words.length * 0.1 && maxRepetition > 5) {
      issues.push('Response contains excessive word repetition');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Merge multiple context summaries for multi-agent scenarios
   */
  mergeContextSummaries(summaries: ContextSummary[]): ContextSummary {
    if (summaries.length === 0) {
      return {
        id: 'empty',
        originalTokens: 0,
        compressedTokens: 0,
        keyPoints: [],
        entities: [],
        topics: [],
        sentiment: 'neutral',
        createdAt: new Date(),
        hash: this.generateContextHash(''),
      };
    }

    if (summaries.length === 1) {
      return summaries[0];
    }

    // Merge key points (deduplicate similar ones)
    const allKeyPoints = summaries.flatMap(s => s.keyPoints);
    const uniqueKeyPoints = this.deduplicateSimilar(allKeyPoints, 0.7);

    // Merge entities
    const allEntities = new Set(summaries.flatMap(s => s.entities));

    // Merge topics
    const allTopics = new Set(summaries.flatMap(s => s.topics));

    // Aggregate sentiment
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    summaries.forEach(s => sentimentCounts[s.sentiment]++);
    const dominantSentiment = Object.entries(sentimentCounts)
      .sort((a, b) => b[1] - a[1])[0][0] as 'positive' | 'neutral' | 'negative';

    const mergedText = uniqueKeyPoints.join(' ');

    return {
      id: this.generateContextHash(summaries.map(s => s.id).join(':')),
      originalTokens: summaries.reduce((sum, s) => sum + s.originalTokens, 0),
      compressedTokens: this.estimateTokens(mergedText),
      keyPoints: uniqueKeyPoints.slice(0, 10),
      entities: Array.from(allEntities).slice(0, 15),
      topics: Array.from(allTopics),
      sentiment: dominantSentiment,
      createdAt: new Date(),
      hash: this.generateContextHash(mergedText),
    };
  }

  /**
   * Deduplicate similar strings using simple similarity
   */
  private deduplicateSimilar(strings: string[], threshold: number): string[] {
    const result: string[] = [];
    
    for (const str of strings) {
      const isDuplicate = result.some(existing => 
        this.calculateSimilarity(str.toLowerCase(), existing.toLowerCase()) > threshold
      );
      if (!isDuplicate) {
        result.push(str);
      }
    }
    
    return result;
  }

  /**
   * Simple Jaccard similarity for strings
   */
  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));
    
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    
    return intersection.size / union.size;
  }
}
