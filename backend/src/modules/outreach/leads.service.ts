import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc, ilike, or, gte } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { leads, Lead } from '@/database/schema/outreach.schema';
import { ResearchService } from '@/common/research/research.service';
import { LlmCouncilService } from '@/common/llm/llm-council.service';
import { CacheService } from '@/common/cache/cache.service';
import {
  DiscoverLeadsDto,
  CreateLeadDto,
  UpdateLeadDto,
  LeadResponseDto,
  LeadFiltersDto,
} from './dto/lead.dto';

// Pilot limits
const PILOT_LEAD_LIMIT = 50;
const DISCOVERY_RATE_LIMIT_KEY = 'outreach:discovery:';
const DISCOVERY_RATE_LIMIT_TTL = 3600; // 1 hour
const DISCOVERY_RATE_LIMIT_MAX = 5; // 5 discoveries per hour

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly researchService: ResearchService,
    private readonly llmCouncil: LlmCouncilService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Discover potential leads using web research
   */
  async discoverLeads(
    userId: string,
    startupId: string,
    dto: DiscoverLeadsDto,
  ): Promise<LeadResponseDto[]> {
    // Check rate limit
    const rateLimitKey = `${DISCOVERY_RATE_LIMIT_KEY}${userId}`;
    const currentCount = await this.cache.get<number>(rateLimitKey) || 0;
    
    if (currentCount >= DISCOVERY_RATE_LIMIT_MAX) {
      throw new BadRequestException(
        `Discovery rate limit reached. You can discover leads ${DISCOVERY_RATE_LIMIT_MAX} times per hour.`
      );
    }

    // Check total lead limit
    const existingLeads = await this.db
      .select()
      .from(leads)
      .where(eq(leads.userId, userId));

    if (existingLeads.length >= PILOT_LEAD_LIMIT) {
      throw new BadRequestException(
        `Pilot users are limited to ${PILOT_LEAD_LIMIT} leads. Delete some leads to discover more.`
      );
    }

    const maxLeads = Math.min(dto.maxLeads || 10, PILOT_LEAD_LIMIT - existingLeads.length);

    // Build search query
    const searchQuery = this.buildSearchQuery(dto);
    this.logger.log(`Discovering leads with query: ${searchQuery}`);

    // Use research service to find potential customers
    const webResults = await this.researchService.searchWeb(searchQuery);

    if (webResults.length === 0) {
      this.logger.warn('No web results found for lead discovery');
      return [];
    }

    // Use LLM to extract and score leads from search results
    const extractedLeads = await this.extractLeadsFromResults(
      webResults,
      dto,
      maxLeads,
    );

    // Save leads to database
    const savedLeads: LeadResponseDto[] = [];
    for (const lead of extractedLeads) {
      try {
        const [saved] = await this.db
          .insert(leads)
          .values({
            userId,
            startupId,
            companyName: lead.companyName || 'Unknown Company',
            website: lead.website || null,
            industry: lead.industry || dto.targetIndustry || null,
            companySize: lead.companySize || null,
            location: lead.location || null,
            description: lead.description || null,
            contactName: lead.contactName || null,
            contactEmail: lead.contactEmail || null,
            contactTitle: lead.contactTitle || null,
            linkedinUrl: lead.linkedinUrl || null,
            leadScore: lead.leadScore || 0,
            source: 'discovery',
          })
          .returning();

        savedLeads.push(this.toResponseDto(saved));
      } catch (error) {
        this.logger.warn(`Failed to save lead ${lead.companyName}:`, error);
      }
    }

    // Update rate limit
    await this.cache.set(rateLimitKey, currentCount + 1, { ttl: DISCOVERY_RATE_LIMIT_TTL });

    this.logger.log(`Discovered and saved ${savedLeads.length} leads`);
    return savedLeads;
  }

  /**
   * Create a lead manually
   */
  async create(
    userId: string,
    startupId: string,
    dto: CreateLeadDto,
  ): Promise<LeadResponseDto> {
    // Check limit
    const existingLeads = await this.db
      .select()
      .from(leads)
      .where(eq(leads.userId, userId));

    if (existingLeads.length >= PILOT_LEAD_LIMIT) {
      throw new BadRequestException(
        `Pilot users are limited to ${PILOT_LEAD_LIMIT} leads.`
      );
    }

    const [lead] = await this.db
      .insert(leads)
      .values({
        userId,
        startupId,
        ...dto,
        source: dto.source || 'manual',
      })
      .returning();

    return this.toResponseDto(lead);
  }

  /**
   * Get all leads for a user with optional filters
   */
  async findAll(userId: string, filters?: LeadFiltersDto): Promise<LeadResponseDto[]> {
    const conditions = [eq(leads.userId, userId)];

    if (filters?.status) {
      conditions.push(eq(leads.status, filters.status));
    }

    if (filters?.industry) {
      conditions.push(eq(leads.industry, filters.industry));
    }

    if (filters?.minScore !== undefined) {
      conditions.push(gte(leads.leadScore, filters.minScore));
    }

    if (filters?.search) {
      conditions.push(
        or(
          ilike(leads.companyName, `%${filters.search}%`),
          ilike(leads.contactName, `%${filters.search}%`),
          ilike(leads.contactEmail, `%${filters.search}%`),
        )!
      );
    }

    const userLeads = await this.db
      .select()
      .from(leads)
      .where(and(...conditions))
      .orderBy(desc(leads.leadScore), desc(leads.createdAt));

    return userLeads.map((lead) => this.toResponseDto(lead));
  }

  /**
   * Get a single lead
   */
  async findOne(userId: string, leadId: string): Promise<LeadResponseDto> {
    const [lead] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.userId, userId)));

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return this.toResponseDto(lead);
  }

  /**
   * Update a lead
   */
  async update(
    userId: string,
    leadId: string,
    dto: UpdateLeadDto,
  ): Promise<LeadResponseDto> {
    const [existing] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.userId, userId)));

    if (!existing) {
      throw new NotFoundException('Lead not found');
    }

    const [updated] = await this.db
      .update(leads)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(leads.id, leadId))
      .returning();

    return this.toResponseDto(updated);
  }

  /**
   * Delete a lead
   */
  async delete(userId: string, leadId: string): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.userId, userId)));

    if (!existing) {
      throw new NotFoundException('Lead not found');
    }

    await this.db.delete(leads).where(eq(leads.id, leadId));
  }

  /**
   * Get lead by ID (internal use)
   */
  async getLeadById(leadId: string): Promise<Lead | null> {
    const [lead] = await this.db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId));
    return lead || null;
  }

  /**
   * Get multiple leads by IDs
   */
  async getLeadsByIds(userId: string, leadIds: string[]): Promise<Lead[]> {
    if (leadIds.length === 0) return [];

    const userLeads = await this.db
      .select()
      .from(leads)
      .where(eq(leads.userId, userId));

    return userLeads.filter(l => leadIds.includes(l.id));
  }

  // Private helpers

  private buildSearchQuery(dto: DiscoverLeadsDto): string {
    const parts: string[] = [];

    // Core idea
    parts.push(dto.startupIdea);

    // Add industry context
    if (dto.targetIndustry) {
      parts.push(`${dto.targetIndustry} companies`);
    }

    // Add location context
    if (dto.targetLocations?.length) {
      parts.push(`in ${dto.targetLocations.join(' or ')}`);
    }

    // Add ICP context
    if (dto.idealCustomerProfile) {
      parts.push(dto.idealCustomerProfile);
    }

    // Add business context
    parts.push('potential customers business contact');

    return parts.join(' ');
  }

  private async extractLeadsFromResults(
    webResults: { title: string; url: string; snippet: string }[],
    dto: DiscoverLeadsDto,
    maxLeads: number,
  ): Promise<Partial<Lead & { leadScore: number }>[]> {
    const prompt = `You are a lead generation expert. Analyze these web search results and extract potential customer leads for a startup.

STARTUP IDEA: ${dto.startupIdea}
TARGET INDUSTRY: ${dto.targetIndustry || 'Any'}
TARGET COMPANY SIZES: ${dto.targetCompanySizes?.join(', ') || 'Any'}
TARGET LOCATIONS: ${dto.targetLocations?.join(', ') || 'Any'}
IDEAL CUSTOMER: ${dto.idealCustomerProfile || 'Not specified'}

WEB RESULTS:
${webResults.map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}`).join('\n\n')}

Extract up to ${maxLeads} potential customer leads. For each lead, provide:
- companyName: Company name
- website: Company website URL
- industry: Industry/sector
- companySize: Estimated size (1-10, 11-50, 51-200, 201-500, 500+)
- location: Location/region
- description: Brief description of what they do
- contactTitle: Likely decision maker title (e.g., "CEO", "CTO", "Head of Product")
- leadScore: Score 0-100 based on fit with the startup's ideal customer

Return ONLY a JSON array of leads. No explanation.
Example: [{"companyName": "Acme Corp", "website": "https://acme.com", "industry": "SaaS", "companySize": "51-200", "location": "San Francisco, CA", "description": "B2B software company", "contactTitle": "CTO", "leadScore": 85}]`;

    try {
      const result = await this.llmCouncil.runCouncil(
        'You are a lead extraction assistant. Return only valid JSON.',
        prompt,
        { minModels: 1, maxModels: 2, maxTokens: 2000, temperature: 0.3 },
      );

      // Parse JSON from response
      const jsonMatch = /\[[\s\S]*\]/.exec(result.finalResponse);
      if (!jsonMatch) {
        this.logger.warn('No JSON array found in LLM response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]) as Partial<Lead & { leadScore: number }>[];
      return parsed.slice(0, maxLeads);
    } catch (error) {
      this.logger.error('Failed to extract leads from results:', error);
      return [];
    }
  }

  private toResponseDto(lead: Lead): LeadResponseDto {
    return {
      id: lead.id,
      companyName: lead.companyName,
      website: lead.website,
      industry: lead.industry,
      companySize: lead.companySize,
      location: lead.location,
      description: lead.description,
      contactName: lead.contactName,
      contactEmail: lead.contactEmail,
      contactTitle: lead.contactTitle,
      linkedinUrl: lead.linkedinUrl,
      leadScore: lead.leadScore ?? 0,
      status: lead.status ?? 'new',
      source: lead.source,
      createdAt: lead.createdAt.toISOString(),
    };
  }
}
