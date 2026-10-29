import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogOptions {
  actorId?: string | null;
  action: string; // Ví dụ: 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'CHANGE_ROLE'
  entityType: string; // Ví dụ: 'MEMBER_PROFILE', 'RELATIONSHIP', 'CLAN', 'BRANCH', 'FUND_TRANSACTION'
  entityId: string;
  before?: unknown;
  after?: unknown;
  tx?: Prisma.TransactionClient;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ghi vết kiểm toán (FR-46 / Audit Trail).
   * QUY TẮC BẮT BUỘC: Không bao giờ ném lỗi để không làm gián đoạn luồng nghiệp vụ chính.
   * Có thể nhận client transaction (tx) để cùng commit trong một giao dịch nguyên vẹn (NFR-07).
   */
  async log(options: AuditLogOptions): Promise<void> {
    try {
      const db = options.tx ?? this.prisma;

      const oldValue =
        options.before !== undefined && options.before !== null
          ? (JSON.parse(JSON.stringify(options.before)) as Prisma.InputJsonValue)
          : Prisma.DbNull;

      const newValue =
        options.after !== undefined && options.after !== null
          ? (JSON.parse(JSON.stringify(options.after)) as Prisma.InputJsonValue)
          : Prisma.DbNull;

      await db.auditLog.create({
        data: {
          actorId: options.actorId ?? null,
          action: options.action,
          entityType: options.entityType,
          entityId: options.entityId,
          before: oldValue,
          after: newValue,
        },
      });
    } catch (error) {
      // Bắt mọi ngoại lệ và chỉ log cảnh báo, không để lỗi audit làm sập nghiệp vụ chính
      this.logger.warn(
        `Không thể ghi audit log [${options.action}] cho [${options.entityType}:${options.entityId}]: ${(error as Error).message}`,
      );
    }
  }
}

