import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config as dotenvConfig } from 'dotenv';
import morgan from 'morgan';
dotenvConfig();

const parseOrigins = (value?: string): string[] =>
  (value ? value.split(',') : [])
    .map((origin) => origin.trim())
    .filter((origin): origin is string => origin.length > 0);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const defaultFrontend = 'https://0r5lvz74-3004.brs.devtunnels.ms';
  const envOrigins = parseOrigins(process.env.FRONTEND_URLS);
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    ...envOrigins,
    defaultFrontend,
    'http://localhost:3004',
    'http://127.0.0.1:3004',
  ].filter((origin): origin is string => Boolean(origin?.trim()));
  const originWhitelist = Array.from(new Set(allowedOrigins));

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (originWhitelist.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Origin not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'Set-Cookie',
      'X-Requested-With',
    ],
    exposedHeaders: ['Set-Cookie'],
  });

  // HTTP request logging (dev)
  app.use(morgan('dev'));

  const port = parseInt(process.env.PORT ?? '3002', 10);
  await app.listen(port);
}

bootstrap().catch((error) => {
  console.error('Teacher service bootstrap failed', error);
  process.exit(1);
});
