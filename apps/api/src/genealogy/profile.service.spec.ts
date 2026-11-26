import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Gender, MemberProfile, MemberStatus, RoleType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.guard';
import { PolicyService } from '../auth/policy.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from './profile.service';

const CLAN_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_CLAN_ID = '99999999-9999-4999-8999-999999999999';
const BRANCH_1_ID = '22222222-2222-4222-8222-222222222221';
const BRANCH_2_ID = '22222222-2222-4222-8222-222222222222';

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'acc-1',
    profileId: 'prof-actor',
    clanId: CLAN_ID,
    profileLinks: [{ clanId: CLAN_ID, profileId: 'prof-actor' }],
    roles: [{ type: RoleType.CLAN_HEAD, clanId: CLAN_ID, branchId: null }],
    ...overrides,
  };
}

function makeStatefulPrismaMock() {
  const branches = new Map<string, { id: string; clanId: string; name: string }>([
    [BRANCH_1_ID, { id: BRANCH_1_ID, clanId: CLAN_ID, name: 'Chi Trưởng' }],
    [BRANCH_2_ID, { id: BRANCH_2_ID, clanId: CLAN_ID, name: 'Chi Thứ' }],
  ]);

  const profiles = new Map<string, MemberProfile>();
  const roleAssignments: Array<{
    id: string;
    accountId: string;
    type: RoleType;
    clanId: string;
    branchId: string | null;
    validFrom: Date;
    validTo: Date | null;
  }> = [];

  let seq = 1;
  let tick = 1_700_000_000_000;
  const nextTime = () => new Date((tick += 1000));

  const createTxClient = () => {
    const client: any = {
      branch: {
        findUnique: jest.fn(
          async ({ where }: { where: { id: string } }) => branches.get(where.id) ?? null,
        ),
      },
      memberProfile: {
        create: jest.fn(async ({ data }: { data: any }) => {
          const now = nextTime();
          const row: MemberProfile = {
            id: `prof-${seq++}`,
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
          profiles.set(row.id, row);
          return { ...row };
        }),
        findUnique: jest.fn(async ({ where }: { where: { id?: string; accountId?: string } }) => {
          if (where.id) {
            const p = profiles.get(where.id);
            return p ? { ...p } : null;
          }
          if (where.accountId) {
            for (const p of profiles.values()) {
              if (p.accountId === where.accountId) return { ...p };
            }
          }
          return null;
        }),
        findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => {
          const p = profiles.get(where.id);
          if (!p) throw new Error('Not found');
          return { ...p };
        }),
        findMany: jest.fn(async ({ where, take }: { where: any; take?: number }) => {
          let list = Array.from(profiles.values()).filter((p) => {
            if (where.clanId && p.clanId !== where.clanId) return false;
            if (where.branchId !== undefined && p.branchId !== where.branchId) return false;
            if (where.generation !== undefined && p.generation !== where.generation) return false;
            if (where.status !== undefined && p.status !== where.status) return false;
            if (where.fullName?.contains) {
              if (
                !p.fullName.toLowerCase().includes(String(where.fullName.contains).toLowerCase())
              ) {
                return false;
              }
            }
            return true;
          });
          if (take) list = list.slice(0, take);
          return list.map((p) => ({ ...p }));
        }),
        updateMany: jest.fn(async ({ where, data }: { where: any; data: any }) => {
          const current = profiles.get(where.id);
          if (!current) return { count: 0 };
          if (where.clanId && current.clanId !== where.clanId) return { count: 0 };
          if (where.status?.not && current.status === where.status.not) return { count: 0 };
          if (
            where.updatedAt &&
            current.updatedAt.getTime() !== new Date(where.updatedAt).getTime()
          ) {
            return { count: 0 };
          }
          const updated: MemberProfile = {
            ...current,
            ...data,
            updatedAt: nextTime(),
          };
          profiles.set(where.id, updated);
          return { count: 1 };
        }),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      roleAssignment: {
        findFirst: jest.fn(async ({ where }: { where: any }) => {
          return (
            roleAssignments.find(
              (r) =>
                r.clanId === where.clanId &&
                r.accountId === where.accountId &&
                r.type === where.type &&
                (where.validTo === null ? r.validTo === null : true),
            ) ?? null
          );
        }),
        updateMany: jest.fn(async ({ where, data }: { where: any; data: any }) => {
          let count = 0;
          for (const r of roleAssignments) {
            if (
              (!where.clanId || r.clanId === where.clanId) &&
              (!where.accountId || r.accountId === where.accountId) &&
              (!where.type || r.type === where.type) &&
              (!where.branchId || r.branchId === where.branchId) &&
              (where.validTo === null ? r.validTo === null : true)
            ) {
              Object.assign(r, data);
              count++;
            }
          }
          return { count };
        }),
      },
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => {
        // Snapshot map để mô phỏng rollback khi callback ném lỗi
        const backup = new Map(Array.from(profiles.entries()).map(([k, v]) => [k, { ...v }]));
        try {
          return await cb(client);
        } catch (err) {
          profiles.clear();
          for (const [k, v] of backup.entries()) {
            profiles.set(k, v);
          }
          throw err;
        }
      }),
    };
    return client;
  };

  const prisma = createTxClient();
  return { prisma, profiles, roleAssignments };
}

describe('ProfileService (B2-03 & B2-05)', () => {
  let service: ProfileService;
  let prisma: ReturnType<typeof makeStatefulPrismaMock>['prisma'];
  let profiles: Map<string, MemberProfile>;
  let roleAssignments: ReturnType<typeof makeStatefulPrismaMock>['roleAssignments'];
  let auditMock: { log: jest.Mock };

  beforeEach(() => {
    const state = makeStatefulPrismaMock();
    prisma = state.prisma;
    profiles = state.profiles;
    roleAssignments = state.roleAssignments;
    auditMock = { log: jest.fn().mockResolvedValue(undefined) };

    service = new ProfileService(
      prisma as unknown as PrismaService,
      new PolicyService(),
      auditMock as unknown as AuditService,
    );
  });

  it('cho phép CLAN_HEAD tạo hồ sơ và ghi audit CREATE_PROFILE', async () => {
    const clanHead = makeUser();

    const created = await service.createProfile(clanHead, {
      branchId: BRANCH_1_ID,
      fullName: 'Nguyễn Minh Quân',
      gender: Gender.MALE,
      generation: 4,
      birthDate: '2000-01-10',
    });

    expect(created.clanId).toBe(CLAN_ID);
    expect(created.branchId).toBe(BRANCH_1_ID);
    expect(created.status).toBe(MemberStatus.ALIVE);
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: clanHead.id,
        action: 'CREATE_PROFILE',
        entityType: 'MEMBER_PROFILE',
        entityId: created.id,
        before: null,
        after: expect.objectContaining({ fullName: 'Nguyễn Minh Quân' }),
      }),
    );
  });

  it('kiểm soát phạm vi chi: BRANCH_HEAD chỉ tạo/sửa được chi mình, không được đụng chi khác hay đổi sang chi khác', async () => {
    const clanHead = makeUser();
    const branch1Head = makeUser({
      id: 'acc-b1',
      roles: [{ type: RoleType.BRANCH_HEAD, clanId: CLAN_ID, branchId: BRANCH_1_ID }],
    });
    const plainMember = makeUser({
      id: 'acc-mem',
      roles: [],
    });

    // Thường dân bị từ chối
    await expect(
      service.createProfile(plainMember, {
        branchId: BRANCH_1_ID,
        fullName: 'Người A',
        gender: Gender.MALE,
      }),
    ).rejects.toThrow(ForbiddenException);

    // BRANCH_HEAD chi 1 tạo ở chi 2 -> 403
    await expect(
      service.createProfile(branch1Head, {
        branchId: BRANCH_2_ID,
        fullName: 'Người chi 2',
        gender: Gender.FEMALE,
      }),
    ).rejects.toThrow(ForbiddenException);

    // BRANCH_HEAD chi 1 tạo ở chi 1 -> OK
    const p1 = await service.createProfile(branch1Head, {
      branchId: BRANCH_1_ID,
      fullName: 'Người chi 1',
      gender: Gender.MALE,
    });
    expect(p1.branchId).toBe(BRANCH_1_ID);

    // Tạo hồ sơ thuộc chi 2 bởi CLAN_HEAD
    const p2 = await service.createProfile(clanHead, {
      branchId: BRANCH_2_ID,
      fullName: 'Người ở chi 2',
      gender: Gender.FEMALE,
    });

    // BRANCH_HEAD chi 1 sửa hồ sơ ở chi 2 -> 403
    await expect(
      service.updateProfile(branch1Head, p2.id, {
        expectedUpdatedAt: p2.updatedAt.toISOString(),
        fullName: 'Sửa trái phép',
      }),
    ).rejects.toThrow(ForbiddenException);

    // BRANCH_HEAD chi 1 cố tình chuyển hồ sơ chi 1 sang chi 2 -> 403
    await expect(
      service.updateProfile(branch1Head, p1.id, {
        expectedUpdatedAt: p1.updatedAt.toISOString(),
        branchId: BRANCH_2_ID,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('khóa lạc quan: hai phiên cùng đọc một updatedAt, người lưu sau bị báo 409 Conflict và không ghi đè', async () => {
    const clanHead = makeUser();
    const initial = await service.createProfile(clanHead, {
      branchId: BRANCH_1_ID,
      fullName: 'Nguyễn Văn Ban Đầu',
      gender: Gender.MALE,
      generation: 3,
    });

    const staleTimestamp = initial.updatedAt.toISOString();

    // Người dùng A sửa trước thành công -> updatedAt tăng lên
    const updatedByA = await service.updateProfile(clanHead, initial.id, {
      expectedUpdatedAt: staleTimestamp,
      fullName: 'Nguyễn Văn Đã Sửa Bởi A',
    });
    expect(updatedByA.fullName).toBe('Nguyễn Văn Đã Sửa Bởi A');
    expect(updatedByA.updatedAt.getTime()).toBeGreaterThan(initial.updatedAt.getTime());

    auditMock.log.mockClear();

    // Người dùng B gửi lên với timestamp cũ -> 409 ConflictException
    await expect(
      service.updateProfile(clanHead, initial.id, {
        expectedUpdatedAt: staleTimestamp,
        fullName: 'Nguyễn Văn Ghi Đè B',
      }),
    ).rejects.toThrow(ConflictException);

    // Dữ liệu giữ nguyên bản của A và không ghi audit sai
    const stored = await service.getProfileById(clanHead, initial.id);
    expect(stored.fullName).toBe('Nguyễn Văn Đã Sửa Bởi A');
    expect(auditMock.log).not.toHaveBeenCalled();

    // Audit của A có đủ before và after
    const updatedByC = await service.updateProfile(clanHead, initial.id, {
      expectedUpdatedAt: stored.updatedAt.toISOString(),
      bio: 'Cập nhật tiểu sử mới',
    });
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_PROFILE',
        entityId: initial.id,
        before: expect.objectContaining({ fullName: 'Nguyễn Văn Đã Sửa Bởi A', bio: null }),
        after: expect.objectContaining({ bio: 'Cập nhật tiểu sử mới' }),
      }),
    );
    expect(updatedByC.bio).toBe('Cập nhật tiểu sử mới');
  });

  it('xóa mềm chuyển status = REMOVED, giữ nguyên bản ghi trên cây và chặn xóa cứng hay sửa lại hồ sơ đã xóa', async () => {
    const clanHead = makeUser();
    const created = await service.createProfile(clanHead, {
      branchId: BRANCH_1_ID,
      fullName: 'Nguyễn Văn Cần Xóa Mềm',
      gender: Gender.MALE,
    });

    const removed = await service.softDeleteProfile(clanHead, created.id);
    expect(removed.status).toBe(MemberStatus.REMOVED);
    expect(profiles.has(created.id)).toBe(true);
    expect(prisma.memberProfile.delete).not.toHaveBeenCalled();
    expect(prisma.memberProfile.deleteMany).not.toHaveBeenCalled();

    expect(auditMock.log).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'SOFT_DELETE_PROFILE',
        entityId: created.id,
        before: expect.objectContaining({ status: MemberStatus.ALIVE }),
        after: expect.objectContaining({ status: MemberStatus.REMOVED }),
      }),
    );

    // Không cho sửa hồ sơ đã REMOVED
    await expect(
      service.updateProfile(clanHead, created.id, {
        expectedUpdatedAt: removed.updatedAt.toISOString(),
        fullName: 'Tên mới',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('chặn xóa mềm hồ sơ Trưởng họ đang đương nhiệm và không cho xem hồ sơ dòng họ khác', async () => {
    const clanHead = makeUser();
    const headProfile = await service.createProfile(clanHead, {
      branchId: BRANCH_1_ID,
      fullName: 'Trưởng họ Đương Nhiệm',
      gender: Gender.MALE,
    });
    const stored = profiles.get(headProfile.id)!;
    profiles.set(headProfile.id, { ...stored, accountId: clanHead.id });
    roleAssignments.push({
      id: 'role-1',
      accountId: clanHead.id,
      type: RoleType.CLAN_HEAD,
      clanId: CLAN_ID,
      branchId: null,
      validFrom: new Date(),
      validTo: null,
    });

    await expect(service.softDeleteProfile(clanHead, headProfile.id)).rejects.toThrow(
      BadRequestException,
    );

    const otherClanUser = makeUser({
      clanId: OTHER_CLAN_ID,
      profileLinks: [{ clanId: OTHER_CLAN_ID, profileId: 'prof-other' }],
      roles: [],
    });
    await expect(service.getProfileById(otherClanUser, headProfile.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('kiểm tra ngày sinh/ngày mất và mở createUnlinkedProfile dùng được trong transaction ngoài (B2-05)', async () => {
    const clanHead = makeUser();
    await expect(
      service.createProfile(clanHead, {
        branchId: BRANCH_1_ID,
        fullName: 'Sai ngày',
        gender: Gender.MALE,
        status: MemberStatus.DECEASED,
        birthDate: '1980-05-01',
        deathDate: '1970-01-01',
      }),
    ).rejects.toThrow(BadRequestException);

    // Cùng ngày dương lịch UTC (giờ khác nhau) vẫn hợp lệ theo @db.Date
    const sameDayDeceased = await service.createProfile(clanHead, {
      branchId: BRANCH_1_ID,
      fullName: 'Mất cùng ngày sinh',
      gender: Gender.MALE,
      status: MemberStatus.DECEASED,
      birthDate: '1980-05-01T15:00:00.000Z',
      deathDate: '1980-05-01T01:00:00.000Z',
    });
    expect(sameDayDeceased.status).toBe(MemberStatus.DECEASED);

    const unlinked = await service.createUnlinkedProfile({
      clanId: CLAN_ID,
      branchId: BRANCH_2_ID,
      fullName: 'Hồ sơ cầu nối chưa liên kết',
      gender: Gender.FEMALE,
      generation: 3,
    });
    expect(unlinked.accountId).toBeNull();
    expect(unlinked.branchId).toBe(BRANCH_2_ID);
  });

  it('kiểm tra quyền chi trước trạng thái REMOVED (403 trước 400), optimistic lock 409 khi xóa mềm và thu hồi vai trò BRANCH_HEAD', async () => {
    const clanHead = makeUser();
    const branch1Head = makeUser({
      id: 'acc-bh-1',
      profileId: 'prof-bh-1',
      roles: [{ type: RoleType.BRANCH_HEAD, clanId: CLAN_ID, branchId: BRANCH_1_ID }],
    });

    const removedChi2 = await service.createProfile(clanHead, {
      branchId: BRANCH_2_ID,
      fullName: 'Thành viên Chi 2 đã xóa',
      gender: Gender.MALE,
    });
    await service.softDeleteProfile(clanHead, removedChi2.id);

    // BRANCH_HEAD Chi 1 không được leak trạng thái REMOVED của hồ sơ Chi 2 -> luôn nhận 403
    await expect(
      service.updateProfile(branch1Head, removedChi2.id, {
        expectedUpdatedAt: removedChi2.updatedAt.toISOString(),
        fullName: 'Đổi tên',
      }),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.softDeleteProfile(branch1Head, removedChi2.id)).rejects.toThrow(
      ForbiddenException,
    );

    const branch2HeadProfile = await service.createProfile(clanHead, {
      branchId: BRANCH_2_ID,
      fullName: 'Trưởng Chi 2',
      gender: Gender.MALE,
    });
    profiles.set(branch2HeadProfile.id, {
      ...profiles.get(branch2HeadProfile.id)!,
      accountId: 'acc-bh-2',
    });
    roleAssignments.push({
      id: 'role-bh-2',
      accountId: 'acc-bh-2',
      type: RoleType.BRANCH_HEAD,
      clanId: CLAN_ID,
      branchId: BRANCH_2_ID,
      validFrom: new Date(),
      validTo: null,
    });

    await expect(
      service.softDeleteProfile(clanHead, branch2HeadProfile.id, '2020-01-01T00:00:00.000Z'),
    ).rejects.toThrow(ConflictException);

    const deleted = await service.softDeleteProfile(
      clanHead,
      branch2HeadProfile.id,
      branch2HeadProfile.updatedAt.toISOString(),
    );
    expect(deleted.status).toBe(MemberStatus.REMOVED);
    const revokedRole = roleAssignments.find((r) => r.id === 'role-bh-2')!;
    expect(revokedRole.validTo).toBeInstanceOf(Date);
  });

  it('chặn đánh dấu Đã mất cho Trưởng họ đương nhiệm và tự thu hồi BRANCH_HEAD khi chuyển chi hoặc qua đời', async () => {
    const clanHead = makeUser();
    const headProfile = await service.createProfile(clanHead, {
      branchId: BRANCH_1_ID,
      fullName: 'Trưởng họ Đương nhiệm',
      gender: Gender.MALE,
    });
    profiles.set(headProfile.id, {
      ...profiles.get(headProfile.id)!,
      accountId: clanHead.id,
    });
    roleAssignments.push({
      id: 'role-clan-head-active',
      accountId: clanHead.id,
      type: RoleType.CLAN_HEAD,
      clanId: CLAN_ID,
      branchId: null,
      validFrom: new Date(),
      validTo: null,
    });

    await expect(
      service.updateProfile(clanHead, headProfile.id, {
        expectedUpdatedAt: headProfile.updatedAt.toISOString(),
        status: MemberStatus.DECEASED,
        deathDate: '2026-10-01',
      }),
    ).rejects.toThrow(BadRequestException);

    // Trưởng chi chuyển sang chi khác -> tự thu hồi quyền BRANCH_HEAD chi cũ
    const bhMoveProfile = await service.createProfile(clanHead, {
      branchId: BRANCH_2_ID,
      fullName: 'Trưởng Chi 2 Chuyển Chi',
      gender: Gender.MALE,
    });
    profiles.set(bhMoveProfile.id, {
      ...profiles.get(bhMoveProfile.id)!,
      accountId: 'acc-bh-move',
    });
    roleAssignments.push({
      id: 'role-bh-move',
      accountId: 'acc-bh-move',
      type: RoleType.BRANCH_HEAD,
      clanId: CLAN_ID,
      branchId: BRANCH_2_ID,
      validFrom: new Date(),
      validTo: null,
    });

    const moved = await service.updateProfile(clanHead, bhMoveProfile.id, {
      expectedUpdatedAt: bhMoveProfile.updatedAt.toISOString(),
      branchId: BRANCH_1_ID,
    });
    expect(moved.branchId).toBe(BRANCH_1_ID);
    expect(roleAssignments.find((r) => r.id === 'role-bh-move')!.validTo).toBeInstanceOf(Date);

    // Trưởng chi chuyển sang Đã mất -> tự thu hồi quyền BRANCH_HEAD
    const bhDeceasedProfile = await service.createProfile(clanHead, {
      branchId: BRANCH_1_ID,
      fullName: 'Trưởng Chi 1 Qua Đời',
      gender: Gender.MALE,
    });
    profiles.set(bhDeceasedProfile.id, {
      ...profiles.get(bhDeceasedProfile.id)!,
      accountId: 'acc-bh-dec',
    });
    roleAssignments.push({
      id: 'role-bh-dec',
      accountId: 'acc-bh-dec',
      type: RoleType.BRANCH_HEAD,
      clanId: CLAN_ID,
      branchId: BRANCH_1_ID,
      validFrom: new Date(),
      validTo: null,
    });

    const markedDeceased = await service.updateProfile(clanHead, bhDeceasedProfile.id, {
      expectedUpdatedAt: bhDeceasedProfile.updatedAt.toISOString(),
      status: MemberStatus.DECEASED,
      deathDate: '2026-10-01',
    });
    expect(markedDeceased.status).toBe(MemberStatus.DECEASED);
    expect(roleAssignments.find((r) => r.id === 'role-bh-dec')!.validTo).toBeInstanceOf(Date);
  });
});
