import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Res,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { EmailTrackingService, SendGridEvent } from './email-tracking.service';

@ApiTags('Outreach - Tracking')
@Controller('outreach')
export class EmailTrackingController {
  private readonly logger = new Logger(EmailTrackingController.name);

  constructor(private readonly trackingService: EmailTrackingService) {}

  /**
   * SendGrid webhook endpoint for email events
   * Configure this URL in SendGrid: https://app.sendgrid.com/settings/mail_settings/event_webhook
   */
  @Post('webhooks/sendgrid')
  @HttpCode(200)
  @ApiOperation({ summary: 'SendGrid webhook for email events' })
  async handleSendGridWebhook(
    @Body() events: SendGridEvent[],
    @Headers('x-twilio-email-event-webhook-signature') signature: string,
    @Headers('x-twilio-email-event-webhook-timestamp') timestamp: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ success: boolean; processed: number; errors: number }> {
    // Verify webhook signature if configured
    const rawBody = req.rawBody?.toString() || JSON.stringify(events);
    
    if (signature && timestamp) {
      const isValid = this.trackingService.verifyWebhookSignature(rawBody, signature, timestamp);
      if (!isValid) {
        this.logger.warn('Invalid SendGrid webhook signature');
        return { success: false, processed: 0, errors: 0 };
      }
    }

    this.logger.log(`Received ${events.length} SendGrid events`);
    const result = await this.trackingService.processEvents(events);
    
    return { success: true, ...result };
  }

  /**
   * Tracking pixel endpoint - returns 1x1 transparent GIF
   * Used for open tracking when images are loaded in email
   */
  @Get('track/open/:trackingId')
  @ApiExcludeEndpoint() // Hide from Swagger
  async trackOpen(
    @Param('trackingId') trackingId: string,
    @Res() res: Response,
  ): Promise<void> {
    const pixel = await this.trackingService.handleTrackingPixel(trackingId);
    
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    
    res.send(pixel);
  }

  /**
   * Link click tracking endpoint - records click and redirects
   */
  @Get('track/click/:trackingId')
  @ApiExcludeEndpoint()
  async trackClick(
    @Param('trackingId') trackingId: string,
    @Query('url') url: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!url) {
      res.status(400).send('Missing URL parameter');
      return;
    }

    const decodedUrl = decodeURIComponent(url);
    const redirectUrl = await this.trackingService.handleLinkClick(trackingId, decodedUrl);
    
    res.redirect(302, redirectUrl);
  }

  /**
   * Unsubscribe endpoint - marks lead as unsubscribed
   */
  @Get('unsubscribe/:trackingId')
  @ApiOperation({ summary: 'Unsubscribe from emails' })
  async unsubscribe(
    @Param('trackingId') trackingId: string,
    @Res() res: Response,
  ): Promise<void> {
    const success = await this.trackingService.handleUnsubscribe(trackingId);
    
    // Return a simple HTML page
    const html = success
      ? `<!DOCTYPE html>
<html>
<head>
  <title>Unsubscribed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 40px; border-radius: 8px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 10px; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="card">
    <h1>You've been unsubscribed</h1>
    <p>You will no longer receive emails from this campaign.</p>
  </div>
</body>
</html>`
      : `<!DOCTYPE html>
<html>
<head>
  <title>Error</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .card { background: white; padding: 40px; border-radius: 8px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 10px; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Something went wrong</h1>
    <p>We couldn't process your unsubscribe request. Please try again later.</p>
  </div>
</body>
</html>`;

    res.set('Content-Type', 'text/html');
    res.send(html);
  }
}
