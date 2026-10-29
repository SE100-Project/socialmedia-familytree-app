import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JoinRequestKind, RequestStatus, RoleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PolicyService } from '../auth/policy.service';
import { AuthUser } from '../auth/auth.guard';
import {
  ApproveJoinRequestDto,
  CreateJoinRequestDto,
  ListJoinRequestsQueryDto,
  RejectJoinRequestDto,
} from './dto';

@Injectable()
export class JoinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly policy: PolicyService,
  ) {}

  /**
   * UC-04 (B1-06): Gửi yêu cầu xin gia nhập gia phả.
   * - Hỗ trợ xin qua mã gia phả (BY_CLAN_CODE) hoặc qua mã tài khoản người thân (BY_ACCOUNT_CODE).
   * - Phân biệt thông báo lỗi mã gia phả và mã tài khoản người thân.
   * - Chặn yêu cầu trùng khi còn Chờ duyệt (PENDING).
   * - Tự động định tuyến người duyệt: Chi chưa có Trưởng chi thì chuyển Trưởng họ (BR-02).
   */
  async createJoinRequest(requester: AuthUser, dto: CreateJoinRequestDto) {
    const refCode = dto.referenceCode.trim().toUpperCase();
    let targetClanId: string;
    let targetBranchId: string | null = null;
    let targetProfileId: string | null = dto.targetProfileId ?? null;

    if (dto.kind === JoinRequestKind.BY_CLAN_CODE) {
      // 1. Phân biệt: Tìm theo mã gia phả
      const clan = await this.prisma.clan.findUnique({
        where: { clanCode: refCode },
        include: { branches: true },
      });
      if (!clan) {
        throw new BadRequestException('Mã gia phả không tồn tại');
      }
      targetClanId = clan.id;

      if (dto.branchId) {
        const branch = clan.branches.find((b) => b.id === dto.branchId);
        if (!branch) {
          throw new BadRequestException('Chi nhánh không thuộc dòng họ này');
        }
        targetBranchId = branch.id;
      }
    } else if (dto.kind === JoinRequestKind.BY_ACCOUNT_CODE) {
      // 2. Phân biệt: Tìm theo mã tài khoản người thân
      const relativeAccount = await this.prisma.account.findUnique({
        where: { accountCode: refCode },
        include: {
          accountProfileLinks: {
            include: {
              clan: true,
              profile: { select: { id: true, branchId: true, fullName: true } },
            },
          },
        },
      });

      if (!relativeAccount) {
        throw new BadRequestException('Mã tài khoản người thân không tồn tại');
      }

      if (relativeAccount.id === requester.id) {
        throw new BadRequestException('Không thể tự nhập mã tài khoản của chính mình');
      }

      if (relativeAccount.accountProfileLinks.length === 0) {
        throw new BadRequestException('Tài khoản người thân chưa liên kết với hồ sơ gia phả nào');
      }

      const primaryLink = relativeAccount.accountProfileLinks[0];
      targetClanId = primaryLink.clanId;
      targetBranchId = primaryLink.profile.branchId ?? null;
      targetProfileId = targetProfileId ?? primaryLink.profileId;
    } else {
      throw new BadRequestException('Hình thức xin gia nhập không hợp lệ');
    }

    // 3. Kiểm tra xem người yêu cầu đã liên kết với dòng họ mục tiêu này chưa (BR-05)
    const existingLink = await this.prisma.accountProfileLink.findUnique({
      where: {
        accountId_clanId: {
          accountId: requester.id,
          clanId: targetClanId,
        },
      },
    });
    if (existingLink) {
      throw new BadRequestException('Bạn đã liên kết với một hồ sơ trong dòng họ này rồi');
    }

    // 4. Chặn yêu cầu trùng khi còn Chờ duyệt (PENDING)
    const pendingRequest = await this.prisma.joinRequest.findFirst({
      where: {
        requesterId: requester.id,
        status: RequestStatus.PENDING,
      },
    });
    if (pendingRequest) {
      throw new ConflictException(
        'Bạn đã có một yêu cầu gia nhập đang chờ duyệt. Vui lòng đợi người quản lý xử lý hoặc hủy yêu cầu trước.',
      );
    }

    // 5. Định tuyến người duyệt (BR-02):
    // Nếu có chi -> kiểm tra xem chi đó đã có Trưởng chi (BRANCH_HEAD) chưa.
    // Nếu chi chưa có Trưởng chi (hoặc chỉ có toàn họ) -> định tuyến cho Trưởng họ (CLAN_HEAD).
    let routedToRole: RoleType = RoleType.CLAN_HEAD;
    if (targetBranchId) {
      const activeBranchHead = await this.prisma.roleAssignment.findFirst({
        where: {
          clanId: targetClanId,
          branchId: targetBranchId,
          type: RoleType.BRANCH_HEAD,
          OR: [{ validTo: null }, { validTo: { gt: new Date() } }],
        },
      });
      if (activeBranchHead) {
        routedToRole = RoleType.BRANCH_HEAD;
      }
    }

    // 6. Tạo bản ghi JoinRequest
    const joinRequest = await this.prisma.joinRequest.create({
      data: {
        requesterId: requester.id,
        kind: dto.kind,
        referenceCode: refCode,
        declaredRelation: dto.declaredRelation?.trim() ?? null,
        targetProfileId,
        status: RequestStatus.PENDING,
      },
      include: {
        requester: {
          select: { id: true, accountCode: true, phone: true, email: true },
        },
      },
    });

    return {
      message: 'Gửi yêu cầu xin gia nhập thành công. Yêu cầu đang chờ duyệt.',
      data: joinRequest,
      routing: {
        clanId: targetClanId,
        branchId: targetBranchId,
        routedToRole,
      },
    };
  }

  /**
   * FR-52: Người gửi hủy yêu cầu gia nhập khi còn ở trạng thái PENDING.
   */
  async cancelJoinRequest(requester: AuthUser, requestId: string) {
    const req = await this.prisma.joinRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) {
      throw new NotFoundException('Yêu cầu gia nhập không tồn tại');
    }

    if (req.requesterId !== requester.id) {
      throw new ForbiddenException('Bạn không có quyền hủy yêu cầu của người khác');
    }

    if (req.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Không thể hủy yêu cầu đã được xử lý hoặc đã bị hủy trước đó');
    }

    // Cập nhật trạng thái CANCELLED có điều kiện
    const updated = await this.prisma.joinRequest.updateMany({
      where: {
        id: requestId,
        status: RequestStatus.PENDING,
      },
      data: {
        status: RequestStatus.CANCELLED,
      },
    });

    if (updated.count === 0) {
      throw new ConflictException('Yêu cầu không còn ở trạng thái chờ duyệt');
    }

    await this.audit.log({
      actorId: requester.id,
      action: 'CANCEL_JOIN_REQUEST',
      entityType: 'JOIN_REQUEST',
      entityId: requestId,
      before: { status: req.status },
      after: { status: RequestStatus.CANCELLED },
    });

    return {
      success: true,
      message: 'Đã hủy yêu cầu xin gia nhập thành công',
    };
  }

  /**
   * UC-05 (B1-07): Lấy danh sách hàng đợi yêu cầu gia nhập theo phạm vi quyền hạn.
   * - Trưởng họ xem toàn họ.
   * - Trưởng chi xem chi mình phụ trách.
   * - Khách hoặc thành viên không có quyền quản lý sẽ bị từ chối 403.
   */
  async listJoinRequests(user: AuthUser, query: ListJoinRequestsQueryDto) {
    const isHead = this.policy.isClanHead(user);
    const isBranch = user.roles.some((r) => r.type === RoleType.BRANCH_HEAD);

    if (!isHead && !isBranch) {
      throw new ForbiddenException('Bạn không có quyền xem danh sách yêu cầu gia nhập');
    }

    // Xác định phạm vi dòng họ / chi của người duyệt
    const managedClanIds = user.roles.map((r) => r.clanId);
    const managedBranchIds = user.roles
      .filter((r) => r.type === RoleType.BRANCH_HEAD && r.branchId)
      .map((r) => r.branchId as string);

    const whereClause: any = {};
    if (query.status) {
      whereClause.status = query.status;
    }

    // Lấy toàn bộ yêu cầu, kèm thông tin người gửi và người duyệt
    const requests = await this.prisma.joinRequest.findMany({
      where: whereClause,
      include: {
        requester: {
          select: {
            id: true,
            accountCode: true,
            phone: true,
            email: true,
            status: true,
            createdAt: true,
          },
        },
        decision: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Lọc theo phạm vi quyền:
    // Trưởng họ: xem toàn bộ yêu cầu của dòng họ mình quản lý
    // Trưởng chi: chỉ xem yêu cầu liên quan đến chi mình
    const filtered = await Promise.all(
      requests.map(async (item) => {
        const clanAndBranch = await this.resolveTargetClanAndBranch(item);
        if (!clanAndBranch) return null;

        if (isHead && managedClanIds.includes(clanAndBranch.clanId)) {
          return { ...item, targetScope: clanAndBranch };
        }

        if (
          isBranch &&
          clanAndBranch.branchId &&
          managedBranchIds.includes(clanAndBranch.branchId)
        ) {
          return { ...item, targetScope: clanAndBranch };
        }

        return null;
      }),
    );

    return filtered.filter(Boolean);
  }

  /**
   * UC-05 (B1-07): Từ chối yêu cầu gia nhập (bắt buộc có lý do).
   * - Người duyệt khác người tạo (BR-12).
   * - Cập nhật có điều kiện `status = PENDING` trong transaction (chống race condition).
   */
  async rejectJoinRequest(approver: AuthUser, requestId: string, dto: RejectJoinRequestDto) {
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('Vui lòng nhập lý do từ chối (bắt buộc theo BR-12 / UC-05)');
    }

    const req = await this.prisma.joinRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) {
      throw new NotFoundException('Yêu cầu gia nhập không tồn tại');
    }

    // BR-12: Người duyệt phải khác người tạo yêu cầu
    if (req.requesterId === approver.id) {
      throw new BadRequestException('Người duyệt không được là người tạo yêu cầu (BR-12)');
    }

    // Kiểm tra quyền của người duyệt
    await this.assertApproverPermission(approver, req);

    // Thực hiện trong Transaction an toàn
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.joinRequest.updateMany({
        where: {
          id: requestId,
          status: RequestStatus.PENDING,
        },
        data: {
          status: RequestStatus.REJECTED,
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          'Yêu cầu không còn ở trạng thái chờ duyệt (đã được xử lý hoặc đã hủy)',
        );
      }

      const decision = await tx.approvalDecision.create({
        data: {
          joinRequestId: requestId,
          approverId: approver.id,
          approved: false,
          reason: dto.reason.trim(),
        },
      });

      await this.audit.log({
        tx,
        actorId: approver.id,
        action: 'REJECT_JOIN_REQUEST',
        entityType: 'JOIN_REQUEST',
        entityId: requestId,
        before: { status: RequestStatus.PENDING },
        after: { status: RequestStatus.REJECTED, reason: dto.reason.trim() },
      });

      return {
        success: true,
        message: 'Đã từ chối yêu cầu gia nhập',
        decision,
      };
    });
  }

  /**
   * UC-05 (B1-07, B1-08): Phê duyệt yêu cầu gia nhập và liên kết hồ sơ phả hệ.
   * - Chọn hồ sơ có sẵn chưa có chủ hoặc tạo hồ sơ mới (B1-08).
   * - Kiểm tra xung đột liên kết (BR-05).
   * - Cập nhật có điều kiện trạng thái PENDING trong 1 transaction an toàn (NFR-07).
   * - Tạo AccountProfileLink và cập nhật MemberProfile.accountId.
   * - Ghi vết kiểm toán (AuditService).
   */
  async approveJoinRequest(approver: AuthUser, requestId: string, dto: ApproveJoinRequestDto) {
    const req = await this.prisma.joinRequest.findUnique({
      where: { id: requestId },
      include: { requester: true },
    });
    if (!req) {
      throw new NotFoundException('Yêu cầu gia nhập không tồn tại');
    }

    // BR-12: Người duyệt phải khác người tạo yêu cầu
    if (req.requesterId === approver.id) {
      throw new BadRequestException('Người duyệt không được là người tạo yêu cầu (BR-12)');
    }

    // Xác định dòng họ và chi mục tiêu
    const scope = await this.resolveTargetClanAndBranch(req);
    if (!scope) {
      throw new BadRequestException('Không thể xác định dòng họ cho yêu cầu này');
    }

    // Kiểm tra quyền duyệt (Trưởng họ hoặc Trưởng chi của chi được yêu cầu/gán)
    const effectiveBranchId = dto.newProfileData?.branchId ?? scope.branchId;
    await this.assertApproverPermission(approver, req, effectiveBranchId);

    const clanId = scope.clanId;
    const branchId = scope.branchId;

    // BR-05: Kiểm tra tài khoản requester đã liên kết với hồ sơ nào trong họ này chưa
    const existingAccountLink = await this.prisma.accountProfileLink.findUnique({
      where: {
        accountId_clanId: {
          accountId: req.requesterId,
          clanId,
        },
      },
    });
    if (existingAccountLink) {
      throw new ConflictException('Tài khoản này đã liên kết với một hồ sơ khác trong dòng họ');
    }

    // Xác thực hồ sơ liên kết (profileId sẵn có hoặc tạo mới)
    let chosenProfileId = dto.profileId ?? req.targetProfileId ?? null;

    if (chosenProfileId) {
      const existingProfile = await this.prisma.memberProfile.findUnique({
        where: { id: chosenProfileId },
        include: { accountProfileLink: true },
      });
      if (!existingProfile) {
        throw new NotFoundException('Hồ sơ phả hệ được chọn không tồn tại');
      }
      if (existingProfile.clanId !== clanId) {
        throw new BadRequestException('Hồ sơ phả hệ không thuộc dòng họ này');
      }
      // BR-05: Hồ sơ phải chưa có chủ
      if (existingProfile.accountId || existingProfile.accountProfileLink) {
        // Nếu hồ sơ đã có chủ và người chọn là từ dto -> báo lỗi xung đột
        if (dto.profileId) {
          throw new ConflictException('Hồ sơ phả hệ này đã được liên kết với một tài khoản khác');
        }
        // Nếu targetProfileId từ người thân thì bỏ qua để tạo hồ sơ mới
        chosenProfileId = null;
      }
    }

    // Thực hiện trong một Database Transaction duy nhất (NFR-07)
    return this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật có điều kiện chỉ khi yêu cầu còn PENDING (ngăn race condition / concurrent cancel)
      const updated = await tx.joinRequest.updateMany({
        where: {
          id: requestId,
          status: RequestStatus.PENDING,
        },
        data: {
          status: RequestStatus.APPROVED,
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          'Yêu cầu không còn ở trạng thái chờ duyệt (đã được xử lý hoặc đã hủy)',
        );
      }

      // 2. Tạo hồ sơ mới nếu chưa có hồ sơ có sẵn chưa có chủ (B1-08)
      let finalProfileId = chosenProfileId;
      if (!finalProfileId) {
        const newProf = await tx.memberProfile.create({
          data: {
            clanId,
            branchId: dto.newProfileData?.branchId ?? branchId ?? null,
            accountId: req.requesterId, // Liên kết 1-1 trực tiếp
            fullName:
              dto.newProfileData?.fullName ??
              req.declaredRelation ??
              req.requester.phone ??
              'Thành viên mới',
            gender: dto.newProfileData?.gender ?? 'MALE',
            birthDate: dto.newProfileData?.birthDate
              ? new Date(dto.newProfileData.birthDate)
              : null,
            generation: dto.newProfileData?.generation ?? null,
            status: 'ALIVE',
          },
        });
        finalProfileId = newProf.id;
      } else {
        // Cập nhật accountId cho hồ sơ có sẵn
        await tx.memberProfile.update({
          where: { id: finalProfileId },
          data: { accountId: req.requesterId },
        });
      }

      // 3. Tạo bản ghi AccountProfileLink (CSDL v1.2 §3.5)
      await tx.accountProfileLink.create({
        data: {
          accountId: req.requesterId,
          clanId,
          profileId: finalProfileId,
        },
      });

      // 4. Cập nhật targetProfileId vào joinRequest để lưu vết
      await tx.joinRequest.update({
        where: { id: requestId },
        data: { targetProfileId: finalProfileId },
      });

      // 5. Tạo Quyết định duyệt (ApprovalDecision - CSDL v1.2 §3.9)
      const decision = await tx.approvalDecision.create({
        data: {
          joinRequestId: requestId,
          approverId: approver.id,
          approved: true,
          reason: dto.reason?.trim() ?? 'Chấp thuận gia nhập dòng họ',
        },
      });

      // 6. Ghi nhật ký kiểm toán (Audit Trail - FR-46 / B1-02)
      await this.audit.log({
        tx,
        actorId: approver.id,
        action: 'APPROVE_JOIN_REQUEST',
        entityType: 'JOIN_REQUEST',
        entityId: requestId,
        before: { status: RequestStatus.PENDING },
        after: {
          status: RequestStatus.APPROVED,
          requesterId: req.requesterId,
          clanId,
          profileId: finalProfileId,
        },
      });

      return {
        success: true,
        message: 'Đã duyệt yêu cầu gia nhập và hoàn tất liên kết hồ sơ phả hệ',
        profileId: finalProfileId,
        clanId,
        decision,
      };
    });
  }

  // ───────── HELPER METHODS ─────────

  private async resolveTargetClanAndBranch(req: {
    kind: JoinRequestKind;
    referenceCode: string;
    targetProfileId?: string | null;
  }): Promise<{ clanId: string; branchId: string | null } | null> {
    if (req.targetProfileId) {
      const prof = await this.prisma.memberProfile.findUnique({
        where: { id: req.targetProfileId },
        select: { clanId: true, branchId: true },
      });
      if (prof) {
        return { clanId: prof.clanId, branchId: prof.branchId };
      }
    }

    if (req.kind === JoinRequestKind.BY_CLAN_CODE) {
      const clan = await this.prisma.clan.findUnique({
        where: { clanCode: req.referenceCode },
      });
      if (!clan) return null;
      return { clanId: clan.id, branchId: null };
    }

    if (req.kind === JoinRequestKind.BY_ACCOUNT_CODE) {
      const relAcc = await this.prisma.account.findUnique({
        where: { accountCode: req.referenceCode },
        include: {
          accountProfileLinks: {
            include: { profile: { select: { branchId: true } } },
          },
        },
      });
      if (!relAcc || relAcc.accountProfileLinks.length === 0) return null;
      const link = relAcc.accountProfileLinks[0];
      return { clanId: link.clanId, branchId: link.profile.branchId ?? null };
    }

    return null;
  }

  private async assertApproverPermission(
    approver: AuthUser,
    req: { kind: JoinRequestKind; referenceCode: string; targetProfileId?: string | null },
    dtoBranchId?: string | null,
  ) {
    const scope = await this.resolveTargetClanAndBranch(req);
    if (!scope) {
      throw new BadRequestException('Không tìm thấy phạm vi dòng họ tương ứng');
    }

    const isClanHead = this.policy.isClanHead(approver, scope.clanId);
    if (isClanHead) return;

    const effectiveBranchId = scope.branchId ?? dtoBranchId;
    if (effectiveBranchId && this.policy.isBranchHead(approver, effectiveBranchId)) {
      return;
    }

    throw new ForbiddenException('Bạn không có quyền duyệt yêu cầu gia nhập cho phạm vi này');
  }
}
