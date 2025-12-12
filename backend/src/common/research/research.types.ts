// Web Research Types - Google Gemini with Search Grounding

import { GroundingChunk } from '@google/generative-ai';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedDate: string;
}

export interface CompanyInfo {
  name: string;
  description: string;
  website: string;
  industry: string;
  fundingStage: string;
  totalFunding: string;
  employees: string;
  founded: string;
  headquarters: string;
  competitors: string[];
  investors: string[];
}

export interface InvestorInfo {
  name: string;
  type: string;
  website: string;
  portfolio: string[];
  investmentStages: string[];
  sectors: string[];
  checkSize: string;
  location: string;
  recentInvestments: InvestmentRecord[];
}

export interface InvestmentRecord {
  company: string;
  amount: string;
  date: string;
  round: string;
}

export interface MarketData {
  marketSize: string;
  growthRate: string;
  trends: string[];
  keyPlayers: string[];
  opportunities: string[];
  threats: string[];
}

export interface ResearchContext {
  webResults: WebSearchResult[];
  companyInfo: CompanyInfo | null;
  investorInfo: InvestorInfo[];
  marketData: MarketData | null;
  sources: string[];
}

export interface ResearchQuery {
  query: string;
  context: string;
  type: 'competitor' | 'company' | 'market' | 'investor' | 'funding' | 'web' | 'news';
}

export interface GroundedResponse {
  content: string;
  sources: string[];
  groundingChunks: GroundingChunk[];
}
