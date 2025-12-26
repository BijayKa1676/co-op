import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { campaigns, campaignEmails, leads, Campaign, CampaignEmail, Lead } from '@/database/schema/outreach.schema';
import { startups } from '@/database/schema/startups.schema';
import { LlmCouncilService } from '@/common/llm/llm-council.service';
import { EmailService } from '@/common/email/email.service';
import { LeadsService } from './leads.service';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  GenerateEmailsDto,
  GenerateTemplateDto,
  CampaignResponseDto,
  CampaignEmailResponseDto,
  CampaignStatsDto,
  GeneratedTemplateDto,
} from './dto/campaign.dto';

// Pilot limits
const PILOT_CAMPAIGN_LIMIT = 5;
const PILOT_EMAILS_PER_DAY = 50;

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly llmCouncil: LlmCouncilService,
    private readonly emailService: EmailService,
    private readonly leadsService: LeadsService,
  ) {}

  /**
   * Generate email template using AI
   */
  async generateTemplate(
    userId: string,
    startupId: string,
    dto: GenerateTemplateDto,
  ): Promise<GeneratedTemplateDto> {
    // Get startup info for context
    const [startup] = await this.db
      .select()
      .from(startups)
      .where(eq(startups.id, startupId));

    if (!startup) {
      throw new NotFoundException('Startup not found');
    }

    const prompt = `Generate a cold email template for customer outreach.

STARTUP INFO:
- Company: ${startup.companyName}
- Industry: ${startup.industry}
- Description: ${startup.description}
- Value Proposition: ${startup.problemSolved || 'Not specified'}

PITCH/GOAL: ${dto.pitch}
TONE: ${dto.tone || 'professional'}

Generate a personalized cold email template with these requirements:
1. Subject line: Compelling, personalized, under 60 chars. Use {{companyName}} variable.
2. Body: 
   - Opening: Reference something about their company (use {{companyName}})
   - Value prop: Clear benefit for THEM
   - Social proof if applicable
   - Soft CTA (15-min call, quick feedback)
   - Professional signature
3. Length: Under 150 words
4. NO spam triggers (free, guarantee, act now, limited time)
5. Use variables: {{companyName}}, {{contactName}}, {{contactTitle}}

Return ONLY JSON with this format:
{
  "subjectTemplate": "Subject line here with {{companyName}}",
  "bodyTemplate": "Email body here with {{variables}}"
}`;

    try {
      const result = await this.llmCouncil.runCouncil(
        'You are an expert cold email copywriter. Return only valid JSON.',
        prompt,
        { minModels: 2, maxModels: 3, maxTokens: 1000, temperature: 0.7 },
      );

      const jsonMatch = /\{[\s\S]*\}/.exec(result.finalResponse);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      return JSON.parse(jsonMatch[0]) as GeneratedTemplateDto;
    } catch (error) {
      this.logger.error('Failed to generate template:', error);
      throw new BadRequestException('Failed to generate email template');
    }
  }

  /**
   * Create a new campaign
   */
  async create(
    userId: string,
    startupId: string,
    dto: CreateCampaignDto,
  ): Promise<CampaignResponseDto> {
    // Check limit
    const existingCampaigns = await this.db
      .select()
      .from(campaigns)
      .where(eq(campaigns.userId, userId));

    if (existingCampaigns.length >= PILOT_CAMPAIGN_LIMIT) {
      throw new BadRequestException(
        `Pilot users are limited to ${PILOT_CAMPAIGN_LIMIT} campaigns.`
      );
    }

    const [campaign] = await this.db
      .insert(campaigns)
      .values({
        userId,
        startupId,
        name: dto.name,
        subjectTemplate: dto.subjectTemplate,
        bodyTemplate: dto.bodyTemplate,
        settings: {
          trackOpens: dto.trackOpens ?? true,
          trackClicks: dto.trackClicks ?? true,
          dailyLimit: dto.dailyLimit ?? PILOT_EMAILS_PER_DAY,
        },
        stats: { totalEmails: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
      })
      .returning();

    return this.toResponseDto(campaign);
  }

  /**
   * Get all campaigns for a user
   */
  async findAll(userId: string): Promise<CampaignResponseDto[]> {
    const userCampaigns = await this.db
      .select()
      .from(campaigns)
      .where(eq(campaigns.userId, userId))
      .orderBy(desc(campaigns.createdAt));

    return userCampaigns.map((campaign) => this.toResponseDto(campaign));
  }

  /**
   * Get a single campaign
   */
  async findOne(userId: string, campaignId: string): Promise<CampaignResponseDto> {
    const [campaign] = await this.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return this.toResponseDto(campaign);
  }

  /**
   * Update a campaign
   */
  async update(
    userId: string,
    campaignId: string,
    dto: UpdateCampaignDto,
  ): Promise<CampaignResponseDto> {
    const [existing] = await this.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));

    if (!existing) {
      throw new NotFoundException('Campaign not found');
    }

    if (existing.status !== 'draft' && dto.subjectTemplate) {
      throw new BadRequestException('Cannot modify template of active campaign');
    }

    const updateData: Partial<Campaign> = { updatedAt: new Date() };
    if (dto.name) updateData.name = dto.name;
    if (dto.subjectTemplate) updateData.subjectTemplate = dto.subjectTemplate;
    if (dto.bodyTemplate) updateData.bodyTemplate = dto.bodyTemplate;
    if (dto.status) updateData.status = dto.status;

    if (dto.trackOpens !== undefined || dto.trackClicks !== undefined) {
      updateData.settings = {
        ...existing.settings,
        ...(dto.trackOpens !== undefined && { trackOpens: dto.trackOpens }),
        ...(dto.trackClicks !== undefined && { trackClicks: dto.trackClicks }),
      };
    }

    const [updated] = await this.db
      .update(campaigns)
      .set(updateData)
      .where(eq(campaigns.id, campaignId))
      .returning();

    return this.toResponseDto(updated);
  }

  /**
   * Delete a campaign
   */
  async delete(userId: string, campaignId: string): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));

    if (!existing) {
      throw new NotFoundException('Campaign not found');
    }

    // Cascade delete handles campaign_emails
    await this.db.delete(campaigns).where(eq(campaigns.id, campaignId));
  }

  /**
   * Generate personalized emails for leads
   */
  async generateEmails(
    userId: string,
    campaignId: string,
    dto: GenerateEmailsDto,
  ): Promise<CampaignEmailResponseDto[]> {
    const [campaign] = await this.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Get leads
    const leadsList = await this.leadsService.getLeadsByIds(userId, dto.leadIds);
    if (leadsList.length === 0) {
      throw new BadRequestException('No valid leads found');
    }

    const generatedEmails: CampaignEmailResponseDto[] = [];

    for (const lead of leadsList) {
      // Check if email already exists for this lead in this campaign
      const [existing] = await this.db
        .select()
        .from(campaignEmails)
        .where(and(
          eq(campaignEmails.campaignId, campaignId),
          eq(campaignEmails.leadId, lead.id),
        ));

      if (existing) {
        generatedEmails.push(this.toEmailResponseDto(existing));
        continue;
      }

      // Personalize template
      const subject = this.personalizeTemplate(campaign.subjectTemplate, lead);
      const body = this.personalizeTemplate(campaign.bodyTemplate, lead);

      const [email] = await this.db
        .insert(campaignEmails)
        .values({
          campaignId,
          leadId: lead.id,
          subject,
          body,
          trackingId: randomUUID(),
        })
        .returning();

      generatedEmails.push(this.toEmailResponseDto(email));
    }

    // Update campaign stats
    const totalEmails = await this.db
      .select()
      .from(campaignEmails)
      .where(eq(campaignEmails.campaignId, campaignId));

    await this.db
      .update(campaigns)
      .set({
        stats: { ...campaign.stats, totalEmails: totalEmails.length },
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    return generatedEmails;
  }

  /**
   * Get emails for a campaign
   */
  async getEmails(userId: string, campaignId: string): Promise<CampaignEmailResponseDto[]> {
    // Verify ownership
    const [campaign] = await this.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const emails = await this.db
      .select()
      .from(campaignEmails)
      .where(eq(campaignEmails.campaignId, campaignId))
      .orderBy(desc(campaignEmails.createdAt));

    return emails.map((email) => this.toEmailResponseDto(email));
  }

  /**
   * Send campaign emails
   */
  async sendCampaign(userId: string, campaignId: string): Promise<{ sent: number; failed: number }> {
    const [campaign] = await this.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Get pending emails
    const pendingEmails = await this.db
      .select()
      .from(campaignEmails)
      .where(and(
        eq(campaignEmails.campaignId, campaignId),
        eq(campaignEmails.status, 'pending'),
      ));

    if (pendingEmails.length === 0) {
      throw new BadRequestException('No pending emails to send');
    }

    // Check daily limit
    const dailyLimit = campaign.settings?.dailyLimit ?? PILOT_EMAILS_PER_DAY;
    const toSend = pendingEmails.slice(0, dailyLimit);

    let sent = 0;
    let failed = 0;

    // Update campaign status
    await this.db
      .update(campaigns)
      .set({ status: 'sending', updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));

    for (const email of toSend) {
      // Get lead for email address
      const lead = await this.leadsService.getLeadById(email.leadId);
      if (!lead) {
        await this.db
          .update(campaignEmails)
          .set({ status: 'failed', errorMessage: 'Lead not found' })
          .where(eq(campaignEmails.id, email.id));
        failed++;
        continue;
      }
      
      if (!lead.contactEmail) {
        await this.db
          .update(campaignEmails)
          .set({ status: 'failed', errorMessage: 'No contact email for lead' })
          .where(eq(campaignEmails.id, email.id));
        failed++;
        continue;
      }

      try {
        const success = await this.emailService.send({
          to: lead.contactEmail,
          subject: email.subject,
          html: this.formatEmailHtml(email.body, email.trackingId!),
          text: email.body,
        });

        if (success) {
          await this.db
            .update(campaignEmails)
            .set({ status: 'sent', sentAt: new Date() })
            .where(eq(campaignEmails.id, email.id));
          sent++;

          // Update lead status
          await this.db
            .update(leads)
            .set({ status: 'contacted', updatedAt: new Date() })
            .where(eq(leads.id, lead.id));
        } else {
          await this.db
            .update(campaignEmails)
            .set({ status: 'failed', errorMessage: 'Send failed' })
            .where(eq(campaignEmails.id, email.id));
          failed++;
        }
      } catch (error) {
        this.logger.error(`Failed to send email ${email.id}:`, error);
        await this.db
          .update(campaignEmails)
          .set({ 
            status: 'failed', 
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .where(eq(campaignEmails.id, email.id));
        failed++;
      }
    }

    // Update campaign stats
    const currentStats = campaign.stats ?? {};
    await this.db
      .update(campaigns)
      .set({
        status: sent > 0 ? 'sending' : 'draft',
        stats: {
          ...currentStats,
          sent: (currentStats.sent ?? 0) + sent,
        },
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));

    return { sent, failed };
  }

  /**
   * Get campaign statistics
   */
  async getStats(userId: string, campaignId: string): Promise<CampaignStatsDto> {
    const [campaign] = await this.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const stats = campaign.stats ?? {};
    const sent = stats.sent ?? 0;
    const opened = stats.opened ?? 0;
    const clicked = stats.clicked ?? 0;
    const bounced = stats.bounced ?? 0;

    return {
      totalEmails: stats.totalEmails ?? 0,
      sent,
      delivered: stats.delivered ?? sent - bounced,
      opened,
      clicked,
      bounced,
      openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
      clickRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
      bounceRate: sent > 0 ? Math.round((bounced / sent) * 100) : 0,
    };
  }

  // Private helpers

  private personalizeTemplate(template: string, lead: Lead): string {
    return template
      .replace(/\{\{companyName\}\}/g, lead.companyName || 'your company')
      .replace(/\{\{contactName\}\}/g, lead.contactName || 'there')
      .replace(/\{\{contactTitle\}\}/g, lead.contactTitle || '')
      .replace(/\{\{industry\}\}/g, lead.industry || '')
      .replace(/\{\{location\}\}/g, lead.location || '');
  }

  private formatEmailHtml(body: string, trackingId: string): string {
    // Convert newlines to <br> and wrap in basic HTML
    const htmlBody = body.replace(/\n/g, '<br>');
    
    // Generate tracking URLs
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const trackingPixelUrl = `${appUrl}/api/v1/outreach/track/open/${trackingId}`;
    const unsubscribeUrl = `${appUrl}/api/v1/outreach/unsubscribe/${trackingId}`;
    
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
${htmlBody}
<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
<p>If you'd prefer not to receive these emails, <a href="${unsubscribeUrl}">unsubscribe here</a>.</p>
</div>
<!-- Tracking pixel -->
<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />
</body>
</html>`;
  }

  private toResponseDto(campaign: Campaign): CampaignResponseDto {
    return {
      id: campaign.id,
      name: campaign.name,
      subjectTemplate: campaign.subjectTemplate,
      bodyTemplate: campaign.bodyTemplate,
      status: campaign.status ?? 'draft',
      settings: campaign.settings ?? {},
      stats: campaign.stats ?? {},
      createdAt: campaign.createdAt.toISOString(),
      updatedAt: campaign.updatedAt.toISOString(),
    };
  }

  private toEmailResponseDto(email: CampaignEmail): CampaignEmailResponseDto {
    return {
      id: email.id,
      leadId: email.leadId,
      subject: email.subject,
      body: email.body,
      status: email.status ?? 'pending',
      sentAt: email.sentAt?.toISOString() ?? null,
      openedAt: email.openedAt?.toISOString() ?? null,
      clickedAt: email.clickedAt?.toISOString() ?? null,
      createdAt: email.createdAt.toISOString(),
    };
  }
}
