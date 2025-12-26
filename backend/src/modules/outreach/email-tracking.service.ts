import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { campaignEmails, campaigns, leads } from '@/database/schema/outreach.schema';

/**
 * SendGrid webhook event types
 * https://docs.sendgrid.com/for-developers/tracking-events/event
 */
export interface SendGridEvent {
  email: string;
  timestamp: number;
  event: 'processed' | 'dropped' | 'delivered' | 'deferred' | 'bounce' | 'open' | 'click' | 'spamreport' | 'unsubscribe' | 'group_unsubscribe' | 'group_resubscribe';
  sg_event_id: string;
  sg_message_id: string;
  // Custom args we pass when sending
  tracking_id?: string;
  campaign_id?: string;
  // Additional fields for specific events
  url?: string; // For click events
  reason?: string; // For bounce/dropped events
  status?: string;
  type?: string; // bounce type: 'bounce' or 'blocked'
  useragent?: string;
  ip?: string;
}

@Injectable()
export class EmailTrackingService {
  private readonly logger = new Logger(EmailTrackingService.name);
  private readonly webhookSecret: string;
  private readonly appUrl: string;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly config: ConfigService,
  ) {
    this.webhookSecret = this.config.get<string>('SENDGRID_WEBHOOK_SECRET', '');
    this.appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');

    if (!this.webhookSecret) {
      this.logger.warn('SENDGRID_WEBHOOK_SECRET not configured - webhook signature verification disabled');
    }
  }

  /**
   * Verify SendGrid webhook signature
   * https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
   */
  verifyWebhookSignature(payload: string, signature: string, timestamp: string): boolean {
    if (!this.webhookSecret) {
      return true; // Skip verification if not configured
    }

    try {
      const timestampPayload = timestamp + payload;
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(timestampPayload)
        .digest('base64');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      this.logger.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * Process SendGrid webhook events
   */
  async processEvents(events: SendGridEvent[]): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    for (const event of events) {
      try {
        await this.processEvent(event);
        processed++;
      } catch (error) {
        this.logger.error(`Failed to process event ${event.sg_event_id}:`, error);
        errors++;
      }
    }

    this.logger.log(`Processed ${processed} events, ${errors} errors`);
    return { processed, errors };
  }

  /**
   * Process a single SendGrid event
   */
  private async processEvent(event: SendGridEvent): Promise<void> {
    const trackingId = event.tracking_id;
    if (!trackingId) {
      this.logger.debug(`Event ${event.event} has no tracking_id, skipping`);
      return;
    }

    // Find the campaign email by tracking ID
    const [email] = await this.db
      .select()
      .from(campaignEmails)
      .where(eq(campaignEmails.trackingId, trackingId));

    if (!email) {
      this.logger.warn(`No email found for tracking_id: ${trackingId}`);
      return;
    }

    const eventTime = new Date(event.timestamp * 1000);

    switch (event.event) {
      case 'delivered':
        await this.handleDelivered(email.id, email.campaignId, eventTime);
        break;

      case 'open':
        await this.handleOpened(email.id, email.campaignId, eventTime);
        break;

      case 'click':
        await this.handleClicked(email.id, email.campaignId, eventTime, event.url);
        break;

      case 'bounce':
        await this.handleBounced(email.id, email.campaignId, email.leadId, eventTime, event.reason);
        break;

      case 'spamreport':
      case 'unsubscribe':
        await this.handleUnsubscribed(email.id, email.campaignId, email.leadId, eventTime);
        break;

      case 'dropped':
        await this.handleDropped(email.id, eventTime, event.reason);
        break;

      default:
        this.logger.debug(`Unhandled event type: ${event.event}`);
    }
  }

  private async handleDelivered(emailId: string, campaignId: string, eventTime: Date): Promise<void> {
    await this.db
      .update(campaignEmails)
      .set({ status: 'delivered', deliveredAt: eventTime })
      .where(eq(campaignEmails.id, emailId));

    await this.incrementCampaignStat(campaignId, 'delivered');
  }

  private async handleOpened(emailId: string, campaignId: string, eventTime: Date): Promise<void> {
    // Only update if not already opened (first open)
    const [email] = await this.db
      .select()
      .from(campaignEmails)
      .where(eq(campaignEmails.id, emailId));

    if (email && !email.openedAt) {
      await this.db
        .update(campaignEmails)
        .set({ status: 'opened', openedAt: eventTime })
        .where(eq(campaignEmails.id, emailId));

      await this.incrementCampaignStat(campaignId, 'opened');
    }
  }

  private async handleClicked(emailId: string, campaignId: string, eventTime: Date, url?: string): Promise<void> {
    // Only update if not already clicked (first click)
    const [email] = await this.db
      .select()
      .from(campaignEmails)
      .where(eq(campaignEmails.id, emailId));

    if (email && !email.clickedAt) {
      await this.db
        .update(campaignEmails)
        .set({ status: 'clicked', clickedAt: eventTime })
        .where(eq(campaignEmails.id, emailId));

      await this.incrementCampaignStat(campaignId, 'clicked');
    }

    this.logger.debug(`Click tracked for email ${emailId}, URL: ${url}`);
  }

  private async handleBounced(
    emailId: string,
    campaignId: string,
    leadId: string,
    eventTime: Date,
    reason?: string,
  ): Promise<void> {
    await this.db
      .update(campaignEmails)
      .set({ 
        status: 'bounced', 
        bouncedAt: eventTime,
        errorMessage: reason || 'Email bounced',
      })
      .where(eq(campaignEmails.id, emailId));

    await this.incrementCampaignStat(campaignId, 'bounced');

    // Update lead status
    await this.db
      .update(leads)
      .set({ status: 'unsubscribed', updatedAt: new Date() })
      .where(eq(leads.id, leadId));
  }

  private async handleUnsubscribed(
    emailId: string,
    campaignId: string,
    leadId: string,
    eventTime: Date,
  ): Promise<void> {
    await this.db
      .update(campaignEmails)
      .set({ status: 'bounced', bouncedAt: eventTime, errorMessage: 'Unsubscribed' })
      .where(eq(campaignEmails.id, emailId));

    // Update lead status to unsubscribed
    await this.db
      .update(leads)
      .set({ status: 'unsubscribed', updatedAt: new Date() })
      .where(eq(leads.id, leadId));

    this.logger.log(`Lead ${leadId} unsubscribed`);
  }

  private async handleDropped(emailId: string, eventTime: Date, reason?: string): Promise<void> {
    await this.db
      .update(campaignEmails)
      .set({ 
        status: 'failed', 
        errorMessage: reason || 'Email dropped',
      })
      .where(eq(campaignEmails.id, emailId));
  }

  /**
   * Increment a campaign stat counter
   */
  private async incrementCampaignStat(
    campaignId: string,
    stat: 'delivered' | 'opened' | 'clicked' | 'bounced',
  ): Promise<void> {
    const [campaign] = await this.db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));

    if (!campaign) return;

    const currentStats = campaign.stats ?? {};
    const newStats = {
      ...currentStats,
      [stat]: (currentStats[stat] ?? 0) + 1,
    };

    await this.db
      .update(campaigns)
      .set({ stats: newStats, updatedAt: new Date() })
      .where(eq(campaigns.id, campaignId));
  }

  /**
   * Generate tracking pixel URL
   */
  generateTrackingPixelUrl(trackingId: string): string {
    return `${this.appUrl}/api/v1/outreach/track/open/${trackingId}`;
  }

  /**
   * Generate tracked link URL
   */
  generateTrackedLinkUrl(trackingId: string, originalUrl: string): string {
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${this.appUrl}/api/v1/outreach/track/click/${trackingId}?url=${encodedUrl}`;
  }

  /**
   * Handle tracking pixel request (1x1 transparent GIF)
   */
  async handleTrackingPixel(trackingId: string): Promise<Buffer> {
    // Record the open
    const [email] = await this.db
      .select()
      .from(campaignEmails)
      .where(eq(campaignEmails.trackingId, trackingId));

    if (email && !email.openedAt) {
      await this.db
        .update(campaignEmails)
        .set({ status: 'opened', openedAt: new Date() })
        .where(eq(campaignEmails.id, email.id));

      await this.incrementCampaignStat(email.campaignId, 'opened');
      this.logger.debug(`Open tracked via pixel for ${trackingId}`);
    }

    // Return 1x1 transparent GIF
    return Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
  }

  /**
   * Handle link click tracking
   */
  async handleLinkClick(trackingId: string, originalUrl: string): Promise<string> {
    const [email] = await this.db
      .select()
      .from(campaignEmails)
      .where(eq(campaignEmails.trackingId, trackingId));

    if (email && !email.clickedAt) {
      await this.db
        .update(campaignEmails)
        .set({ status: 'clicked', clickedAt: new Date() })
        .where(eq(campaignEmails.id, email.id));

      await this.incrementCampaignStat(email.campaignId, 'clicked');
      this.logger.debug(`Click tracked for ${trackingId}, redirecting to ${originalUrl}`);
    }

    return originalUrl;
  }

  /**
   * Handle unsubscribe request
   */
  async handleUnsubscribe(trackingId: string): Promise<boolean> {
    const [email] = await this.db
      .select()
      .from(campaignEmails)
      .where(eq(campaignEmails.trackingId, trackingId));

    if (!email) {
      return false;
    }

    // Update lead status
    await this.db
      .update(leads)
      .set({ status: 'unsubscribed', updatedAt: new Date() })
      .where(eq(leads.id, email.leadId));

    this.logger.log(`Unsubscribe processed for tracking ${trackingId}`);
    return true;
  }
}
