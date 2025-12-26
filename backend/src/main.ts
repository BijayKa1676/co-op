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

async function bootstrap(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const logger = new Logger('Bootstrap');

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
