import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true — needed to verify POS webhook HMAC signatures against the exact bytes
  // received (re-serializing the parsed JSON body would break signature verification on any
  // key-order/whitespace difference).
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(helmet());
  // Explicit origin allowlist, never '*' (OWASP A01/A05) — web dashboard origin only.
  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3001').split(','),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err: unknown) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
