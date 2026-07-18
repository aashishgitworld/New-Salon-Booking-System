import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ClassSerializerInterceptor } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('app.port');
  const apiPrefix = config.getOrThrow<string>('app.apiPrefix');
  const frontendUrl = config.getOrThrow<string>('app.frontendUrl');

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: false, // Swagger UI needs inline scripts
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS — frontend and socket clients
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:3000'],
    credentials: true,
  });

  app.setGlobalPrefix(apiPrefix);

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Salon Booking API')
    .setDescription(
      'Salon appointment & time-slot management system. Includes authentication, appointments, notification templates, bulk processing, and live socket-based status.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'Enter your JWT access token',
      in: 'header',
    })
    .addTag('Auth', 'User registration, login, and email verification')
    .addTag('Services', 'Salon service catalog')
    .addTag('Appointments', 'Appointment CRUD and time-slot queries')
    .addTag('Notification Templates', 'Email confirmation templates')
    .addTag('Notifications', 'Send confirmations, bulk uploads, and logs')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  const url = await app.getUrl();
  console.log(`Salon Booking API running at: ${url}/${apiPrefix}`);
  console.log(`Swagger docs at: ${url}/${apiPrefix}/docs`);
}

bootstrap();
