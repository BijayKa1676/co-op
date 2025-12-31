'use client';

import { useState, useCallback } from 'react';
import { api } from '@/lib/api/client';
import type { AIInsight } from '@/lib/api/types';

/**
 * Insight type for UI display
 */
export type InsightType = 'tip' | 'warning' | 'action' | 'success';

/**
 * Normalized insight for UI
 */
export interface Insight {
  type: InsightType;
  message: string;
}

/**
 * User context for personalized insights
 */
export interface InsightUserContext {
  companyName?: string;
  industry?: string;
  stage?: string;
  country?: string;
}

/**
 * Return type for useInsights hook
 */
export interface UseInsightsReturn {
  insights: Insight[];
  isLoading: boolean;
  error: string | null;
  fetchInsights: (
    toolName: string,
    data: Record<string, unknown>,
    userContext?: InsightUserContext,
  ) => Promise<void>;
  clearInsights: () => void;
}

/**
 * Hook for fetching AI-powered insights from the backend
 *
 * @example
 * ```tsx
 * const { insights, isLoading, fetchInsights } = useInsights();
 *
 * useEffect(() => {
 *   if (data) {
 *     fetchInsights('Runway Calculator', { cashBalance, monthlyBurn });
 *   }
 * }, [data]);
 * ```
 */
export function useInsights(): UseInsightsReturn {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(
    async (
      toolName: string,
      data: Record<string, unknown>,
      userContext?: InsightUserContext,
    ): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.generateInsights(toolName, data, userContext);

        if (response.insights && response.insights.length > 0) {
          setInsights(
            response.insights.map((i: AIInsight) => ({
              type: normalizeInsightType(i.type),
              message: i.message,
            })),
          );
        } else {
          setInsights([]);
        }
      } catch (err) {
        console.error('Failed to fetch insights:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch insights');
        setInsights([]);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const clearInsights = useCallback(() => {
    setInsights([]);
    setError(null);
  }, []);

  return {
    insights,
    isLoading,
    error,
    fetchInsights,
    clearInsights,
  };
}

/**
 * Normalize insight type to valid UI type
 */
function normalizeInsightType(type: string): InsightType {
  const validTypes: InsightType[] = ['tip', 'warning', 'action', 'success'];
  return validTypes.includes(type as InsightType) ? (type as InsightType) : 'tip';
}

/**
 * Get color class for insight type
 */
export function getInsightColor(type: InsightType): string {
  switch (type) {
    case 'warning':
      return 'bg-orange-500';
    case 'action':
      return 'bg-blue-500';
    case 'success':
      return 'bg-emerald-500';
    case 'tip':
    default:
      return 'bg-green-500';
  }
}
