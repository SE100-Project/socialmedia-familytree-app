import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CalendarType,
  Gender,
  MemberProfile,
  MemberStatus,
  Prisma,
  RoleType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.guard';
import { PolicyService } from '../auth/policy.service';
import { PaginatedResult } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfileDto, ListProfilesQueryDto, UpdateProfileDto } from './dto';
import {
  AUDIT_ENTITY_TYPES,
  parseOptionalDate,
  resolveMemberClanId,
  toUtcDateKey,
} from './genealogy.helpers';

export interface CreateUnlinkedProfileInput {
  clanId: string;
  branchId?: string | null;
  fullName: string;
  gender: Gender;
  birthDate?: string | Date | null;
  deathDate?: string | Date | null;
  deathCalendar?: CalendarType | null;
  status?: MemberStatus;
  generation?: number | null;
  bio?: string | null;
  accountId?: string | null;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Tạo hồ sơ thành viên mới chưa gắn tài khoản (dùng trực tiếp ở Sprint 1 và cho `JoinService` B1-08 ở Sprint 2).
   */
  async createUnlinkedProfile(
    input: CreateUnlinkedProfileInput,
    tx?: Prisma.TransactionClient,
  ): Promise<MemberProfile> {
    const db = tx ?? this.prisma;
    const status = input.status ?? MemberStatus.ALIVE;
    if (status === MemberStatus.REMOVED) {
      throw new BadRequestException('Không thể tạo hồ sơ ở trạng thái đã xóa');
    }

    const birthDate = this.coerceDate(input.birthDate, 'Ngày sinh') ?? null;
    const deathDate = this.coerceDate(input.deathDate, 'Ngày mất') ?? null;
    this.validateProfileDatesAndStatus(status, birthDate, deathDate);

    if (input.branchId) {
      await this.assertBranchBelongsToClan(db, input.clanId, input.branchId);
    }

    return db.memberProfile.create({
      data: {
        clanId: input.clanId,
        branchId: input.branchId ?? null,
        accountId: input.accountId ?? null,
        fullName: input.fullName.trim(),
        gender: input.gender,
        birthDate,
        deathDate,
        deathCalendar: status === MemberStatus.DECEASED ? (input.deathCalendar ?? null) : null,
        status,
        generation: input.generation ?? null,
        bio: input.bio?.trim() || null,
      },
    });
  }

  /**
   * Liệt kê hồ sơ trong dòng họ của người dùng hiện tại (phân trang theo con trỏ).
   */
  async listProfiles(
    user: AuthUser,
    query: ListProfilesQueryDto,
  ): Promise<PaginatedResult<MemberProfile>> {
    const clanId = resolveMemberClanId(this.policy, user);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const search = query.search?.trim();

    const where: Prisma.MemberProfileWhereInput = {
      clanId,
      ...(query.branchId !== undefined ? { branchId: query.branchId } : {}),
      ...(query.generation !== undefined ? { generation: query.generation } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(search
        ? {
            fullName: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const rows = await this.prisma.memberProfile.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    return { items, nextCursor };
  }

  /**
   * Lấy chi tiết một hồ sơ theo ID trong cùng dòng họ (trả kèm `updatedAt` cho khóa lạc quan).
   */
  async getProfileById(user: AuthUser, profileId: string): Promise<MemberProfile> {
    const clanId = resolveMemberClanId(this.policy, user);
    const profile = await this.prisma.memberProfile.findUnique({ where: { id: profileId } });
    if (!profile || profile.clanId !== clanId) {
      throw new NotFoundException('Không tìm thấy hồ sơ thành viên');
    }
    return profile;
  }

  /**
   * Tạo hồ sơ thành viên mới trực tiếp (`B2-03` - tạm thời cho Trưởng họ / Trưởng chi trong phạm vi chi).
   */
  async createProfile(user: AuthUser, dto: CreateProfileDto): Promise<MemberProfile> {
    const clanId = resolveMemberClanId(this.policy, user);
    const targetBranchId = dto.branchId ?? null;
    this.policy.assertCanManageMember(user, clanId, targetBranchId);

    return this.prisma.$transaction(async (tx) => {
      const created = await this.createUnlinkedProfile(
        {
          clanId,
          branchId: targetBranchId,
          fullName: dto.fullName,
          gender: dto.gender,
          birthDate: dto.birthDate,
          deathDate: dto.deathDate,
          deathCalendar: dto.deathCalendar,
          status: dto.status ?? MemberStatus.ALIVE,
          generation: dto.generation ?? null,
          bio: dto.bio ?? null,
        },
        tx,
      );

      await this.audit.log({
        actorId: user.id,
        action: 'CREATE_PROFILE',
        entityType: AUDIT_ENTITY_TYPES.MEMBER_PROFILE,
        entityId: created.id,
        before: null,
        after: created,
        tx,
      });

      return created;
    });
  }

  /**
   * Cập nhật hồ sơ thành viên với kiểm tra phạm vi chi, khóa lạc quan (`expectedUpdatedAt`) và audit trước/sau.
   */
  async updateProfile(
    user: AuthUser,
    profileId: string,
    dto: UpdateProfileDto,
  ): Promise<MemberProfile> {
    const clanId = resolveMemberClanId(this.policy, user);
    const expectedUpdatedAt = new Date(dto.expectedUpdatedAt);
    if (Number.isNaN(expectedUpdatedAt.getTime())) {
      throw new BadRequestException('expectedUpdatedAt không hợp lệ');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.memberProfile.findUnique({ where: { id: profileId } });
      if (!existing || existing.clanId !== clanId) {
        throw new NotFoundException('Không tìm thấy hồ sơ thành viên');
      }

      // Kiểm tra quyền trên chi hiện tại trước khi tiết lộ trạng thái vòng đời hồ sơ
      this.policy.assertCanManageMember(user, existing.clanId, existing.branchId);

      if (existing.status === MemberStatus.REMOVED) {
        throw new BadRequestException('Không thể chỉnh sửa hồ sơ đã xóa mềm');
      }

      // Nếu đổi chi, kiểm tra chi mới thuộc dòng họ và nằm trong phạm vi quyền
      if (dto.branchId !== undefined && dto.branchId !== existing.branchId) {
        if (dto.branchId !== null) {
          await this.assertBranchBelongsToClan(tx, clanId, dto.branchId);
        }
        this.policy.assertCanManageMember(user, clanId, dto.branchId);
      }

      const nextStatus = dto.status ?? existing.status;
      const parsedBirth = parseOptionalDate(dto.birthDate, 'Ngày sinh');
      const parsedDeath = parseOptionalDate(dto.deathDate, 'Ngày mất');

      const effectiveBirth = parsedBirth !== undefined ? parsedBirth : existing.birthDate;
      // Khi chuyển từ DECEASED sang ALIVE mà không gửi deathDate mới, tự động xóa ngày mất cũ
      const effectiveDeath =
        nextStatus === MemberStatus.ALIVE && dto.deathDate === undefined
          ? null
          : parsedDeath !== undefined
            ? parsedDeath
            : existing.deathDate;

      this.validateProfileDatesAndStatus(nextStatus, effectiveBirth, effectiveDeath);

      const updateData: Prisma.MemberProfileUncheckedUpdateManyInput = {
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(parsedBirth !== undefined ? { birthDate: parsedBirth } : {}),
        ...(dto.deathDate !== undefined || nextStatus === MemberStatus.ALIVE
          ? { deathDate: effectiveDeath }
          : {}),
        ...(nextStatus === MemberStatus.ALIVE
          ? { deathCalendar: null }
          : dto.deathCalendar !== undefined
            ? { deathCalendar: dto.deathCalendar }
            : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.generation !== undefined ? { generation: dto.generation } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio === null ? null : dto.bio.trim() || null } : {}),
      };

      const result = await tx.memberProfile.updateMany({
        where: {
          id: profileId,
          clanId,
          updatedAt: expectedUpdatedAt,
          status: { not: MemberStatus.REMOVED },
        },
        data: updateData,
      });

      if (result.count === 0) {
        throw new ConflictException(
          'Hồ sơ đã bị thay đổi bởi một phiên làm việc khác, vui lòng tải lại trước khi lưu',
        );
      }

      const after = await tx.memberProfile.findUniqueOrThrow({ where: { id: profileId } });

      await this.audit.log({
        actorId: user.id,
        action: 'UPDATE_PROFILE',
        entityType: AUDIT_ENTITY_TYPES.MEMBER_PROFILE,
        entityId: profileId,
        before: existing,
        after,
        tx,
      });

      return after;
    });
  }

  /**
   * Xóa mềm hồ sơ thành viên (`status = REMOVED`), giữ nguyên nút và các cạnh quan hệ để cây hiển thị `Khuyết danh` (BR-13).
   */
  async softDeleteProfile(
    user: AuthUser,
    profileId: string,
    expectedUpdatedAtRaw?: string,
  ): Promise<MemberProfile> {
    const clanId = resolveMemberClanId(this.policy, user);
    let expectedUpdatedAt: Date | undefined;
    if (expectedUpdatedAtRaw !== undefined) {
      expectedUpdatedAt = new Date(expectedUpdatedAtRaw);
      if (Number.isNaN(expectedUpdatedAt.getTime())) {
        throw new BadRequestException('expectedUpdatedAt không hợp lệ');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.memberProfile.findUnique({ where: { id: profileId } });
      if (!existing || existing.clanId !== clanId) {
        throw new NotFoundException('Không tìm thấy hồ sơ thành viên');
      }

      this.policy.assertCanManageMember(user, existing.clanId, existing.branchId);

      if (existing.status === MemberStatus.REMOVED) {
        throw new BadRequestException('Hồ sơ đã được xóa mềm trước đó');
      }

      if (existing.accountId) {
        const activeHeadRole = await tx.roleAssignment.findFirst({
          where: {
            clanId,
            accountId: existing.accountId,
            type: RoleType.CLAN_HEAD,
            validTo: null,
          },
        });
        if (activeHeadRole) {
          throw new BadRequestException('Không thể xóa mềm hồ sơ của Trưởng họ đang đương nhiệm');
        }
      }

      const result = await tx.memberProfile.updateMany({
        where: {
          id: profileId,
          clanId,
          status: { not: MemberStatus.REMOVED },
          ...(expectedUpdatedAt ? { updatedAt: expectedUpdatedAt } : {}),
        },
        data: { status: MemberStatus.REMOVED },
      });

      if (result.count === 0) {
        throw new ConflictException(
          'Hồ sơ đã được cập nhật hoặc xóa bởi thao tác khác, vui lòng tải lại',
        );
      }

      if (existing.accountId) {
        await tx.roleAssignment.updateMany({
          where: {
            clanId,
            accountId: existing.accountId,
            type: RoleType.BRANCH_HEAD,
            validTo: null,
          },
          data: { validTo: new Date() },
        });
      }

      const after = await tx.memberProfile.findUniqueOrThrow({ where: { id: profileId } });

      await this.audit.log({
        actorId: user.id,
        action: 'SOFT_DELETE_PROFILE',
        entityType: AUDIT_ENTITY_TYPES.MEMBER_PROFILE,
        entityId: profileId,
        before: existing,
        after,
        tx,
      });

      return after;
    });
  }

  private coerceDate(
    value: string | Date | null | undefined,
    label: string,
  ): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new BadRequestException(`${label} không hợp lệ`);
      }
      return value;
    }
    return parseOptionalDate(value, label);
  }

  private validateProfileDatesAndStatus(
    status: MemberStatus,
    birthDate: Date | null,
    deathDate: Date | null,
  ): void {
    if (status === MemberStatus.ALIVE && deathDate !== null) {
      throw new BadRequestException('Hồ sơ còn sống (ALIVE) không thể có ngày mất');
    }
    if (birthDate && deathDate && toUtcDateKey(deathDate) < toUtcDateKey(birthDate)) {
      throw new BadRequestException('Ngày mất không được nhỏ hơn ngày sinh');
    }
  }

  private async assertBranchBelongsToClan(
    db: Prisma.TransactionClient | PrismaService,
    clanId: string,
    branchId: string,
  ): Promise<void> {
    const branch = await db.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.clanId !== clanId) {
      throw new BadRequestException('Chi được chọn không tồn tại trong dòng họ');
    }
  }
}
