import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  Branch,
  Clan,
  MemberProfile,
  MemberStatus,
  Prisma,
  Relationship,
  RelationType,
  RoleType,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.guard';
import { PolicyService } from '../auth/policy.service';
import { CursorPaginationDto, PaginatedResult } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBranchDto,
  CreateClanDto,
  CreateRelationshipDto,
  ListRelationshipsQueryDto,
  UpdateBranchDto,
} from './dto';
import {
  AUDIT_ENTITY_TYPES,
  isPrismaUniqueError,
  parseOptionalDate,
  resolveMemberClanId,
} from './genealogy.helpers';
import { ProfileService } from './profile.service';
import { TREE_ANCESTOR_CHECKER, TreeAncestorChecker } from './tree-ancestor.port';

export interface BranchHeadSummary {
  accountId: string;
  profileId: string | null;
  fullName: string | null;
}

export interface BranchView extends Branch {
  memberCount: number;
  branchHead: BranchHeadSummary | null;
}

export interface InitClanResult {
  clan: Clan;
  ancestorProfile: MemberProfile;
  creatorProfile: MemberProfile;
  role: RoleType;
}

@Injectable()
export class GenealogyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly profileService: ProfileService,
    @Inject(TREE_ANCESTOR_CHECKER)
    private readonly treeAncestorChecker: TreeAncestorChecker,
  ) {}

  /**
   * UC-07 (`B2-01`): Khởi tạo dòng họ đầu tiên khi hệ thống còn trống.
   * Tạo trong một transaction duy nhất: Clan, hồ sơ tổ tiên, hồ sơ người tạo, liên kết tài khoản, vai trò CLAN_HEAD và audit.
   */
  async createClan(user: AuthUser, dto: CreateClanDto): Promise<InitClanResult> {
    if (this.policy.isTechSupport(user)) {
      throw new ForbiddenException('Tài khoản kỹ thuật viên không được phép khởi tạo dòng họ');
    }
    if (user.profileId || user.profileLinks.length > 0 || user.roles.length > 0) {
      throw new ConflictException('Tài khoản đã gắn với một dòng họ, không thể khởi tạo thêm');
    }

    const clanName = dto.name.trim();
    const clanCode = dto.clanCode?.trim().toUpperCase() || this.generateClanCode(clanName);

    return this.prisma.$transaction(async (tx) => {
      const existingClanCount = await tx.clan.count();
      if (existingClanCount > 0) {
        throw new ConflictException('Hệ thống đã có dòng họ, không thể khởi tạo dòng họ thứ hai');
      }

      const [existingOwnedProfile, existingLink] = await Promise.all([
        tx.memberProfile.findUnique({ where: { accountId: user.id } }),
        tx.accountProfileLink.findFirst({ where: { accountId: user.id } }),
      ]);
      if (existingOwnedProfile || existingLink) {
        throw new ConflictException('Tài khoản đã liên kết với hồ sơ thành viên khác');
      }

      let clan: Clan;
      try {
        clan = await tx.clan.create({
          data: {
            clanCode,
            name: clanName,
          },
        });
      } catch (err) {
        if (isPrismaUniqueError(err)) {
          throw new ConflictException(`Mã dòng họ "${clanCode}" đã tồn tại`);
        }
        throw err;
      }

      const ancestorProfile = await this.profileService.createUnlinkedProfile(
        {
          clanId: clan.id,
          branchId: null,
          fullName: dto.ancestor.fullName,
          gender: dto.ancestor.gender,
          birthDate: dto.ancestor.birthDate,
          deathDate: dto.ancestor.deathDate,
          deathCalendar: dto.ancestor.deathCalendar,
          status: dto.ancestor.status ?? MemberStatus.DECEASED,
          generation: 1,
          bio: dto.ancestor.bio,
        },
        tx,
      );

      const creatorProfile = await this.profileService.createUnlinkedProfile(
        {
          clanId: clan.id,
          branchId: null,
          accountId: user.id,
          fullName: dto.creator.fullName,
          gender: dto.creator.gender,
          birthDate: dto.creator.birthDate,
          status: MemberStatus.ALIVE,
          generation: dto.creator.generation ?? 2,
          bio: dto.creator.bio,
        },
        tx,
      );

      await tx.accountProfileLink.create({
        data: {
          accountId: user.id,
          clanId: clan.id,
          profileId: creatorProfile.id,
        },
      });

      await tx.roleAssignment.create({
        data: {
          accountId: user.id,
          type: RoleType.CLAN_HEAD,
          clanId: clan.id,
          branchId: null,
        },
      });

      await this.audit.log({
        actorId: user.id,
        action: 'INIT_CLAN',
        entityType: AUDIT_ENTITY_TYPES.CLAN,
        entityId: clan.id,
        before: null,
        after: {
          clan,
          ancestorProfileId: ancestorProfile.id,
          creatorProfileId: creatorProfile.id,
          role: RoleType.CLAN_HEAD,
        },
        tx,
      });

      return {
        clan,
        ancestorProfile,
        creatorProfile,
        role: RoleType.CLAN_HEAD,
      };
    });
  }

  /**
   * Lấy thông tin dòng họ của thành viên đang đăng nhập.
   */
  async getCurrentClan(user: AuthUser): Promise<Clan> {
    const clanId = resolveMemberClanId(this.policy, user);
    const clan = await this.prisma.clan.findUnique({ where: { id: clanId } });
    if (!clan) {
      throw new NotFoundException('Không tìm thấy thông tin dòng họ');
    }
    return clan;
  }

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

  /**
   * UC-10 (`B2-04`): Tạo quan hệ `PARENT_CHILD` hoặc `SPOUSE` giữa hai hồ sơ trong cùng dòng họ.
   * Chặn tự tham chiếu, khác dòng họ, hồ sơ đã xóa mềm, quan hệ trùng và vòng tổ tiên.
   */
  async createRelationship(user: AuthUser, dto: CreateRelationshipDto): Promise<Relationship> {
    const clanId = resolveMemberClanId(this.policy, user);

    if (dto.fromId === dto.toId) {
      throw new BadRequestException('Không thể tạo quan hệ với chính mình');
    }

    const startDate = parseOptionalDate(dto.startDate, 'Ngày bắt đầu') ?? null;

    return this.prisma.$transaction(async (tx) => {
      const profiles = await tx.memberProfile.findMany({
        where: { id: { in: [dto.fromId, dto.toId] } },
      });

      const fromProfile = profiles.find((p) => p.id === dto.fromId);
      const toProfile = profiles.find((p) => p.id === dto.toId);

      if (!fromProfile || !toProfile) {
        throw new NotFoundException('Không tìm thấy hồ sơ thành viên được liên kết');
      }

      if (fromProfile.clanId !== clanId || toProfile.clanId !== clanId) {
        throw new BadRequestException('Hai hồ sơ phải thuộc cùng một dòng họ');
      }

      if (
        fromProfile.status === MemberStatus.REMOVED ||
        toProfile.status === MemberStatus.REMOVED
      ) {
        throw new BadRequestException('Không thể thiết lập quan hệ cho hồ sơ đã xóa mềm');
      }

      this.policy.assertCanManageMember(user, clanId, fromProfile.branchId);
      this.policy.assertCanManageMember(user, clanId, toProfile.branchId);

      await this.assertNoDuplicateOrCycleInTx(tx, dto);

      let created: Relationship;
      try {
        created = await tx.relationship.create({
          data: {
            type: dto.type,
            fromId: dto.fromId,
            toId: dto.toId,
            startDate,
            active: true,
          },
        });
      } catch (err) {
        if (isPrismaUniqueError(err)) {
          throw new ConflictException('Quan hệ này đã tồn tại');
        }
        if (this.isAncestorCycleTriggerError(err)) {
          throw new BadRequestException('Quan hệ tạo vòng lặp tổ tiên');
        }
        throw err;
      }

      await this.syncMissingGenerationsInTx(tx, dto.type, fromProfile, toProfile);

      await this.audit.log({
        actorId: user.id,
        action: 'CREATE_RELATIONSHIP',
        entityType: AUDIT_ENTITY_TYPES.RELATIONSHIP,
        entityId: created.id,
        before: null,
        after: created,
        tx,
      });

      return created;
    });
  }

  /**
   * Liệt kê các quan hệ phả hệ đang hoạt động trong dòng họ (có thể lọc theo một `profileId`).
   */
  async listRelationships(
    user: AuthUser,
    query: ListRelationshipsQueryDto,
  ): Promise<Relationship[]> {
    const clanId = resolveMemberClanId(this.policy, user);

    return this.prisma.relationship.findMany({
      where: {
        active: true,
        from: { clanId },
        to: { clanId },
        ...(query.profileId
          ? {
              OR: [{ fromId: query.profileId }, { toId: query.profileId }],
            }
          : {}),
      },
      orderBy: [{ type: 'asc' }, { id: 'asc' }],
    });
  }

  private async assertNoDuplicateOrCycleInTx(
    tx: Prisma.TransactionClient,
    dto: CreateRelationshipDto,
  ): Promise<void> {
    if (dto.type === RelationType.PARENT_CHILD) {
      const duplicateParentChild = await tx.relationship.findFirst({
        where: {
          type: RelationType.PARENT_CHILD,
          fromId: dto.fromId,
          toId: dto.toId,
        },
      });
      if (duplicateParentChild) {
        throw new ConflictException('Quan hệ cha/mẹ - con này đã tồn tại');
      }

      // Kiểm tra đảo chiều trực tiếp (con làm cha/mẹ của chính cha/mẹ mình) ngay cả khi stub isAncestor trả false
      const reverseParentChild = await tx.relationship.findFirst({
        where: {
          type: RelationType.PARENT_CHILD,
          fromId: dto.toId,
          toId: dto.fromId,
        },
      });
      if (reverseParentChild) {
        throw new BadRequestException('Quan hệ tạo vòng lặp tổ tiên trực tiếp');
      }

      // Gọi cổng B3-01 (TreeRepository.isAncestor): nếu người nhận vai "con" (toId) đã là tổ tiên của "cha/mẹ" (fromId) -> vòng tổ tiên
      const createsCycle = await this.treeAncestorChecker.isAncestor(dto.toId, dto.fromId);
      if (createsCycle) {
        throw new BadRequestException('Quan hệ tạo vòng lặp tổ tiên');
      }
      return;
    }

    const duplicateSpouse = await tx.relationship.findFirst({
      where: {
        type: RelationType.SPOUSE,
        OR: [
          { fromId: dto.fromId, toId: dto.toId },
          { fromId: dto.toId, toId: dto.fromId },
        ],
      },
    });
    if (duplicateSpouse) {
      throw new ConflictException('Quan hệ vợ/chồng này đã tồn tại');
    }
  }

  private async syncMissingGenerationsInTx(
    tx: Prisma.TransactionClient,
    type: RelationType,
    fromProfile: MemberProfile,
    toProfile: MemberProfile,
  ): Promise<void> {
    if (type === RelationType.PARENT_CHILD) {
      if (fromProfile.generation !== null && toProfile.generation === null) {
        await tx.memberProfile.update({
          where: { id: toProfile.id },
          data: { generation: fromProfile.generation + 1 },
        });
      }
      return;
    }

    if (fromProfile.generation !== null && toProfile.generation === null) {
      await tx.memberProfile.update({
        where: { id: toProfile.id },
        data: { generation: fromProfile.generation },
      });
    } else if (toProfile.generation !== null && fromProfile.generation === null) {
      await tx.memberProfile.update({
        where: { id: fromProfile.id },
        data: { generation: toProfile.generation },
      });
    }
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

  private generateClanCode(name: string): string {
    const asciiSlug = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toUpperCase()
      .slice(0, 16);
    const suffix = randomBytes(3).toString('hex').toUpperCase();
    return asciiSlug ? `CLAN-${asciiSlug}-${suffix}` : `CLAN-${suffix}`;
  }

  private isAncestorCycleTriggerError(err: unknown): boolean {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const code = (err.meta as { code?: unknown } | undefined)?.code;
      if (code === 'P0001') return true;
    }
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return msg.includes('vòng tổ tiên') || msg.includes('vong to tien') || msg.includes('p0001');
  }
}
