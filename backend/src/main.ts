import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

function getLogLevels(env: string): LogLevel[] {
  if (env === 'production') {
    return ['error', 'warn', 'log'];
  }
  return ['error', 'warn', 'log', 'debug', 'verbose'];
}

// Graceful shutdown timeout (30 seconds)
const SHUTDOWN_TIMEOUT_MS = 30000;

/**
 * Pre-flight validation for production environment
 * Fails fast if critical configuration is missing
 */
function validateProductionConfig(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) return;

  const logger = new Logger('PreFlight');
  const errors: string[] = [];

  // Critical: Encryption key required for data security
  if (!process.env.ENCRYPTION_KEY) {
    errors.push('ENCRYPTION_KEY is required in production for secure data encryption');
  } else if (process.env.ENCRYPTION_KEY.length < 32) {
    errors.push('ENCRYPTION_KEY must be at least 32 characters');
  }

  // Critical: CORS must be explicitly configured in production
  if (!process.env.CORS_ORIGINS || process.env.CORS_ORIGINS === '*') {
    logger.warn('CORS_ORIGINS is set to "*" in production - consider restricting to specific origins');
  }

  // Critical: Database URL required
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  // Critical: Supabase configuration
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    errors.push('SUPABASE_URL and SUPABASE_ANON_KEY are required');
  }

  // Critical: Redis configuration
  if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) {
    errors.push('UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN are required');
  }

  // Warning: LLM providers
  const llmProviders = [
    process.env.GROQ_API_KEY,
    process.env.GOOGLE_AI_API_KEY,
    process.env.HUGGINGFACE_API_KEY,
  ].filter(Boolean);
  if (llmProviders.length < 2) {
    logger.warn('Less than 2 LLM providers configured - council cross-critique may be limited');
  }

  if (errors.length > 0) {
    logger.error('Production configuration validation failed:');
    errors.forEach(err => { logger.error(`  - ${err}`); });
    throw new Error(`Production configuration invalid: ${errors.join('; ')}`);
  }

  logger.log('Production configuration validated successfully');
}

async function bootstrap(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const logger = new Logger('Bootstrap');

  // Validate production configuration before starting
  validateProductionConfig();

  const app = await NestFactory.create(AppModule, {
    logger: getLogLevels(process.env.NODE_ENV ?? 'development'),
    // In production, use JSON format for structured logging
    ...(isProduction && {
      bufferLogs: true,
    }),
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const corsOrigins = configService.get<string>('CORS_ORIGINS', '*');

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: isProduction ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration
  app.enableCors({
    origin: corsOrigins === '*' ? '*' : corsOrigins.split(',').map(o => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  });

  app.setGlobalPrefix(apiPrefix);

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Co-Op API')
      .setDescription('Co-Op Platform Backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  // Enable graceful shutdown
  app.enableShutdownHooks();

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`, error.stack);
    // Give time for logs to flush
    setTimeout(() => process.exit(1), 1000);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled rejection: ${String(reason)}`);
  });

  // Graceful shutdown on SIGTERM/SIGINT
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, starting graceful shutdown...`);
    
    const shutdownTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      await app.close();
      clearTimeout(shutdownTimer);
      logger.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      clearTimeout(shutdownTimer);
      logger.error(`Error during shutdown: ${String(error)}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen(port);
  logger.log(`🚀 Co-Op Backend running on port ${String(port)}`);
  logger.log(`📚 API Docs: http://localhost:${String(port)}/docs`);
}

void bootstrap();
