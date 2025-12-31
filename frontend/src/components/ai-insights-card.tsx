'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Insight } from '@/lib/hooks/use-insights';
import { getInsightColor } from '@/lib/hooks/use-insights';

/**
 * Sparkle icon for AI insights header
 */
const SparkleIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    width="16"
    height="16"
    fill="currentColor"
    viewBox="0 0 256 256"
  >
    <path d="M208,144a15.78,15.78,0,0,1-10.42,14.94l-51.65,19-19,51.61a15.92,15.92,0,0,1-29.88,0L78,178l-51.62-19a15.92,15.92,0,0,1,0-29.88l51.65-19,19-51.61a15.92,15.92,0,0,1,29.88,0l19,51.65,51.61,19A15.78,15.78,0,0,1,208,144ZM152,48h16V64a8,8,0,0,0,16,0V48h16a8,8,0,0,0,0-16H184V16a8,8,0,0,0-16,0V32H152a8,8,0,0,0,0,16Zm88,32h-8V72a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16h8v8a8,8,0,0,0,16,0V96h8a8,8,0,0,0,0-16Z" />
  </svg>
);

/**
 * Loading spinner for insights
 */
const LoadingSpinner = () => (
  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
);

export interface AIInsightsCardProps {
  /** Title displayed in the card header */
  title?: string;
  /** Array of insights to display */
  insights: Insight[];
  /** Whether insights are currently loading */
  isLoading?: boolean;
  /** Placeholder text when no insights are available */
  emptyText?: string;
  /** Additional CSS classes */
  className?: string;
  /** Maximum number of insights to show */
  maxInsights?: number;
}

/**
 * Reusable AI Insights Card component
 *
 * Displays AI-generated insights with consistent styling across all tools.
 *
 * @example
 * ```tsx
 * <AIInsightsCard
 *   title="AI Runway Insights"
 *   insights={insights}
 *   isLoading={isLoadingInsights}
 *   emptyText="Calculate your runway to get insights"
 * />
 * ```
 */
export function AIInsightsCard({
  title = 'AI Insights',
  insights,
  isLoading = false,
  emptyText = 'No insights available',
  className,
  maxInsights = 4,
}: AIInsightsCardProps) {
  const displayInsights = insights.slice(0, maxInsights);

  return (
    <Card
      className={cn(
        'border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5',
        className,
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <SparkleIcon className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-primary">{title}</span>
          {isLoading && <LoadingSpinner />}
        </div>

        {/* Content */}
        {isLoading && displayInsights.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoadingSpinner />
            <span>Generating insights...</span>
          </div>
        ) : displayInsights.length > 0 ? (
          <div className="space-y-2">
            {displayInsights.map((insight, index) => (
              <InsightItem key={index} insight={insight} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Individual insight item
 */
function InsightItem({ insight }: { insight: Insight }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span
        className={cn(
          'shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full',
          getInsightColor(insight.type),
        )}
      />
      <span className="text-muted-foreground">{insight.message}</span>
    </div>
  );
}

/**
 * Inline insights display (for use within other cards)
 */
export function InlineInsights({
  insights,
  isLoading,
  emptyText,
  maxInsights = 4,
}: Omit<AIInsightsCardProps, 'title' | 'className'>) {
  const displayInsights = insights.slice(0, maxInsights);

  if (isLoading && displayInsights.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoadingSpinner />
        <span>Generating insights...</span>
      </div>
    );
  }

  if (displayInsights.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {displayInsights.map((insight, index) => (
        <InsightItem key={index} insight={insight} />
      ))}
    </div>
  );
}
