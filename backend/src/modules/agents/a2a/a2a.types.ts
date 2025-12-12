/**
 * Agent-to-Agent (A2A) Communication Types
 *
 * Enables agents to communicate and delegate tasks to each other
 */

export type A2AMessageType = 'request' | 'response' | 'delegate' | 'notify';

export interface A2AMessage {
  id: string;
  type: A2AMessageType;
  fromAgent: string;
  toAgent: string;
  payload: A2APayload;
  timestamp: Date;
  correlationId: string;
}

export interface A2APayload {
  action: string;
  data: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high';
}

export interface A2ARequest {
  targetAgent: string;
  action: string;
  data: Record<string, unknown>;
  timeout?: number;
}

export interface A2AResponse {
  success: boolean;
  data: Record<string, unknown>;
  error: string | null;
  executionTimeMs: number;
}

export interface A2ACapability {
  agent: string;
  actions: string[];
  description: string;
}

export const A2A_CAPABILITIES: A2ACapability[] = [
  {
    agent: 'legal',
    actions: ['analyze_contract', 'check_compliance', 'review_terms'],
    description: 'Legal analysis and compliance checking',
  },
  {
    agent: 'finance',
    actions: ['calculate_runway', 'analyze_metrics', 'valuation_estimate'],
    description: 'Financial analysis and modeling',
  },
  {
    agent: 'investor',
    actions: ['find_investors', 'match_profile', 'research_vc'],
    description: 'Investor research and matching',
  },
  {
    agent: 'competitor',
    actions: ['analyze_market', 'compare_features', 'research_competitor'],
    description: 'Competitive intelligence',
  },
];
