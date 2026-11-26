import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import {
  AccountStatus,
  Branch,
  Clan,
  Gender,
  MemberProfile,
  MemberStatus,
  Prisma,
  Relationship,
  RelationType,
  RoleAssignment,
  RoleType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.guard';
import { PolicyService } from '../auth/policy.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBranchDto,
  CreateClanDto,
  CreateProfileDto,
  CreateRelationshipDto,
  SoftDeleteProfileQueryDto,
  UpdateBranchDto,
} from './dto';
import { BranchService } from './branch.service';
import { ClanService } from './clan.service';
import { GenealogyService } from './genealogy.service';
import { ProfileService } from './profile.service';
import { RelationshipService } from './relationship.service';
import { StubTreeAncestorChecker, TreeAncestorChecker } from './tree-ancestor.port';

interface InMemoryStore {
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
  accountStatuses: Map<string, AccountStatus>;
}

function makeGenealogyMockDb() {
  let seq = 1;
  let tick = 1_700_000_000_000;
  const nextId = (prefix: string) => `${prefix}-${seq++}`;
  const nextDate = () => new Date((tick += 1000));

  const store: InMemoryStore = {
    clans: [],
    branches: [],
    profiles: [],
    links: [],
    roles: [],
    relationships: [],
    accountStatuses: new Map<string, AccountStatus>(),
  };

  let failOnRoleAssignmentCreate = false;

  const prisma: any = {
    clan: {
      count: jest.fn(async () => store.clans.length),
      create: jest.fn(async ({ data }: any) => {
        const row: Clan = {
          id: nextId('clan'),
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
      findMany: jest.fn(async ({ where }: any) =>
        store.branches.filter((b) => (!where?.clanId ? true : b.clanId === where.clanId)),
      ),
      create: jest.fn(async ({ data }: any) => {
        const row: Branch = {
          id: nextId('branch'),
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
          id: nextId('prof'),
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
      findMany: jest.fn(async ({ where }: any) => {
        return store.profiles.filter((p) => {
          if (where.id?.in && !where.id.in.includes(p.id)) return false;
          if (where.clanId && p.clanId !== where.clanId) return false;
          if (where.accountId?.in && (!p.accountId || !where.accountId.in.includes(p.accountId))) {
            return false;
          }
          return true;
        });
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => {
        const match = store.profiles.find((p) => p.id === where.id);
        if (!match) throw new Error('Profile not found');
        return { ...match };
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (let i = 0; i < store.profiles.length; i++) {
          const p = store.profiles[i];
          if (
            p.id === where.id &&
            (!where.clanId || p.clanId === where.clanId) &&
            (!where.status?.not || p.status !== where.status.not)
          ) {
            store.profiles[i] = { ...p, ...data, updatedAt: nextDate() };
            count++;
          }
        }
        return { count };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const idx = store.profiles.findIndex((p) => p.id === where.id);
        if (idx === -1) throw new Error('Profile not found');
        store.profiles[idx] = { ...store.profiles[idx], ...data, updatedAt: nextDate() };
        return { ...store.profiles[idx] };
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
        const row = { id: nextId('link'), ...data, linkedAt: nextDate() };
        store.links.push(row);
        return { ...row };
      }),
    },
    roleAssignment: {
      create: jest.fn(async ({ data }: any) => {
        if (failOnRoleAssignmentCreate) {
          throw new Error('Injected DB failure mid-transaction');
        }
        const row: RoleAssignment = {
          id: nextId('role'),
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
          if (where.branchId?.in && (!r.branchId || !where.branchId.in.includes(r.branchId)))
            return false;
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
            r.clanId === where.clanId &&
            r.branchId === where.branchId &&
            r.type === where.type &&
            (where.validTo === null ? r.validTo === null : true) &&
            (!where.accountId?.not || r.accountId !== where.accountId.not)
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
              return where.OR.some(
                (cond: any) => rel.fromId === cond.fromId && rel.toId === cond.toId,
              );
            }
            return rel.fromId === where.fromId && rel.toId === where.toId;
          }) ?? null
        );
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return store.relationships.filter((rel) => {
          const from = store.profiles.find((p) => p.id === rel.fromId);
          const to = store.profiles.find((p) => p.id === rel.toId);
          if (where?.active !== undefined && rel.active !== where.active) return false;
          if (where?.from?.clanId && from?.clanId !== where.from.clanId) return false;
          if (where?.to?.clanId && to?.clanId !== where.to.clanId) return false;
          if (where?.OR) {
            return where.OR.some((c: any) => rel.fromId === c.fromId || rel.toId === c.toId);
          }
          return true;
        });
      }),
      create: jest.fn(async ({ data }: any) => {
        const row: Relationship = {
          id: nextId('rel'),
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
    $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => {
      const snapshot: InMemoryStore = {
        clans: store.clans.map((x) => ({ ...x })),
        branches: store.branches.map((x) => ({ ...x })),
        profiles: store.profiles.map((x) => ({ ...x })),
        links: store.links.map((x) => ({ ...x })),
        roles: store.roles.map((x) => ({ ...x })),
        relationships: store.relationships.map((x) => ({ ...x })),
        accountStatuses: new Map(store.accountStatuses),
      };
      try {
        return await cb(prisma);
      } catch (err) {
        store.clans = snapshot.clans;
        store.branches = snapshot.branches;
        store.profiles = snapshot.profiles;
        store.links = snapshot.links;
        store.roles = snapshot.roles;
        store.relationships = snapshot.relationships;
        store.accountStatuses = snapshot.accountStatuses;
        throw err;
      }
    }),
  };

  return {
    prisma,
    getStore: () => store,
    setFailOnRoleCreate: (v: boolean) => {
      failOnRoleAssignmentCreate = v;
    },
  };
}

/**
 * Bộ kiểm tra tổ tiên trên đồ thị `store.relationships` mô phỏng `TreeRepository.isAncestor` (B3-01).
 */
function makeInMemoryAncestorChecker(getStore: () => InMemoryStore): TreeAncestorChecker {
  return {
    async isAncestor(ancestorId: string, descendantId: string): Promise<boolean> {
      const edges = getStore().relationships.filter((r) => r.type === RelationType.PARENT_CHILD);
      const parentsOf = new Map<string, string[]>();
      for (const e of edges) {
        const list = parentsOf.get(e.toId) ?? [];
        list.push(e.fromId);
        parentsOf.set(e.toId, list);
      }
      const visited = new Set<string>();
      const queue = [...(parentsOf.get(descendantId) ?? [])];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === ancestorId) return true;
        if (visited.has(current)) continue;
        visited.add(current);
        for (const p of parentsOf.get(current) ?? []) {
          queue.push(p);
        }
      }
      return false;
    },
  };
}

function unlinkedUser(id: string, isTechSupport = false): AuthUser {
  return {
    id,
    profileId: null,
    clanId: null,
    profileLinks: [],
    roles: isTechSupport ? [{ type: RoleType.TECH_SUPPORT, clanId: 'any', branchId: null }] : [],
  };
}

function memberUser(
  id: string,
  clanId: string,
  profileId: string,
  roles: AuthUser['roles'] = [],
): AuthUser {
  return {
    id,
    profileId,
    clanId,
    profileLinks: [{ clanId, profileId }],
    roles,
  };
}

function buildGenealogyFacade(
  prisma: PrismaService,
  policy: PolicyService,
  audit: AuditService,
  profileService: ProfileService,
  ancestorChecker: TreeAncestorChecker,
): GenealogyService {
  return new GenealogyService(
    new ClanService(prisma, policy, audit, profileService),
    new BranchService(prisma, policy, audit),
    new RelationshipService(prisma, policy, audit, ancestorChecker),
  );
}

describe('GenealogyService (B2-01, B2-02, B2-04)', () => {
  let db: ReturnType<typeof makeGenealogyMockDb>;
  let service: GenealogyService;
  let profileService: ProfileService;
  let auditMock: { log: jest.Mock };

  beforeEach(() => {
    db = makeGenealogyMockDb();
    auditMock = { log: jest.fn().mockResolvedValue(undefined) };
    const policy = new PolicyService();
    profileService = new ProfileService(
      db.prisma as unknown as PrismaService,
      policy,
      auditMock as unknown as AuditService,
    );
    const ancestorChecker = makeInMemoryAncestorChecker(db.getStore);
    service = buildGenealogyFacade(
      db.prisma as unknown as PrismaService,
      policy,
      auditMock as unknown as AuditService,
      profileService,
      ancestorChecker,
    );
  });

  describe('B2-01: Khởi tạo dòng họ (POST /clans - UC-07)', () => {
    it('tạo Clan, hồ sơ tổ tiên, hồ sơ người tạo, RoleAssignment CLAN_HEAD và audit trong một transaction; gọi lần hai báo lỗi', async () => {
      const creatorAccount = unlinkedUser('acc-founder');
      const result = await service.createClan(creatorAccount, {
        name: 'Dòng họ Nguyễn Văn',
        clanCode: 'CLAN-NV-01',
        ancestor: {
          fullName: 'Nguyễn Văn Tổ',
          gender: Gender.MALE,
          status: MemberStatus.DECEASED,
        },
        creator: {
          fullName: 'Nguyễn Văn An',
          gender: Gender.MALE,
          generation: 3,
        },
      });

      expect(result.clan.clanCode).toBe('CLAN-NV-01');
      expect(result.ancestorProfile.generation).toBe(1);
      expect(result.ancestorProfile.accountId).toBeNull();
      expect(result.creatorProfile.accountId).toBe('acc-founder');
      expect(result.role).toBe(RoleType.CLAN_HEAD);

      const state = db.getStore();
      expect(state.clans).toHaveLength(1);
      expect(state.profiles).toHaveLength(2);
      expect(state.links).toHaveLength(1);
      expect(state.roles).toHaveLength(1);
      expect(state.roles[0].type).toBe(RoleType.CLAN_HEAD);
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INIT_CLAN',
          entityType: 'CLAN',
          entityId: result.clan.id,
        }),
      );

      // Gọi lần hai bởi cùng tài khoản hoặc tài khoản trống khác đều thất bại
      await expect(
        service.createClan(unlinkedUser('acc-second'), {
          name: 'Dòng họ Thứ Hai',
          ancestor: { fullName: 'Tổ 2', gender: Gender.MALE },
          creator: { fullName: 'Người 2', gender: Gender.MALE },
        }),
      ).rejects.toThrow(ConflictException);

      const clanHeadAsAuth = memberUser('acc-founder', result.clan.id, result.creatorProfile.id, [
        { type: RoleType.CLAN_HEAD, clanId: result.clan.id, branchId: null },
      ]);
      await expect(
        service.createClan(clanHeadAsAuth, {
          name: 'Dòng họ Lần Hai',
          ancestor: { fullName: 'Tổ 2', gender: Gender.MALE },
          creator: { fullName: 'Người 2', gender: Gender.MALE },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('hoàn tác toàn bộ transaction nếu phát sinh lỗi giữa chừng', async () => {
      db.setFailOnRoleCreate(true);

      await expect(
        service.createClan(unlinkedUser('acc-rollback'), {
          name: 'Dòng họ Lỗi Giữa Chừng',
          ancestor: { fullName: 'Cụ Tổ', gender: Gender.MALE },
          creator: { fullName: 'Người Tạo', gender: Gender.MALE },
        }),
      ).rejects.toThrow('Injected DB failure mid-transaction');

      const state = db.getStore();
      expect(state.clans).toHaveLength(0);
      expect(state.profiles).toHaveLength(0);
      expect(state.links).toHaveLength(0);
      expect(state.roles).toHaveLength(0);
    });

    it('từ chối tài khoản TECH_SUPPORT khởi tạo dòng họ', async () => {
      await expect(
        service.createClan(unlinkedUser('acc-tech', true), {
          name: 'Họ Test',
          ancestor: { fullName: 'Tổ', gender: Gender.MALE },
          creator: { fullName: 'KTV', gender: Gender.MALE },
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('B2-02: Quản lý chi (GET/POST/PATCH /branches - UC-08)', () => {
    it('chỉ CLAN_HEAD tạo/sửa chi; BRANCH_HEAD không tạo/sửa được chi kể cả chi mình hay chi khác', async () => {
      const init = await service.createClan(unlinkedUser('acc-head'), {
        name: 'Dòng họ Trần',
        ancestor: { fullName: 'Trần Thủy Tổ', gender: Gender.MALE },
        creator: { fullName: 'Trần Trưởng Họ', gender: Gender.MALE },
      });

      const clanId = init.clan.id;
      const clanHead = memberUser('acc-head', clanId, init.creatorProfile.id, [
        { type: RoleType.CLAN_HEAD, clanId, branchId: null },
      ]);

      // Tạo Chi 1 và Chi 2 (chi chưa có Trưởng chi vẫn tạo được)
      const chi1 = await service.createBranch(clanHead, { name: 'Chi Trưởng' });
      const chi2 = await service.createBranch(clanHead, { name: 'Chi Thứ' });
      expect(chi1.branchHead).toBeNull();
      expect(chi2.branchHead).toBeNull();

      // Trùng tên chi -> 409
      await expect(service.createBranch(clanHead, { name: 'chi trưởng' })).rejects.toThrow(
        ConflictException,
      );

      // Tạo hồ sơ đã liên kết tài khoản ở Chi 1 để bổ nhiệm làm Trưởng chi 1
      const b1Profile = await profileService.createProfile(clanHead, {
        branchId: chi1.id,
        fullName: 'Trần Văn Bình',
        gender: Gender.MALE,
        generation: 3,
      });
      const storedB1 = db.getStore().profiles.find((p) => p.id === b1Profile.id)!;
      storedB1.accountId = 'acc-branch-head-1';
      db.getStore().links.push({
        id: 'link-b1',
        accountId: 'acc-branch-head-1',
        clanId,
        profileId: b1Profile.id,
        linkedAt: new Date(),
      });

      // Ghi trước quan hệ để kiểm chứng BR-04 không thay đổi quan hệ huyết thống khi gán/bỏ Trưởng chi
      await service.createRelationship(clanHead, {
        type: RelationType.PARENT_CHILD,
        fromId: init.ancestorProfile.id,
        toId: b1Profile.id,
      });
      const relCountBefore = db.getStore().relationships.length;

      // CLAN_HEAD gán Trưởng chi 1
      const updatedChi1 = await service.updateBranch(clanHead, chi1.id, {
        branchHeadProfileId: b1Profile.id,
      });
      expect(updatedChi1.branchHead).toEqual({
        accountId: 'acc-branch-head-1',
        profileId: b1Profile.id,
        fullName: 'Trần Văn Bình',
      });

      // Đóng vai Trưởng chi 1 -> bị chặn 403 khi tạo chi mới hoặc sửa Chi 2 hay Chi 1
      const branchHead1 = memberUser('acc-branch-head-1', clanId, b1Profile.id, [
        { type: RoleType.BRANCH_HEAD, clanId, branchId: chi1.id },
      ]);
      await expect(service.createBranch(branchHead1, { name: 'Chi Lậu' })).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        service.updateBranch(branchHead1, chi2.id, { name: 'Sửa Chi Thứ' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.updateBranch(branchHead1, chi1.id, { name: 'Tự Đổi Tên' }),
      ).rejects.toThrow(ForbiddenException);

      // Trưởng chi xem được danh sách các chi qua GET /branches
      const listResult = await service.listBranches(branchHead1, { limit: 20 });
      expect(listResult.items).toHaveLength(2);

      // CLAN_HEAD bỏ trống Trưởng chi (null) và đổi tên chi -> quan hệ huyết thống vẫn nguyên vẹn (BR-04)
      const clearedChi1 = await service.updateBranch(clanHead, chi1.id, {
        name: 'Chi Cả',
        branchHeadProfileId: null,
      });
      expect(clearedChi1.name).toBe('Chi Cả');
      expect(clearedChi1.branchHead).toBeNull();
      expect(db.getStore().relationships).toHaveLength(relCountBefore);
    });

    it('gắn branchId khi bổ nhiệm hồ sơ chưa thuộc chi, chặn tài khoản LOCKED và không đếm hồ sơ REMOVED vào memberCount', async () => {
      const init = await service.createClan(unlinkedUser('acc-b2-edge'), {
        name: 'Dòng họ Vũ',
        ancestor: { fullName: 'Vũ Tổ', gender: Gender.MALE },
        creator: { fullName: 'Vũ Trưởng Họ', gender: Gender.MALE },
      });
      const clanId = init.clan.id;
      const clanHead = memberUser('acc-b2-edge', clanId, init.creatorProfile.id, [
        { type: RoleType.CLAN_HEAD, clanId, branchId: null },
      ]);

      const chi = await service.createBranch(clanHead, { name: 'Chi Mới' });

      // Hồ sơ liên kết tài khoản LOCKED -> bị chặn BadRequestException
      const pLocked = await profileService.createProfile(clanHead, {
        branchId: chi.id,
        fullName: 'Vũ Bị Khóa',
        gender: Gender.MALE,
      });
      db.getStore().profiles.find((p) => p.id === pLocked.id)!.accountId = 'acc-locked';
      db.getStore().links.push({
        id: 'link-locked',
        accountId: 'acc-locked',
        clanId,
        profileId: pLocked.id,
        linkedAt: new Date(),
      });
      db.getStore().accountStatuses.set('acc-locked', AccountStatus.LOCKED);

      await expect(
        service.updateBranch(clanHead, chi.id, { branchHeadProfileId: pLocked.id }),
      ).rejects.toThrow(BadRequestException);

      // Xóa mềm pLocked -> memberCount không đếm hồ sơ REMOVED
      await profileService.softDeleteProfile(clanHead, pLocked.id);

      // Hồ sơ branchId = null, tài khoản ACTIVE -> tự gắn branchId khi làm Trưởng chi
      const pUnbranched = await profileService.createProfile(clanHead, {
        fullName: 'Vũ Chưa Có Chi',
        gender: Gender.MALE,
      });
      expect(pUnbranched.branchId).toBeNull();
      db.getStore().profiles.find((p) => p.id === pUnbranched.id)!.accountId = 'acc-bh-active';
      db.getStore().links.push({
        id: 'link-bh-active',
        accountId: 'acc-bh-active',
        clanId,
        profileId: pUnbranched.id,
        linkedAt: new Date(),
      });

      const assigned = await service.updateBranch(clanHead, chi.id, {
        branchHeadProfileId: pUnbranched.id,
      });
      expect(assigned.branchHead?.profileId).toBe(pUnbranched.id);
      expect(assigned.memberCount).toBe(1);
      expect(db.getStore().profiles.find((p) => p.id === pUnbranched.id)!.branchId).toBe(chi.id);

      // Không thể bổ nhiệm cùng tài khoản đang làm Trưởng chi ở chi khác (cũng như khi chuyển chi khác)
      const chiKhac = await service.createBranch(clanHead, { name: 'Chi Khác' });
      // Giả lập pUnbranched chưa gắn chi (hoặc trường hợp kiểm tra role BRANCH_HEAD chi khác) -> vẫn bị chặn bởi headElsewhere
      db.getStore().profiles.find((p) => p.id === pUnbranched.id)!.branchId = null;
      await expect(
        service.updateBranch(clanHead, chiKhac.id, { branchHeadProfileId: pUnbranched.id }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('B2-04: Quan hệ phả hệ (POST /relationships - UC-10)', () => {
    it('chặn tự tham chiếu, trùng lặp (cả SPOUSE hai chiều), và chặn vòng tổ tiên 3 đời A -> B -> C -> A', async () => {
      const init = await service.createClan(unlinkedUser('acc-rel-head'), {
        name: 'Dòng họ Lê',
        ancestor: { fullName: 'Lê Tổ (A)', gender: Gender.MALE },
        creator: { fullName: 'Lê Trưởng Họ', gender: Gender.MALE },
      });
      const clanId = init.clan.id;
      const clanHead = memberUser('acc-rel-head', clanId, init.creatorProfile.id, [
        { type: RoleType.CLAN_HEAD, clanId, branchId: null },
      ]);

      const chi = await service.createBranch(clanHead, { name: 'Chi Một' });
      const nodeA = init.ancestorProfile;
      const nodeB = await profileService.createProfile(clanHead, {
        branchId: chi.id,
        fullName: 'Lê Đời Hai (B)',
        gender: Gender.MALE,
        generation: 2,
      });
      const nodeC = await profileService.createProfile(clanHead, {
        branchId: chi.id,
        fullName: 'Lê Đời Ba (C)',
        gender: Gender.MALE,
        generation: 3,
      });
      const spouseB = await profileService.createProfile(clanHead, {
        branchId: chi.id,
        fullName: 'Vợ Ông B',
        gender: Gender.FEMALE,
        generation: 2,
      });

      // 1. Tự tham chiếu bị chặn
      await expect(
        service.createRelationship(clanHead, {
          type: RelationType.PARENT_CHILD,
          fromId: nodeB.id,
          toId: nodeB.id,
        }),
      ).rejects.toThrow(BadRequestException);

      // 2. Tạo chuỗi 3 đời: A -> B -> C
      await service.createRelationship(clanHead, {
        type: RelationType.PARENT_CHILD,
        fromId: nodeA.id,
        toId: nodeB.id,
      });
      await service.createRelationship(clanHead, {
        type: RelationType.PARENT_CHILD,
        fromId: nodeB.id,
        toId: nodeC.id,
      });

      // 3. Thử nối vòng 3 đời C -> A -> bị chặn BadRequestException (cháu không thể làm cha ông)
      await expect(
        service.createRelationship(clanHead, {
          type: RelationType.PARENT_CHILD,
          fromId: nodeC.id,
          toId: nodeA.id,
        }),
      ).rejects.toThrow(BadRequestException);

      // 4. Vòng trực tiếp 2 đời B -> A cũng bị chặn (ngay cả với StubTreeAncestorChecker trả false)
      await expect(
        service.createRelationship(clanHead, {
          type: RelationType.PARENT_CHILD,
          fromId: nodeB.id,
          toId: nodeA.id,
        }),
      ).rejects.toThrow(BadRequestException);

      // 5. Quan hệ PARENT_CHILD trùng lặp -> 409 ConflictException
      await expect(
        service.createRelationship(clanHead, {
          type: RelationType.PARENT_CHILD,
          fromId: nodeA.id,
          toId: nodeB.id,
        }),
      ).rejects.toThrow(ConflictException);

      // 6. Quan hệ SPOUSE trùng cả hai chiều (B, spouseB) và (spouseB, B) -> 409
      await service.createRelationship(clanHead, {
        type: RelationType.SPOUSE,
        fromId: nodeB.id,
        toId: spouseB.id,
      });
      await expect(
        service.createRelationship(clanHead, {
          type: RelationType.SPOUSE,
          fromId: nodeB.id,
          toId: spouseB.id,
        }),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.createRelationship(clanHead, {
          type: RelationType.SPOUSE,
          fromId: spouseB.id,
          toId: nodeB.id,
        }),
      ).rejects.toThrow(ConflictException);

      // 7. Chặn quan hệ mâu thuẫn: cha/mẹ - con hoặc tổ tiên - hậu duệ không thể thành vợ/chồng; vợ/chồng không thể thành cha - con
      await expect(
        service.createRelationship(clanHead, {
          type: RelationType.SPOUSE,
          fromId: nodeA.id,
          toId: nodeB.id,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createRelationship(clanHead, {
          type: RelationType.SPOUSE,
          fromId: nodeA.id,
          toId: nodeC.id,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createRelationship(clanHead, {
          type: RelationType.PARENT_CHILD,
          fromId: nodeB.id,
          toId: spouseB.id,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('chặn quan hệ khác dòng họ, hồ sơ REMOVED, và kiểm phạm vi chi với BRANCH_HEAD', async () => {
      const init = await service.createClan(unlinkedUser('acc-rel-2'), {
        name: 'Dòng họ Phạm',
        ancestor: { fullName: 'Phạm Tổ', gender: Gender.MALE },
        creator: { fullName: 'Phạm Trưởng Họ', gender: Gender.MALE },
      });
      const clanId = init.clan.id;
      const clanHead = memberUser('acc-rel-2', clanId, init.creatorProfile.id, [
        { type: RoleType.CLAN_HEAD, clanId, branchId: null },
      ]);

      const chi1 = await service.createBranch(clanHead, { name: 'Chi 1' });
      const chi2 = await service.createBranch(clanHead, { name: 'Chi 2' });
      const p1 = await profileService.createProfile(clanHead, {
        branchId: chi1.id,
        fullName: 'Người Chi 1',
        gender: Gender.MALE,
      });
      const p2 = await profileService.createProfile(clanHead, {
        branchId: chi2.id,
        fullName: 'Người Chi 2',
        gender: Gender.FEMALE,
      });

      const branchHead1 = memberUser('acc-bh-1', clanId, p1.id, [
        { type: RoleType.BRANCH_HEAD, clanId, branchId: chi1.id },
      ]);

      // BRANCH_HEAD chi 1 không được nối người sang chi 2 -> 403
      await expect(
        service.createRelationship(branchHead1, {
          type: RelationType.SPOUSE,
          fromId: p1.id,
          toId: p2.id,
        }),
      ).rejects.toThrow(ForbiddenException);

      // Hồ sơ khác dòng họ -> 400
      db.getStore().profiles.push({
        id: 'prof-foreign',
        clanId: 'foreign-clan',
        branchId: null,
        accountId: null,
        fullName: 'Người Ngoại Tộc',
        gender: Gender.MALE,
        bio: null,
        birthDate: null,
        deathDate: null,
        deathCalendar: null,
        status: MemberStatus.ALIVE,
        generation: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await expect(
        service.createRelationship(clanHead, {
          type: RelationType.PARENT_CHILD,
          fromId: p1.id,
          toId: 'prof-foreign',
        }),
      ).rejects.toThrow(BadRequestException);

      // Hồ sơ đã xóa mềm -> 400
      await profileService.softDeleteProfile(clanHead, p2.id);
      await expect(
        service.createRelationship(clanHead, {
          type: RelationType.SPOUSE,
          fromId: p1.id,
          toId: p2.id,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('StubTreeAncestorChecker trả false tạm thời và DB trigger vòng tổ tiên được map sang BadRequestException', async () => {
      const stub = new StubTreeAncestorChecker();
      expect(await stub.isAncestor('a', 'b')).toBe(false);

      const serviceWithStub = buildGenealogyFacade(
        db.prisma as unknown as PrismaService,
        new PolicyService(),
        auditMock as unknown as AuditService,
        profileService,
        stub,
      );
      const init = await serviceWithStub.createClan(unlinkedUser('acc-stub'), {
        name: 'Dòng họ Hoàng',
        ancestor: { fullName: 'Hoàng Tổ', gender: Gender.MALE },
        creator: { fullName: 'Hoàng Con', gender: Gender.MALE },
      });
      const head = memberUser('acc-stub', init.clan.id, init.creatorProfile.id, [
        { type: RoleType.CLAN_HEAD, clanId: init.clan.id, branchId: null },
      ]);

      // Giả lập trigger trg_relationship_no_cycle (P0001) từ PostgreSQL ném lỗi vòng tổ tiên
      db.prisma.relationship.create.mockRejectedValueOnce(
        new Error('Quan hệ tạo vòng tổ tiên (P0001)'),
      );
      await expect(
        serviceWithStub.createRelationship(head, {
          type: RelationType.PARENT_CHILD,
          fromId: init.creatorProfile.id,
          toId: init.ancestorProfile.id,
        }),
      ).rejects.toThrow(BadRequestException);

      db.prisma.relationship.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Raw trigger exception', {
          code: 'P2010',
          clientVersion: '6.0.0',
          meta: { code: 'P0001' },
        }),
      );
      await expect(
        serviceWithStub.createRelationship(head, {
          type: RelationType.PARENT_CHILD,
          fromId: init.creatorProfile.id,
          toId: init.ancestorProfile.id,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('tự suy ra generation còn trống cho con/vợ chồng, giữ nguyên generation có sẵn và chỉ trả quan hệ active', async () => {
      const init = await service.createClan(unlinkedUser('acc-gen-sync'), {
        name: 'Dòng họ Bùi',
        ancestor: { fullName: 'Bùi Tổ', gender: Gender.MALE },
        creator: { fullName: 'Bùi Trưởng Họ', gender: Gender.MALE, generation: 2 },
      });
      const clanId = init.clan.id;
      const clanHead = memberUser('acc-gen-sync', clanId, init.creatorProfile.id, [
        { type: RoleType.CLAN_HEAD, clanId, branchId: null },
      ]);
      const chi = await service.createBranch(clanHead, { name: 'Chi Một' });

      const parent = await profileService.createProfile(clanHead, {
        branchId: chi.id,
        fullName: 'Bùi Cha',
        gender: Gender.MALE,
        generation: 2,
      });
      const childNull = await profileService.createProfile(clanHead, {
        branchId: chi.id,
        fullName: 'Bùi Con Trống Đời',
        gender: Gender.MALE,
      });
      const childExplicit = await profileService.createProfile(clanHead, {
        branchId: chi.id,
        fullName: 'Bùi Con Sẵn Đời',
        gender: Gender.MALE,
        generation: 5,
      });
      const spouseNull = await profileService.createProfile(clanHead, {
        branchId: chi.id,
        fullName: 'Vợ Ông Cha',
        gender: Gender.FEMALE,
      });

      await service.createRelationship(clanHead, {
        type: RelationType.PARENT_CHILD,
        fromId: parent.id,
        toId: childNull.id,
      });
      await service.createRelationship(clanHead, {
        type: RelationType.PARENT_CHILD,
        fromId: parent.id,
        toId: childExplicit.id,
      });
      await service.createRelationship(clanHead, {
        type: RelationType.SPOUSE,
        fromId: parent.id,
        toId: spouseNull.id,
      });

      const profiles = db.getStore().profiles;
      expect(profiles.find((p) => p.id === childNull.id)!.generation).toBe(3);
      expect(profiles.find((p) => p.id === childExplicit.id)!.generation).toBe(5);
      expect(profiles.find((p) => p.id === spouseNull.id)!.generation).toBe(2);

      db.getStore().relationships.push({
        id: 'rel-inactive',
        type: RelationType.SPOUSE,
        fromId: parent.id,
        toId: childExplicit.id,
        startDate: null,
        active: false,
      });
      const activeList = await service.listRelationships(clanHead, {});
      expect(activeList).toHaveLength(3);
      expect(activeList.some((r) => r.id === 'rel-inactive')).toBe(false);
    });
  });

  describe('DTO ValidationPipe kiểm tra hợp đồng API', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    it('chấp nhận DTO hợp lệ (kể cả branchHeadProfileId = null), trim khoảng trắng và từ chối trường lạ / chuỗi toàn khoảng trắng', async () => {
      const validClan = await pipe.transform(
        {
          name: 'Dòng họ Đặng',
          ancestor: { fullName: 'Đặng Cụ Tổ', gender: Gender.MALE },
          creator: { fullName: 'Đặng Đăng Khoa', gender: Gender.MALE, generation: 4 },
        },
        { type: 'body', metatype: CreateClanDto },
      );
      expect(validClan).toBeInstanceOf(CreateClanDto);

      const trimmedBranch = await pipe.transform(
        { name: '  Chi Mới  ' },
        { type: 'body', metatype: CreateBranchDto },
      );
      expect(trimmedBranch.name).toBe('Chi Mới');

      await expect(
        pipe.transform({ name: '   ' }, { type: 'body', metatype: CreateBranchDto }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        pipe.transform(
          { fullName: '   ', gender: Gender.MALE },
          { type: 'body', metatype: CreateProfileDto },
        ),
      ).rejects.toThrow(BadRequestException);

      const validSoftDeleteQuery = await pipe.transform(
        { expectedUpdatedAt: '2026-01-01T00:00:00.000Z' },
        { type: 'query', metatype: SoftDeleteProfileQueryDto },
      );
      expect(validSoftDeleteQuery.expectedUpdatedAt).toBe('2026-01-01T00:00:00.000Z');

      await expect(
        pipe.transform(
          { expectedUpdatedAt: 'not-a-date' },
          { type: 'query', metatype: SoftDeleteProfileQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        pipe.transform(
          { extraField: 'nope' },
          { type: 'query', metatype: SoftDeleteProfileQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);

      const validClearHead = await pipe.transform(
        { branchHeadProfileId: null },
        { type: 'body', metatype: UpdateBranchDto },
      );
      expect(validClearHead.branchHeadProfileId).toBeNull();

      await expect(
        pipe.transform(
          { type: 'INVALID', fromId: 'not-uuid', toId: 'not-uuid' },
          { type: 'body', metatype: CreateRelationshipDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
