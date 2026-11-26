import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.guard';
import { PolicyService } from '../auth/policy.service';

/**
 * Chuẩn hóa tên loại đối tượng ghi vào AuditLog (đồng bộ UPPER_SNAKE_CASE với `AuditService` và `JoinService`).
 */
export const AUDIT_ENTITY_TYPES = {
  CLAN: 'CLAN',
  BRANCH: 'BRANCH',
  MEMBER_PROFILE: 'MEMBER_PROFILE',
  RELATIONSHIP: 'RELATIONSHIP',
} as const;

/**
 * Xác thực người dùng là thành viên đã liên kết hồ sơ (không phải KTV) và trả về `clanId` hiện tại.
 */
export function resolveMemberClanId(policy: PolicyService, user: AuthUser): string {
  const clanId = user.clanId ?? user.profileLinks[0]?.clanId ?? null;
  policy.assertMember(user, clanId ?? undefined);
  if (!clanId) {
    throw new ForbiddenException('Tài khoản chưa liên kết với dòng họ nào');
  }
  return clanId;
}

/**
 * Chuyển chuỗi ISO 8601 sang `Date` (hoặc giữ nguyên `null`/`undefined`).
 */
export function parseOptionalDate(
  value: string | null | undefined,
  fieldLabel: string,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${fieldLabel} không hợp lệ`);
  }
  return parsed;
}

/**
 * Chuẩn hóa giá trị `Date` thành khóa ngày `YYYY-MM-DD` (UTC) để so khớp cột `@db.Date` của PostgreSQL.
 */
export function toUtcDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Kiểm tra lỗi ràng buộc duy nhất (P2002) của Prisma.
 */
export function isPrismaUniqueError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
