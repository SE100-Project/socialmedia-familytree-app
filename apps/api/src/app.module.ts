import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { JoinModule } from './join/join.module';

// Modular monolith: mỗi nhóm use case là một module (xem docs/architecture.md).
// Thêm module mới (genealogy, feed, events, funds, reports, audit...) vào imports ở đây.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, AuditModule, JoinModule],
  controllers: [HealthController],
})
export class AppModule {}
