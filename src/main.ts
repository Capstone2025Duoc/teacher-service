import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config as dotenvConfig } from 'dotenv';
import morgan from 'morgan';
dotenvConfig();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for local frontend running on port 3004
  // Allow specific origins instead of wildcard when credentials are used.
  // Use `ALLOWED_ORIGINS` env var as comma-separated list, defaulting to http://localhost:3004
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3004')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({ origin: allowedOrigins, credentials: true });

  // HTTP request logging (dev)
  app.use(morgan('dev'));

  const port = parseInt(process.env.PORT ?? '3002', 10);
  await app.listen(port);
}

bootstrap();
