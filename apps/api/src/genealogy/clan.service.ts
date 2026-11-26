import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Clan, MemberProfile, MemberStatus, RoleType } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.guard';
import { PolicyService } from '../auth/policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClanDto } from './dto';
import { AUDIT_ENTITY_TYPES, isPrismaUniqueError, resolveMemberClanId } from './genealogy.helpers';
import { ProfileService } from './profile.service';

export interface InitClanResult {
  clan: Clan;
  ancestorProfile: MemberProfile;
  creatorProfile: MemberProfile;
  role: RoleType;
}

/**
 * Service chuyên trách quản lý vòng đời Dòng họ (`UC-07` — `B2-01`).
 * Tuân thủ SRP & GRASP High Cohesion: chỉ nắm giữ nghiệp vụ khởi tạo và đọc thông tin `Clan`.
 */
@Injectable()
export class ClanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly profileService: ProfileService,
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
}
