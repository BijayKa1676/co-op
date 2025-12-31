/**
 * Insight types for categorizing AI-generated insights
 */
export type InsightType = 'tip' | 'warning' | 'action' | 'success';

/**
 * Context provided to the insights service for generating insights
 */
export interface InsightContext {
  /** Name of the tool requesting insights */
  toolName: string;
  /** Tool-specific data to analyze */
  data: Record<string, unknown>;
  /** Optional user/company context for personalization */
  userContext?: {
    companyName?: string;
    industry?: string;
    stage?: string;
    country?: string;
  };
}

/**
 * Individual insight item
 */
export interface InsightItem {
  type: InsightType;
  message: string;
}

/**
 * Result returned by the insights service
 */
export interface InsightResult {
  insights: InsightItem[];
  generatedAt: string;
}

/**
 * Valid insight types for validation
 */
export const VALID_INSIGHT_TYPES: InsightType[] = ['tip', 'warning', 'action', 'success'];

/**
 * Maximum number of insights to return
 */
export const MAX_INSIGHTS = 4;

/**
 * Maximum message length for insights
 */
export const MAX_MESSAGE_LENGTH = 150;
