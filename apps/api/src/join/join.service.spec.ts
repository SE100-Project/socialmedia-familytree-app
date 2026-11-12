import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JoinRequestKind, RequestStatus, RoleType } from '@prisma/client';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { JoinService } from './join.service';
import { PolicyService } from '../auth/policy.service';
import { AuthUser } from '../auth/auth.guard';

describe('JoinService Integration Test (UC-04, UC-05, B1-06, B1-07, B1-08)', () => {
  let service: JoinService;
  let prisma: PrismaService;
  let policy: PolicyService;

  let clanId: string;
  let branch1Id: string;
  let branch2Id: string;
  let clanHeadUser: AuthUser;
  let branchHeadUser: AuthUser;
  let memberUser: AuthUser;
  let outsider1: AuthUser;
  let outsider2: AuthUser;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ JWT_ACCESS_SECRET: 'test-jwt-secret-very-secure-12345678' })],
        }),
        JwtModule.register({
          secret: 'test-jwt-secret-very-secure-12345678',
          signOptions: { expiresIn: '15m' },
        }),
        PrismaModule,
        AuditModule,
        AuthModule,
      ],
      providers: [JoinService],
    }).compile();

    service = module.get<JoinService>(JoinService);
    prisma = module.get<PrismaService>(PrismaService);
    policy = module.get<PolicyService>(PolicyService);

    // Lấy thông tin dòng họ và chi nhánh từ seed
    const clan = await prisma.clan.findUniqueOrThrow({
      where: { clanCode: 'CLAN-NGUYEN-DG' },
      include: { branches: true },
    });
    clanId = clan.id;
    branch1Id = clan.branches[0].id;
    branch2Id = clan.branches[1].id;

    // Lấy tài khoản mẫu từ seed
    const headAcc = await prisma.account.findUniqueOrThrow({ where: { phone: '0901000001' } });
    const branchAcc = await prisma.account.findUniqueOrThrow({ where: { phone: '0901000002' } });
    const memberAcc = await prisma.account.findUniqueOrThrow({ where: { phone: '0901000003' } });

    clanHeadUser = {
      id: headAcc.id,
      accountCode: headAcc.accountCode,
      phone: headAcc.phone,
      status: 'ACTIVE',
      profileId: 'head-profile-id',
      profileLinks: [{ clanId, profileId: 'head-profile-id' }],
      roles: [{ type: RoleType.CLAN_HEAD, clanId, branchId: null }],
    };

    branchHeadUser = {
      id: branchAcc.id,
      accountCode: branchAcc.accountCode,
      phone: branchAcc.phone,
      status: 'ACTIVE',
      profileId: 'branch-profile-id',
      profileLinks: [{ clanId, profileId: 'branch-profile-id' }],
      roles: [{ type: RoleType.BRANCH_HEAD, clanId, branchId: branch1Id }],
    };

    memberUser = {
      id: memberAcc.id,
      accountCode: memberAcc.accountCode,
      phone: memberAcc.phone,
      status: 'ACTIVE',
      profileId: 'member-profile-id',
      profileLinks: [{ clanId, profileId: 'member-profile-id' }],
      roles: [],
    };

    // Tạo 2 tài khoản người ngoài (chưa liên kết phả hệ) để test xin gia nhập
    const out1 = await prisma.account.create({
      data: {
        phone: '0919999001',
        accountCode: 'OUTSID01',
        passwordHash: 'hash-demo',
        status: 'ACTIVE',
      },
    });
    outsider1 = {
      id: out1.id,
      accountCode: out1.accountCode,
      phone: out1.phone,
      status: 'ACTIVE',
      profileId: null,
      profileLinks: [],
      roles: [],
    };

    const out2 = await prisma.account.create({
      data: {
        phone: '0919999002',
        accountCode: 'OUTSID02',
        passwordHash: 'hash-demo',
        status: 'ACTIVE',
      },
    });
    outsider2 = {
      id: out2.id,
      accountCode: out2.accountCode,
      phone: out2.phone,
      status: 'ACTIVE',
      profileId: null,
      profileLinks: [],
      roles: [],
    };
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu test
    const testAccountIds = [outsider1.id, outsider2.id];
    for (const accId of testAccountIds) {
      const requests = await prisma.joinRequest.findMany({ where: { requesterId: accId } });
      for (const r of requests) {
        await prisma.approvalDecision.deleteMany({ where: { joinRequestId: r.id } });
      }
      await prisma.joinRequest.deleteMany({ where: { requesterId: accId } });
      await prisma.accountProfileLink.deleteMany({ where: { accountId: accId } });
      await prisma.memberProfile.deleteMany({ where: { accountId: accId } });
      await prisma.account.deleteMany({ where: { id: accId } });
    }
    await prisma.$disconnect();
  });

  describe('B1-06: Xin gia nhập gia phả (UC-04)', () => {
    it('gửi yêu cầu thành công bằng mã gia phả (BY_CLAN_CODE) và định tuyến đúng (BR-02)', async () => {
      const res = await service.createJoinRequest(outsider1, {
        kind: JoinRequestKind.BY_CLAN_CODE,
        referenceCode: 'CLAN-NGUYEN-DG',
        branchId: branch1Id,
        declaredRelation: 'Cháu đời 5',
      });

      expect(res.data).toBeDefined();
      expect(res.data.status).toBe(RequestStatus.PENDING);
      expect(res.data.referenceCode).toBe('CLAN-NGUYEN-DG');
      expect(res.routing.clanId).toBe(clanId);
      // Chi 1 đã có Trưởng chi (0901000002) nên định tuyến về BRANCH_HEAD
      expect(res.routing.routedToRole).toBe(RoleType.BRANCH_HEAD);
    });

    it('chặn yêu cầu trùng lặp khi người dùng đang có yêu cầu Chờ duyệt (PENDING)', async () => {
      await expect(
        service.createJoinRequest(outsider1, {
          kind: JoinRequestKind.BY_CLAN_CODE,
          referenceCode: 'CLAN-NGUYEN-DG',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('phân biệt lỗi: báo lỗi rõ khi mã gia phả không tồn tại', async () => {
      await expect(
        service.createJoinRequest(outsider2, {
          kind: JoinRequestKind.BY_CLAN_CODE,
          referenceCode: 'CLAN-NON-EXISTENT',
        }),
      ).rejects.toThrow(new BadRequestException('Mã gia phả không tồn tại'));
    });

    it('phân biệt lỗi: báo lỗi rõ khi mã tài khoản người thân không tồn tại', async () => {
      await expect(
        service.createJoinRequest(outsider2, {
          kind: JoinRequestKind.BY_ACCOUNT_CODE,
          referenceCode: 'UNKNOWN9',
        }),
      ).rejects.toThrow(new BadRequestException('Mã tài khoản người thân không tồn tại'));
    });

    it('chặn việc tự nhập mã tài khoản của chính mình', async () => {
      await expect(
        service.createJoinRequest(outsider2, {
          kind: JoinRequestKind.BY_ACCOUNT_CODE,
          referenceCode: outsider2.accountCode!,
        }),
      ).rejects.toThrow(new BadRequestException('Không thể tự nhập mã tài khoản của chính mình'));
    });

    it('chặn yêu cầu gia nhập nếu tài khoản đã liên kết trong dòng họ này (BR-05)', async () => {
      // memberUser đã liên kết trong dòng họ CLAN-NGUYEN-DG
      await expect(
        service.createJoinRequest(memberUser, {
          kind: JoinRequestKind.BY_CLAN_CODE,
          referenceCode: 'CLAN-NGUYEN-DG',
        }),
      ).rejects.toThrow(
        new BadRequestException('Bạn đã liên kết với một hồ sơ trong dòng họ này rồi'),
      );
    });
  });

  describe('B1-07: Hủy yêu cầu (FR-52) & Quản lý hàng đợi duyệt (UC-05)', () => {
    it('FR-52: Người gửi tự hủy yêu cầu gia nhập thành công khi còn PENDING', async () => {
      // Lấy yêu cầu PENDING của outsider1
      const req = await prisma.joinRequest.findFirstOrThrow({
        where: { requesterId: outsider1.id, status: RequestStatus.PENDING },
      });

      const cancelRes = await service.cancelJoinRequest(outsider1, req.id);
      expect(cancelRes.success).toBe(true);

      const after = await prisma.joinRequest.findUniqueOrThrow({ where: { id: req.id } });
      expect(after.status).toBe(RequestStatus.CANCELLED);
    });

    it('FR-52: Không thể hủy yêu cầu của người khác (ForbiddenException)', async () => {
      // outsider2 tạo yêu cầu mới
      const newReq = await service.createJoinRequest(outsider2, {
        kind: JoinRequestKind.BY_CLAN_CODE,
        referenceCode: 'CLAN-NGUYEN-DG',
      });

      await expect(
        service.cancelJoinRequest(outsider1, newReq.data.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lấy danh sách hàng đợi: Trưởng họ xem toàn bộ họ, thành viên thường bị 403', async () => {
      // Trưởng họ xem được
      const listHead = await service.listJoinRequests(clanHeadUser, {});
      expect(Array.isArray(listHead)).toBe(true);
      expect(listHead.length).toBeGreaterThan(0);

      // Thành viên thường không có quyền quản lý -> 403
      await expect(service.listJoinRequests(memberUser, {})).rejects.toThrow(ForbiddenException);
    });

    it('từ chối yêu cầu (reject): bắt buộc lý do và người duyệt khác người tạo (BR-12)', async () => {
      const pendingReq = await prisma.joinRequest.findFirstOrThrow({
        where: { requesterId: outsider2.id, status: RequestStatus.PENDING },
      });

      // BR-12: Người tạo không thể tự duyệt/từ chối chính mình
      await expect(
        service.rejectJoinRequest(outsider2, pendingReq.id, { reason: 'Tự từ chối' }),
      ).rejects.toThrow(BadRequestException);

      // Từ chối thiếu lý do
      await expect(
        service.rejectJoinRequest(clanHeadUser, pendingReq.id, { reason: '' }),
      ).rejects.toThrow(BadRequestException);

      // Trưởng họ từ chối hợp lệ
      const rejectRes = await service.rejectJoinRequest(clanHeadUser, pendingReq.id, {
        reason: 'Không xác minh được mối quan hệ huyết thống',
      });

      expect(rejectRes.success).toBe(true);
      expect(rejectRes.decision.approved).toBe(false);

      const after = await prisma.joinRequest.findUniqueOrThrow({ where: { id: pendingReq.id } });
      expect(after.status).toBe(RequestStatus.REJECTED);
    });
  });

  describe('B1-08: Phê duyệt yêu cầu & Liên kết hồ sơ phả hệ (UC-05)', () => {
    it('duyệt yêu cầu và tự động tạo hồ sơ mới khi chưa có hồ sơ trên cây', async () => {
      // outsider1 gửi lại yêu cầu gia nhập
      const newReq = await service.createJoinRequest(outsider1, {
        kind: JoinRequestKind.BY_CLAN_CODE,
        referenceCode: 'CLAN-NGUYEN-DG',
        branchId: branch1Id,
        declaredRelation: 'Nguyễn Văn Outsider',
      });

      // Trưởng chi duyệt và tạo hồ sơ mới
      const approveRes = await service.approveJoinRequest(branchHeadUser, newReq.data.id, {
        newProfileData: {
          fullName: 'Nguyễn Văn Outsider',
          gender: 'MALE',
          birthDate: '1998-10-10',
          generation: 5,
          branchId: branch1Id,
        },
        reason: 'Đã xác minh qua sổ hộ khẩu',
      });

      expect(approveRes.success).toBe(true);
      expect(approveRes.profileId).toBeDefined();

      // Kiểm tra AccountProfileLink đã được tạo trong CSDL
      const link = await prisma.accountProfileLink.findUniqueOrThrow({
        where: {
          accountId_clanId: {
            accountId: outsider1.id,
            clanId,
          },
        },
      });
      expect(link.profileId).toBe(approveRes.profileId);

      // Kiểm tra MemberProfile.accountId cũng được cập nhật
      const profile = await prisma.memberProfile.findUniqueOrThrow({
        where: { id: approveRes.profileId },
      });
      expect(profile.accountId).toBe(outsider1.id);
      expect(profile.fullName).toBe('Nguyễn Văn Outsider');
    });

    it('chống xung đột đồng thời (Race Condition): Hủy và duyệt đồng thời chỉ một bên thành công', async () => {
      // outsider2 gửi yêu cầu mới
      const raceReq = await service.createJoinRequest(outsider2, {
        kind: JoinRequestKind.BY_CLAN_CODE,
        referenceCode: 'CLAN-NGUYEN-DG',
      });

      // Cho hủy trước
      const cancelRes = await service.cancelJoinRequest(outsider2, raceReq.data.id);
      expect(cancelRes.success).toBe(true);

      // Duyệt sau khi đã hủy -> phải ném ConflictException
      await expect(
        service.approveJoinRequest(clanHeadUser, raceReq.data.id, {
          reason: 'Cố tình duyệt khi đã hủy',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
