import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

interface ErrorResponse {
  success: false;
  error: string;
  statusCode: number;
  timestamp: string;
  path: string;
  requestId?: string;
  details?: unknown;
}

// Generate unique request ID for tracing
function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    // Generate or use existing request ID for tracing
    const requestId = request.requestId ?? generateRequestId();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        // Handle validation errors (array of messages)
        if (Array.isArray(res.message)) {
          message = 'Validation failed';
          details = res.message;
          // Log validation errors for debugging
          this.logger.warn(`[${requestId}] Validation failed on ${request.method} ${request.url}: ${JSON.stringify(res.message)}`);
        } else {
          message = typeof res.message === 'string' ? res.message : message;
          details = res.errors ?? res.details;
        }
      }
    } else if (exception instanceof Error) {
      // Don't expose internal error messages in production
      const isProduction = process.env.NODE_ENV === 'production';
      message = isProduction ? 'Internal server error' : exception.message;
      
      // Log with request ID for correlation
      this.logger.error(
        `[${requestId}] Unhandled exception on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack
      );
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    };

    if (details) {
      errorResponse.details = details;
    }

    // Set request ID header for client-side correlation
    response.setHeader('X-Request-Id', requestId);
    response.status(status).json(errorResponse);
  }
}
