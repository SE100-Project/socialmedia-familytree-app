import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberProfile, MemberStatus, Prisma, Relationship, RelationType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.guard';
import { PolicyService } from '../auth/policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRelationshipDto, ListRelationshipsQueryDto } from './dto';
import {
  AUDIT_ENTITY_TYPES,
  isPrismaUniqueError,
  parseOptionalDate,
  resolveMemberClanId,
} from './genealogy.helpers';
import { TREE_ANCESTOR_CHECKER, TreeAncestorChecker } from './tree-ancestor.port';

/**
 * Service chuyên trách quản lý Quan hệ phả hệ (`UC-10` — `B2-04`).
 * Tuân thủ SRP, DIP & GRASP Protected Variations: tách biệt kiểm tra vòng tổ tiên qua cổng `TREE_ANCESTOR_CHECKER`.
 */
@Injectable()
export class RelationshipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    @Inject(TREE_ANCESTOR_CHECKER)
    private readonly treeAncestorChecker: TreeAncestorChecker,
  ) {}

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

      const reverseDirect = await tx.relationship.findFirst({
        where: {
          type: RelationType.PARENT_CHILD,
          fromId: dto.toId,
          toId: dto.fromId,
        },
      });
      if (reverseDirect) {
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
