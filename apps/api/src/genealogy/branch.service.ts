import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, Branch, MemberStatus, Prisma, RoleType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.guard';
import { PolicyService } from '../auth/policy.service';
import { CursorPaginationDto, PaginatedResult } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto, UpdateBranchDto } from './dto';
import { AUDIT_ENTITY_TYPES, isPrismaUniqueError, resolveMemberClanId } from './genealogy.helpers';

export interface BranchHeadSummary {
  accountId: string;
  profileId: string | null;
  fullName: string | null;
}

export interface BranchView extends Branch {
  memberCount: number;
  branchHead: BranchHeadSummary | null;
}

/**
 * Service chuyên trách quản lý Chi phái & bổ nhiệm Trưởng chi (`UC-08` — `B2-02`, `BR-04`).
 * Tuân thủ SRP & GRASP High Cohesion / Information Expert.
 */
@Injectable()
export class BranchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
  ) {}

  /**
   * UC-08 (`B2-02`): Liệt kê các chi trong dòng họ (trả kèm thông tin Trưởng chi đương nhiệm hoặc `null`).
   */
  async listBranches(
    user: AuthUser,
    query: CursorPaginationDto,
  ): Promise<PaginatedResult<BranchView>> {
    const clanId = resolveMemberClanId(this.policy, user);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

    const branches = await this.prisma.branch.findMany({
      where: { clanId },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    const hasMore = branches.length > limit;
    const pageBranches = hasMore ? branches.slice(0, limit) : branches;
    const nextCursor = hasMore ? (pageBranches[pageBranches.length - 1]?.id ?? null) : null;

    const items = await this.hydrateBranchViews(this.prisma, clanId, pageBranches);

    return { items, nextCursor };
  }

  /**
   * UC-08 (`B2-02`): Tạo chi mới (chỉ `CLAN_HEAD`). Cho phép tạo chi chưa có Trưởng chi.
   */
  async createBranch(user: AuthUser, dto: CreateBranchDto): Promise<BranchView> {
    const clanId = this.requireClanHead(user, 'Chỉ Trưởng họ mới có quyền tạo chi');
    const name = dto.name.trim();

    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.branch.findFirst({
        where: {
          clanId,
          name: { equals: name, mode: 'insensitive' },
        },
      });
      if (duplicate) {
        throw new ConflictException(`Chi "${name}" đã tồn tại trong dòng họ`);
      }

      let branch: Branch;
      try {
        branch = await tx.branch.create({
          data: { clanId, name },
        });
      } catch (err) {
        if (isPrismaUniqueError(err)) {
          throw new ConflictException(`Chi "${name}" đã tồn tại trong dòng họ`);
        }
        throw err;
      }

      if (dto.branchHeadProfileId) {
        await this.assignBranchHeadInTx(tx, clanId, branch.id, dto.branchHeadProfileId);
      }

      const [view] = await this.hydrateBranchViews(tx, clanId, [branch]);

      await this.audit.log({
        actorId: user.id,
        action: 'CREATE_BRANCH',
        entityType: AUDIT_ENTITY_TYPES.BRANCH,
        entityId: branch.id,
        before: null,
        after: view,
        tx,
      });

      return view;
    });
  }

  /**
   * UC-08 (`B2-02`): Cập nhật tên chi và/hoặc chỉ định/thay đổi/bỏ trống Trưởng chi (chỉ `CLAN_HEAD`, bảo toàn huyết thống BR-04).
   */
  async updateBranch(user: AuthUser, branchId: string, dto: UpdateBranchDto): Promise<BranchView> {
    const clanId = this.requireClanHead(user, 'Chỉ Trưởng họ mới có quyền chỉnh sửa chi');
    if (dto.name === undefined && dto.branchHeadProfileId === undefined) {
      throw new BadRequestException('Cần ít nhất một trường để cập nhật chi');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.branch.findUnique({ where: { id: branchId } });
      if (!existing || existing.clanId !== clanId) {
        throw new NotFoundException('Không tìm thấy chi trong dòng họ');
      }

      const [before] = await this.hydrateBranchViews(tx, clanId, [existing]);

      let updatedBranch = existing;
      if (dto.name !== undefined) {
        const nextName = dto.name.trim();
        if (nextName !== existing.name) {
          const duplicate = await tx.branch.findFirst({
            where: {
              clanId,
              id: { not: branchId },
              name: { equals: nextName, mode: 'insensitive' },
            },
          });
          if (duplicate) {
            throw new ConflictException(`Chi "${nextName}" đã tồn tại trong dòng họ`);
          }

          try {
            updatedBranch = await tx.branch.update({
              where: { id: branchId },
              data: { name: nextName },
            });
          } catch (err) {
            if (isPrismaUniqueError(err)) {
              throw new ConflictException(`Chi "${nextName}" đã tồn tại trong dòng họ`);
            }
            throw err;
          }
        }
      }

      if (dto.branchHeadProfileId !== undefined) {
        await this.assignBranchHeadInTx(tx, clanId, branchId, dto.branchHeadProfileId);
      }

      const [after] = await this.hydrateBranchViews(tx, clanId, [updatedBranch]);

      await this.audit.log({
        actorId: user.id,
        action: 'UPDATE_BRANCH',
        entityType: AUDIT_ENTITY_TYPES.BRANCH,
        entityId: branchId,
        before,
        after,
        tx,
      });

      return after;
    });
  }

  private requireClanHead(user: AuthUser, message: string): string {
    const clanId = resolveMemberClanId(this.policy, user);
    if (!this.policy.isClanHead(user, clanId)) {
      throw new ForbiddenException(message);
    }
    return clanId;
  }

  private async assignBranchHeadInTx(
    tx: Prisma.TransactionClient,
    clanId: string,
    branchId: string,
    branchHeadProfileId: string | null,
  ): Promise<void> {
    const now = new Date();

    if (branchHeadProfileId === null) {
      await tx.roleAssignment.updateMany({
        where: {
          clanId,
          branchId,
          type: RoleType.BRANCH_HEAD,
          validTo: null,
        },
        data: { validTo: now },
      });
      return;
    }

    const targetProfile = await tx.memberProfile.findUnique({
      where: { id: branchHeadProfileId },
      include: {
        account: { select: { id: true, status: true } },
        accountProfileLink: true,
      },
    });

    if (!targetProfile || targetProfile.clanId !== clanId) {
      throw new NotFoundException('Không tìm thấy hồ sơ Trưởng chi được chỉ định');
    }
    if (targetProfile.status !== MemberStatus.ALIVE) {
      throw new BadRequestException('Chỉ có thể chỉ định thành viên đang còn sống làm Trưởng chi');
    }
    if (targetProfile.branchId !== null && targetProfile.branchId !== branchId) {
      throw new BadRequestException(
        'Thành viên đang thuộc chi khác, không thể chỉ định làm Trưởng chi',
      );
    }

    const linkedAccountId =
      targetProfile.accountProfileLink?.clanId === clanId
        ? targetProfile.accountProfileLink.accountId
        : null;
    const targetAccountId = targetProfile.accountId ?? linkedAccountId;
    if (!targetAccountId) {
      throw new BadRequestException('Hồ sơ được chỉ định Trưởng chi phải đã liên kết tài khoản');
    }
    if (targetProfile.account && targetProfile.account.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException(
        'Tài khoản của hồ sơ được chỉ định không ở trạng thái hoạt động',
      );
    }

    // Nếu hồ sơ chưa thuộc chi nào, gắn vào chi được bổ nhiệm để đồng bộ phạm vi quản lý (không đổi quan hệ huyết thống BR-04)
    if (targetProfile.branchId === null) {
      await tx.memberProfile.update({
        where: { id: targetProfile.id },
        data: { branchId },
      });
    }

    await tx.roleAssignment.updateMany({
      where: {
        clanId,
        branchId,
        type: RoleType.BRANCH_HEAD,
        validTo: null,
        accountId: { not: targetAccountId },
      },
      data: { validTo: now },
    });

    const alreadyAssigned = await tx.roleAssignment.findFirst({
      where: {
        clanId,
        branchId,
        type: RoleType.BRANCH_HEAD,
        accountId: targetAccountId,
        validTo: null,
      },
    });

    if (!alreadyAssigned) {
      await tx.roleAssignment.create({
        data: {
          accountId: targetAccountId,
          type: RoleType.BRANCH_HEAD,
          clanId,
          branchId,
        },
      });
    }
  }

  private async hydrateBranchViews(
    db: Prisma.TransactionClient | PrismaService,
    clanId: string,
    branches: Branch[],
  ): Promise<BranchView[]> {
    const headByBranch = await this.loadActiveBranchHeads(
      db,
      clanId,
      branches.map((b) => b.id),
    );
    const counts = await Promise.all(
      branches.map((branch) =>
        db.memberProfile.count({
          where: {
            branchId: branch.id,
            status: { not: MemberStatus.REMOVED },
          },
        }),
      ),
    );

    return branches.map((branch, idx) => ({
      ...branch,
      memberCount: counts[idx] ?? 0,
      branchHead: headByBranch.get(branch.id) ?? null,
    }));
  }

  private async loadActiveBranchHeads(
    db: Prisma.TransactionClient | PrismaService,
    clanId: string,
    branchIds: string[],
  ): Promise<Map<string, BranchHeadSummary>> {
    const map = new Map<string, BranchHeadSummary>();
    if (branchIds.length === 0) return map;

    const assignments = await db.roleAssignment.findMany({
      where: {
        clanId,
        branchId: { in: branchIds },
        type: RoleType.BRANCH_HEAD,
        validTo: null,
      },
      orderBy: { validFrom: 'desc' },
    });

    const accountIds = Array.from(new Set(assignments.map((a) => a.accountId)));
    const profiles =
      accountIds.length > 0
        ? await db.memberProfile.findMany({
            where: {
              clanId,
              accountId: { in: accountIds },
            },
            select: {
              id: true,
              accountId: true,
              fullName: true,
            },
          })
        : [];

    const profileByAccount = new Map(profiles.map((p) => [p.accountId, p]));

    for (const assignment of assignments) {
      if (!assignment.branchId || map.has(assignment.branchId)) continue;
      const profile = profileByAccount.get(assignment.accountId);
      map.set(assignment.branchId, {
        accountId: assignment.accountId,
        profileId: profile?.id ?? null,
        fullName: profile?.fullName ?? null,
      });
    }

    return map;
  }
}
