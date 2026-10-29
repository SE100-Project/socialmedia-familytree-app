import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './auth.guard';
import { PolicyService } from './policy.service';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.getOrThrow<string>('JWT_ACCESS_SECRET'), // thiếu biến môi trường => app không khởi động
        signOptions: { expiresIn: cfg.get<string>('JWT_ACCESS_TTL') ?? '15m' } as never,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PolicyService, RolesGuard],
  exports: [JwtAuthGuard, PolicyService, RolesGuard],
})
export class AuthModule {}
