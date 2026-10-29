import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpErrorFilter } from './common/http-error.filter';

export async function createApplication() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'test' ? false : ['log', 'warn', 'error'],
  });
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: config.get<string[]>('CORS_ORIGINS'),
    methods: ['GET', 'HEAD', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableShutdownHooks();
  return app;
}
