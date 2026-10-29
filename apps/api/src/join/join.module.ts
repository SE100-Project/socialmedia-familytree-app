import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { JoinController } from './join.controller';
import { JoinService } from './join.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [JoinController],
  providers: [JoinService],
  exports: [JoinService],
})
export class JoinModule {}
