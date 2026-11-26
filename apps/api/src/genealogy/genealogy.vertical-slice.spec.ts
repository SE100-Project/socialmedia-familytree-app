import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AccountStatus,
  Branch,
  Clan,
  Gender,
  MemberProfile,
  MemberStatus,
  Relationship,
  RelationType,
  RoleAssignment,
  RoleType,
} from '@prisma/client';
import { AuditModule } from '../audit/audit.module';
import { AuthUser } from '../auth/auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBranchDto,
  CreateClanDto,
  CreateProfileDto,
  CreateRelationshipDto,
  SoftDeleteProfileQueryDto,
  UpdateBranchDto,
  UpdateProfileDto,
} from './dto';
import {
  BranchesController,
  ClansController,
  ProfilesController,
  RelationshipsController,
} from './genealogy.controller';
import { GenealogyModule } from './genealogy.module';
import { ProfileService } from './profile.service';
import { TREE_ANCESTOR_CHECKER, TreeAncestorChecker } from './tree-ancestor.port';

interface VerticalSliceStore {
  clans: Clan[];
  branches: Branch[];
  profiles: MemberProfile[];
  links: Array<{
    id: string;
    accountId: string;
    clanId: string;
    profileId: string;
    linkedAt: Date;
  }>;
  roles: RoleAssignment[];
  relationships: Relationship[];
  auditLogs: Array<{
    id: string;
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    beforeJson: unknown;
    afterJson: unknown;
    createdAt: Date;
  }>;
  accountStatuses: Map<string, AccountStatus>;
}

function createVerticalSliceDb() {
  let tick = 1_750_000_000_000;
  const nextDate = () => new Date((tick += 1000));

  const store: VerticalSliceStore = {
    clans: [],
    branches: [],
    profiles: [],
    links: [],
    roles: [],
    relationships: [],
    auditLogs: [],
    accountStatuses: new Map<string, AccountStatus>(),
  };

  const prisma: any = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    clan: {
      count: jest.fn(async () => store.clans.length),
      create: jest.fn(async ({ data }: any) => {
        const row: Clan = {
          id: randomUUID(),
          clanCode: data.clanCode,
          name: data.name,
          createdAt: nextDate(),
        };
        store.clans.push(row);
        return { ...row };
      }),
      findUnique: jest.fn(
        async ({ where }: any) => store.clans.find((c) => c.id === where.id) ?? null,
      ),
    },
    branch: {
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          store.branches.find((b) => {
            if (where.clanId && b.clanId !== where.clanId) return false;
            if (where.id?.not && b.id === where.id.not) return false;
            if (where.name?.equals) {
              return b.name.toLowerCase() === String(where.name.equals).toLowerCase();
            }
            return true;
          }) ?? null
        );
      }),
      findUnique: jest.fn(
        async ({ where }: any) => store.branches.find((b) => b.id === where.id) ?? null,
      ),
      findMany: jest.fn(async ({ where, take }: any) => {
        let rows = store.branches.filter((b) =>
          !where?.clanId ? true : b.clanId === where.clanId,
        );
        if (take) rows = rows.slice(0, take);
        return rows.map((b) => ({ ...b }));
      }),
      create: jest.fn(async ({ data }: any) => {
        const row: Branch = {
          id: randomUUID(),
          clanId: data.clanId,
          name: data.name,
        };
        store.branches.push(row);
        return { ...row };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = store.branches.findIndex((b) => b.id === where.id);
        if (idx === -1) throw new Error('Branch not found');
        store.branches[idx] = { ...store.branches[idx], ...data };
        return { ...store.branches[idx] };
      }),
    },
    memberProfile: {
      create: jest.fn(async ({ data }: any) => {
        const now = nextDate();
        const row: MemberProfile = {
          id: randomUUID(),
          clanId: data.clanId,
          branchId: data.branchId ?? null,
          accountId: data.accountId ?? null,
          fullName: data.fullName,
          gender: data.gender,
          bio: data.bio ?? null,
          birthDate: data.birthDate ?? null,
          deathDate: data.deathDate ?? null,
          deathCalendar: data.deathCalendar ?? null,
          status: data.status ?? MemberStatus.ALIVE,
          generation: data.generation ?? null,
          createdAt: now,
          updatedAt: now,
        };
        store.profiles.push(row);
        return { ...row };
      }),
      findUnique: jest.fn(async ({ where, include }: any) => {
        const match = store.profiles.find(
          (p) =>
            (where.id && p.id === where.id) || (where.accountId && p.accountId === where.accountId),
        );
        if (!match) return null;
        const result: any = { ...match };
        if (include?.accountProfileLink) {
          result.accountProfileLink = store.links.find((l) => l.profileId === match.id) ?? null;
        }
        if (include?.account) {
          result.account = match.accountId
            ? {
                id: match.accountId,
                status: store.accountStatuses.get(match.accountId) ?? AccountStatus.ACTIVE,
              }
            : null;
        }
        return result;
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => {
        const match = store.profiles.find((p) => p.id === where.id);
        if (!match) throw new Error('Profile not found');
        return { ...match };
      }),
      findMany: jest.fn(async ({ where, take }: any) => {
        let rows = store.profiles.filter((p) => {
          if (where?.id?.in && !where.id.in.includes(p.id)) return false;
          if (where?.clanId && p.clanId !== where.clanId) return false;
          if (where?.branchId !== undefined && p.branchId !== where.branchId) return false;
          if (where?.generation !== undefined && p.generation !== where.generation) return false;
          if (where?.status !== undefined) {
            if (
              typeof where.status === 'object' &&
              where.status !== null &&
              'not' in where.status
            ) {
              if (p.status === where.status.not) return false;
            } else if (p.status !== where.status) {
              return false;
            }
          }
          if (where?.accountId?.in && (!p.accountId || !where.accountId.in.includes(p.accountId))) {
            return false;
          }
          if (where?.fullName?.contains) {
            if (!p.fullName.toLowerCase().includes(String(where.fullName.contains).toLowerCase())) {
              return false;
            }
          }
          return true;
        });
        if (take) rows = rows.slice(0, take);
        return rows.map((p) => ({ ...p }));
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = store.profiles.findIndex((p) => p.id === where.id);
        if (idx === -1) throw new Error('Profile not found');
        store.profiles[idx] = { ...store.profiles[idx], ...data, updatedAt: nextDate() };
        return { ...store.profiles[idx] };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (let i = 0; i < store.profiles.length; i++) {
          const p = store.profiles[i];
          const updatedAtMatches =
            !where.updatedAt || p.updatedAt.getTime() === new Date(where.updatedAt).getTime();
          if (
            p.id === where.id &&
            (!where.clanId || p.clanId === where.clanId) &&
            (!where.status?.not || p.status !== where.status.not) &&
            updatedAtMatches
          ) {
            store.profiles[i] = { ...p, ...data, updatedAt: nextDate() };
            count++;
          }
        }
        return { count };
      }),
      count: jest.fn(
        async ({ where }: any) =>
          store.profiles.filter(
            (p) =>
              (!where?.clanId || p.clanId === where.clanId) &&
              (!where?.branchId || p.branchId === where.branchId) &&
              (!where?.status?.not || p.status !== where.status.not),
          ).length,
      ),
    },
    accountProfileLink: {
      findFirst: jest.fn(
        async ({ where }: any) => store.links.find((l) => l.accountId === where.accountId) ?? null,
      ),
      create: jest.fn(async ({ data }: any) => {
        const row = { id: randomUUID(), ...data, linkedAt: nextDate() };
        store.links.push(row);
        return { ...row };
      }),
    },
    roleAssignment: {
      create: jest.fn(async ({ data }: any) => {
        const row: RoleAssignment = {
          id: randomUUID(),
          accountId: data.accountId,
          type: data.type,
          clanId: data.clanId,
          branchId: data.branchId ?? null,
          validFrom: nextDate(),
          validTo: null,
        };
        store.roles.push(row);
        return { ...row };
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          store.roles.find((r) => {
            const branchMatches =
              where.branchId === undefined
                ? true
                : typeof where.branchId === 'object' &&
                    where.branchId !== null &&
                    'not' in where.branchId
                  ? r.branchId !== null && r.branchId !== where.branchId.not
                  : r.branchId === where.branchId;
            return (
              r.clanId === where.clanId &&
              branchMatches &&
              r.type === where.type &&
              r.accountId === where.accountId &&
              (where.validTo === null ? r.validTo === null : true)
            );
          }) ?? null
        );
      }),
      findMany: jest.fn(async ({ where }: any) =>
        store.roles.filter((r) => {
          if (where.clanId && r.clanId !== where.clanId) return false;
          if (where.branchId?.in && (!r.branchId || !where.branchId.in.includes(r.branchId))) {
            return false;
          }
          if (where.type && r.type !== where.type) return false;
          if (where.validTo === null && r.validTo !== null) return false;
          return true;
        }),
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (let i = 0; i < store.roles.length; i++) {
          const r = store.roles[i];
          if (
            (!where.clanId || r.clanId === where.clanId) &&
            (where.branchId === undefined || r.branchId === where.branchId) &&
            (!where.type || r.type === where.type) &&
            (!where.accountId ||
              (typeof where.accountId === 'string'
                ? r.accountId === where.accountId
                : !where.accountId.not || r.accountId !== where.accountId.not)) &&
            (where.validTo === null ? r.validTo === null : true)
          ) {
            store.roles[i] = { ...r, ...data };
            count++;
          }
        }
        return { count };
      }),
    },
    relationship: {
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          store.relationships.find((rel) => {
            if (where.type && rel.type !== where.type) return false;
            if (where.OR) {
              return where.OR.some((c: any) => rel.fromId === c.fromId && rel.toId === c.toId);
            }
            return rel.fromId === where.fromId && rel.toId === where.toId;
          }) ?? null
        );
      }),
      findMany: jest.fn(async ({ where }: any) =>
        store.relationships.filter((rel) => {
          const from = store.profiles.find((p) => p.id === rel.fromId);
          const to = store.profiles.find((p) => p.id === rel.toId);
          if (where?.active !== undefined && rel.active !== where.active) return false;
          if (where?.from?.clanId && from?.clanId !== where.from.clanId) return false;
          if (where?.to?.clanId && to?.clanId !== where.to.clanId) return false;
          if (where?.OR) {
            return where.OR.some((c: any) => rel.fromId === c.fromId || rel.toId === c.toId);
          }
          return true;
        }),
      ),
      create: jest.fn(async ({ data }: any) => {
        const row: Relationship = {
          id: randomUUID(),
          type: data.type,
          fromId: data.fromId,
          toId: data.toId,
          startDate: data.startDate ?? null,
          active: data.active ?? true,
        };
        store.relationships.push(row);
        return { ...row };
      }),
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: randomUUID(),
          actorId: data.actorId ?? null,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          beforeJson: data.beforeJson ?? null,
          afterJson: data.afterJson ?? null,
          createdAt: nextDate(),
        };
        store.auditLogs.push(row);
        return { ...row };
      }),
    },
    $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => {
      const snapshot: VerticalSliceStore = {
        clans: store.clans.map((x) => ({ ...x })),
        branches: store.branches.map((x) => ({ ...x })),
        profiles: store.profiles.map((x) => ({ ...x })),
        links: store.links.map((x) => ({ ...x })),
        roles: store.roles.map((x) => ({ ...x })),
        relationships: store.relationships.map((x) => ({ ...x })),
        auditLogs: store.auditLogs.map((x) => ({ ...x })),
        accountStatuses: new Map(store.accountStatuses),
      };
      try {
        return await cb(prisma);
      } catch (err) {
        Object.assign(store, snapshot);
        throw err;
      }
    }),
  };

  const ancestorChecker: TreeAncestorChecker = {
    async isAncestor(ancestorId: string, descendantId: string): Promise<boolean> {
      const parentsOf = new Map<string, string[]>();
      for (const rel of store.relationships) {
        if (rel.type !== RelationType.PARENT_CHILD || !rel.active) continue;
        const parents = parentsOf.get(rel.toId) ?? [];
        parents.push(rel.fromId);
        parentsOf.set(rel.toId, parents);
      }
      const visited = new Set<string>();
      const queue = [...(parentsOf.get(descendantId) ?? [])];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        if (cur === ancestorId) return true;
        if (visited.has(cur)) continue;
        visited.add(cur);
        for (const p of parentsOf.get(cur) ?? []) queue.push(p);
      }
      return false;
    },
  };

  return { prisma, store, ancestorChecker };
}

describe('B2-06 Vertical Slice: Khởi tạo dòng họ → Chi → Hồ sơ → Quan hệ → Dữ liệu cây & B2-05', () => {
  let moduleRef: TestingModule;
  let clansController: ClansController;
  let branchesController: BranchesController;
  let profilesController: ProfilesController;
  let relationshipsController: RelationshipsController;
  let profileService: ProfileService;
  let db: ReturnType<typeof createVerticalSliceDb>;

  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'vertical-slice-test-secret';
    db = createVerticalSliceDb();

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuditModule,
        GenealogyModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(db.prisma)
      .overrideProvider(TREE_ANCESTOR_CHECKER)
      .useValue(db.ancestorChecker)
      .compile();

    clansController = moduleRef.get(ClansController);
    branchesController = moduleRef.get(BranchesController);
    profilesController = moduleRef.get(ProfilesController);
    relationshipsController = moduleRef.get(RelationshipsController);
    profileService = moduleRef.get(ProfileService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('chạy trọn vẹn lát cắt dọc UC-07 → UC-08 → UC-10 → dữ liệu cây (UC-16) + B2-05 createUnlinkedProfile + AuditLog', async () => {
    // 1. UC-07: Tài khoản mới khởi tạo dòng họ qua ValidationPipe + ClansController
    const founderAccount: AuthUser = {
      id: randomUUID(),
      profileId: null,
      clanId: null,
      profileLinks: [],
      roles: [],
    };

    const createClanDto = await pipe.transform(
      {
        name: '  Dòng họ Đặng Tộc  ',
        clanCode: 'CLAN-DANG-01',
        ancestor: {
          fullName: 'Đặng Thủy Tổ',
          gender: Gender.MALE,
          status: MemberStatus.DECEASED,
          birthDate: '1900-01-01',
          deathDate: '1975-06-15',
        },
        creator: {
          fullName: 'Đặng Đăng Khoa',
          gender: Gender.MALE,
          generation: 3,
        },
      },
      { type: 'body', metatype: CreateClanDto },
    );

    const initialized = await clansController.createClan(founderAccount, createClanDto);
    expect(initialized.clan.name).toBe('Dòng họ Đặng Tộc');
    expect(initialized.clan.clanCode).toBe('CLAN-DANG-01');
    expect(initialized.role).toBe(RoleType.CLAN_HEAD);

    const clanHead: AuthUser = {
      id: founderAccount.id,
      profileId: initialized.creatorProfile.id,
      clanId: initialized.clan.id,
      profileLinks: [{ clanId: initialized.clan.id, profileId: initialized.creatorProfile.id }],
      roles: [{ type: RoleType.CLAN_HEAD, clanId: initialized.clan.id, branchId: null }],
    };

    const currentClan = await clansController.getCurrentClan(clanHead);
    expect(currentClan.id).toBe(initialized.clan.id);

    // 2. UC-08: Tạo Chi Trưởng và Chi Thứ (không Trưởng chi), bổ nhiệm Trưởng chi cho Chi Trưởng
    const chiTruong = await branchesController.createBranch(
      clanHead,
      await pipe.transform({ name: '  Chi Trưởng  ' }, { type: 'body', metatype: CreateBranchDto }),
    );
    const chiThu = await branchesController.createBranch(
      clanHead,
      await pipe.transform({ name: 'Chi Thứ' }, { type: 'body', metatype: CreateBranchDto }),
    );
    expect(chiTruong.name).toBe('Chi Trưởng');
    expect(chiThu.branchHead).toBeNull();

    // Tạo hồ sơ đời 2 (cha), đời 3 (Trưởng chi 1), đời 4 (cháu chưa điền đời để kiểm chứng tự suy ra đời)
    const gen2Father = await profilesController.createProfile(
      clanHead,
      await pipe.transform(
        {
          branchId: chiTruong.id,
          fullName: 'Đặng Đời Hai',
          gender: Gender.MALE,
          generation: 2,
        },
        { type: 'body', metatype: CreateProfileDto },
      ),
    );

    const branchHeadProfile = await profilesController.createProfile(
      clanHead,
      await pipe.transform(
        {
          branchId: chiTruong.id,
          fullName: 'Đặng Trưởng Chi',
          gender: Gender.MALE,
          generation: 3,
        },
        { type: 'body', metatype: CreateProfileDto },
      ),
    );

    // Liên kết tài khoản cho hồ sơ Trưởng chi (giống luồng sau UC-05)
    const branchHeadAccountId = randomUUID();
    db.store.profiles.find((p) => p.id === branchHeadProfile.id)!.accountId = branchHeadAccountId;
    db.store.links.push({
      id: randomUUID(),
      accountId: branchHeadAccountId,
      clanId: initialized.clan.id,
      profileId: branchHeadProfile.id,
      linkedAt: new Date(),
    });

    const assignedBranch = await branchesController.updateBranch(
      clanHead,
      chiTruong.id,
      await pipe.transform(
        { branchHeadProfileId: branchHeadProfile.id },
        { type: 'body', metatype: UpdateBranchDto },
      ),
    );
    expect(assignedBranch.branchHead?.profileId).toBe(branchHeadProfile.id);

    const branchHeadUser: AuthUser = {
      id: branchHeadAccountId,
      profileId: branchHeadProfile.id,
      clanId: initialized.clan.id,
      profileLinks: [{ clanId: initialized.clan.id, profileId: branchHeadProfile.id }],
      roles: [{ type: RoleType.BRANCH_HEAD, clanId: initialized.clan.id, branchId: chiTruong.id }],
    };

    // Trưởng chi không được sửa Chi Thứ -> 403
    await expect(
      branchesController.updateBranch(
        branchHeadUser,
        chiThu.id,
        await pipe.transform(
          { name: 'Đổi trái phép' },
          { type: 'body', metatype: UpdateBranchDto },
        ),
      ),
    ).rejects.toThrow(ForbiddenException);

    // 3. UC-10 Profiles: Trưởng chi tạo cháu đời 4 (để trống generation), sửa với optimistic lock + kiểm xung đột 409
    const gen4Child = await profilesController.createProfile(
      branchHeadUser,
      await pipe.transform(
        {
          branchId: chiTruong.id,
          fullName: 'Đặng Đời Bốn',
          gender: Gender.FEMALE,
        },
        { type: 'body', metatype: CreateProfileDto },
      ),
    );

    const staleUpdatedAt = gen4Child.updatedAt.toISOString();
    const updatedChild = await profilesController.updateProfile(
      branchHeadUser,
      gen4Child.id,
      await pipe.transform(
        {
          expectedUpdatedAt: staleUpdatedAt,
          bio: 'Cháu đời thứ 4 thuộc Chi Trưởng',
        },
        { type: 'body', metatype: UpdateProfileDto },
      ),
    );
    expect(updatedChild.bio).toBe('Cháu đời thứ 4 thuộc Chi Trưởng');

    await expect(
      profilesController.updateProfile(
        clanHead,
        gen4Child.id,
        await pipe.transform(
          { expectedUpdatedAt: staleUpdatedAt, fullName: 'Ghi đè cũ' },
          { type: 'body', metatype: UpdateProfileDto },
        ),
      ),
    ).rejects.toThrow(ConflictException);

    // 4. UC-10 Relationships: Nối 4 đời (Đời 1 -> Đời 2 -> Đời 3 -> Đời 4) + tự suy luận generation = 4 + chặn vòng 4 đời
    await relationshipsController.createRelationship(
      clanHead,
      await pipe.transform(
        {
          type: RelationType.PARENT_CHILD,
          fromId: initialized.ancestorProfile.id,
          toId: gen2Father.id,
        },
        { type: 'body', metatype: CreateRelationshipDto },
      ),
    );
    await relationshipsController.createRelationship(
      clanHead,
      await pipe.transform(
        {
          type: RelationType.PARENT_CHILD,
          fromId: gen2Father.id,
          toId: branchHeadProfile.id,
        },
        { type: 'body', metatype: CreateRelationshipDto },
      ),
    );
    await relationshipsController.createRelationship(
      branchHeadUser,
      await pipe.transform(
        {
          type: RelationType.PARENT_CHILD,
          fromId: branchHeadProfile.id,
          toId: gen4Child.id,
        },
        { type: 'body', metatype: CreateRelationshipDto },
      ),
    );

    // Cháu đời 4 đã được tự động suy luận generation = 4
    const reloadedGen4 = await profilesController.getProfile(clanHead, gen4Child.id);
    expect(reloadedGen4.generation).toBe(4);

    // Thử nối vòng 4 đời (Đời 4 -> Đời 1) -> bị chặn 400
    await expect(
      relationshipsController.createRelationship(
        clanHead,
        await pipe.transform(
          {
            type: RelationType.PARENT_CHILD,
            fromId: gen4Child.id,
            toId: initialized.ancestorProfile.id,
          },
          { type: 'body', metatype: CreateRelationshipDto },
        ),
      ),
    ).rejects.toThrow(BadRequestException);

    // 5. B2-05: BE-1 (JoinService) gọi createUnlinkedProfile trong transaction ngoài để tạo hồ sơ chưa có chủ
    const bridgeProfile = await db.prisma.$transaction(async (tx: any) =>
      profileService.createUnlinkedProfile(
        {
          clanId: initialized.clan.id,
          branchId: chiThu.id,
          fullName: 'Đặng Hồ Sơ Gia Nhập',
          gender: Gender.MALE,
          generation: 3,
        },
        tx,
      ),
    );
    expect(bridgeProfile.accountId).toBeNull();
    expect(bridgeProfile.branchId).toBe(chiThu.id);

    // 6. Xóa mềm 1 thành viên (BR-13): giữ nút & quan hệ để cây hiển thị Khuyết danh
    const softDeleteQuery = await pipe.transform(
      { expectedUpdatedAt: reloadedGen4.updatedAt.toISOString() },
      { type: 'query', metatype: SoftDeleteProfileQueryDto },
    );
    const removedGen4 = await profilesController.softDeleteProfile(
      branchHeadUser,
      gen4Child.id,
      softDeleteQuery,
    );
    expect(removedGen4.status).toBe(MemberStatus.REMOVED);

    // Kiểm tra lát cắt dữ liệu cây (nodes + edges) sẵn sàng cho UC-16
    const allProfiles = await profilesController.listProfiles(clanHead, { limit: 50 });
    const allEdges = await relationshipsController.listRelationships(clanHead, {});
    expect(allProfiles.items).toHaveLength(6);
    expect(
      allProfiles.items.some((p) => p.id === gen4Child.id && p.status === MemberStatus.REMOVED),
    ).toBe(true);
    expect(allEdges).toHaveLength(3);

    // 7. AuditService (FR-46) đã ghi đầy đủ nhật ký trong suốt lát cắt dọc
    const auditActions = db.store.auditLogs.map((a) => `${a.action}:${a.entityType}`);
    expect(auditActions).toEqual(
      expect.arrayContaining([
        'INIT_CLAN:CLAN',
        'CREATE_BRANCH:BRANCH',
        'UPDATE_BRANCH:BRANCH',
        'CREATE_PROFILE:MEMBER_PROFILE',
        'UPDATE_PROFILE:MEMBER_PROFILE',
        'SOFT_DELETE_PROFILE:MEMBER_PROFILE',
        'CREATE_RELATIONSHIP:RELATIONSHIP',
      ]),
    );
  });
});
