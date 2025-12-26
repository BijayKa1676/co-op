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

// Patterns that might indicate sensitive information in error messages
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /authorization/i,
  /credential/i,
  /private/i,
  /bearer/i,
];

/**
 * Sanitize error message to remove potentially sensitive information
 */
function sanitizeErrorMessage(message: string): string {
  // Check if message contains sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(message)) {
      return 'Validation error - check request parameters';
    }
  }
  return message;
}

/**
 * Sanitize validation error details to remove sensitive field values
 */
function sanitizeValidationDetails(details: unknown): unknown {
  if (!Array.isArray(details)) return details;
  
  return details.map(detail => {
    if (typeof detail === 'string') {
      return sanitizeErrorMessage(detail);
    }
    return detail;
  });
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

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
        message = this.isProduction ? sanitizeErrorMessage(exceptionResponse) : exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        // Handle validation errors (array of messages)
        if (Array.isArray(res.message)) {
          message = 'Validation failed';
          // Sanitize validation details in production
          details = this.isProduction 
            ? sanitizeValidationDetails(res.message)
            : res.message;
          // Log validation errors for debugging
          this.logger.warn(`[${requestId}] Validation failed on ${request.method} ${request.url}: ${JSON.stringify(res.message)}`);
        } else {
          message = typeof res.message === 'string' 
            ? (this.isProduction ? sanitizeErrorMessage(res.message) : res.message)
            : message;
          details = res.errors ?? res.details;
        }
      }
    } else if (exception instanceof Error) {
      // Don't expose internal error messages in production
      message = this.isProduction ? 'Internal server error' : exception.message;
      
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
