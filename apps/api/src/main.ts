import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' });

  // whitelist: bỏ field lạ; forbidNonWhitelisted: báo lỗi nếu client gửi field không khai báo (NFR-08)
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Bộ lọc ngoại lệ toàn cục: chuẩn hóa định dạng lỗi cho frontend (NFR-08)
  app.useGlobalFilters(new HttpExceptionFilter());

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Gia phả API').setVersion('0.1').addBearerAuth().build(),
  );
  SwaggerModule.setup('api/docs', app, doc); // hợp đồng API cho frontend: http://localhost:3000/api/docs

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
