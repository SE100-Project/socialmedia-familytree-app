import { ForbiddenException, Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { AuthUser } from './auth.guard';

@Injectable()
export class PolicyService {
  /**
   * Kiểm tra người dùng có vai trò Trưởng họ (toàn họ) hay không.
   */
  isClanHead(user: AuthUser, clanId?: string): boolean {
    return user.roles.some(
      (r) => r.type === RoleType.CLAN_HEAD && (!clanId || r.clanId === clanId),
    );
  }

  /**
   * Kiểm tra người dùng có vai trò Trưởng chi của đúng chi nhánh được chỉ định hay không.
   */
  isBranchHead(user: AuthUser, branchId: string): boolean {
    return user.roles.some(
      (r) => r.type === RoleType.BRANCH_HEAD && r.branchId === branchId,
    );
  }

  /**
   * Kiểm tra người dùng có vai trò Kỹ thuật viên hệ thống hay không.
   */
  isTechSupport(user: AuthUser): boolean {
    return user.roles.some((r) => r.type === RoleType.TECH_SUPPORT);
  }

  /**
   * Kiểm tra người dùng đã được liên kết với một hồ sơ trong dòng họ hay chưa.
   * Người chưa liên kết hồ sơ (chỉ mới đăng ký tài khoản) không được truy cập dữ liệu nội bộ (NFR-01).
   */
  isLinkedMember(user: AuthUser, clanId?: string): boolean {
    if (!user.profileId) {
      return false;
    }
    if (!clanId) {
      return true;
    }
    // Nếu có clanId, kiểm tra hồ sơ đó có thuộc clanId này không
    return user.profileLinks.some((l) => l.clanId === clanId);
  }

  /**
   * Phân quyền quản lý Chi nhánh (UC-08):
   * - Trưởng họ quản lý được toàn họ và mọi chi nhánh trong dòng họ đó.
   * - Trưởng chi chỉ quản lý được chi nhánh được phân công.
   */
  canManageBranch(user: AuthUser, clanId: string, branchId: string | null): boolean {
    if (this.isClanHead(user, clanId)) {
      return true;
    }
    if (branchId && this.isBranchHead(user, branchId)) {
      return true;
    }
    return false;
  }

  /**
   * Phân quyền quản lý Hồ sơ thành viên (UC-10, UC-13):
   * - Trưởng họ quản lý được mọi hồ sơ trong họ (kể cả hồ sơ chưa phân chi hoặc nút gốc Thủy tổ).
   * - Trưởng chi chỉ quản lý được hồ sơ thuộc chi của mình (memberBranchId === branchHead.branchId).
   * - Hồ sơ không thuộc chi nào (memberBranchId === null): chỉ Trưởng họ mới có quyền duyệt/sửa.
   */
  canManageMember(user: AuthUser, memberClanId: string, memberBranchId: string | null): boolean {
    if (this.isClanHead(user, memberClanId)) {
      return true;
    }
    if (memberBranchId && this.isBranchHead(user, memberBranchId)) {
      return true;
    }
    return false;
  }

  /**
   * Phân quyền quản lý Quỹ dòng họ (UC-28, UC-29, UC-31):
   * - Quỹ cấp dòng họ (fundBranchId === null): chỉ Trưởng họ quản lý.
   * - Quỹ cấp chi (fundBranchId !== null): Trưởng họ hoặc Trưởng chi của chi đó.
   */
  canManageFund(user: AuthUser, fundClanId: string, fundBranchId: string | null): boolean {
    if (this.isClanHead(user, fundClanId)) {
      return true;
    }
    if (fundBranchId && this.isBranchHead(user, fundBranchId)) {
      return true;
    }
    return false;
  }

  /**
   * Phân quyền kiểm duyệt nội dung Bài viết / Bình luận (UC-23, UC-24):
   * - Tác giả bài viết luôn có quyền sửa/xóa bài của chính mình.
   * - Trưởng họ có quyền ẩn/xóa mọi bài viết trong dòng họ.
   * - Trưởng chi có quyền ẩn/xóa bài viết được đăng trong phạm vi chi của mình.
   */
  canModeratePost(
    user: AuthUser,
    postClanId: string,
    postBranchId: string | null,
    authorAccountId: string,
  ): boolean {
    if (user.id === authorAccountId) {
      return true;
    }
    if (this.isClanHead(user, postClanId)) {
      return true;
    }
    if (postBranchId && this.isBranchHead(user, postBranchId)) {
      return true;
    }
    return false;
  }

  /**
   * Helper ném lỗi ForbiddenException nếu không có quyền quản lý chi nhánh.
   */
  assertCanManageBranch(user: AuthUser, clanId: string, branchId: string | null): void {
    if (!this.canManageBranch(user, clanId, branchId)) {
      throw new ForbiddenException('Bạn không có quyền quản lý chi nhánh này');
    }
  }

  /**
   * Helper ném lỗi ForbiddenException nếu không có quyền quản lý hồ sơ.
   */
  assertCanManageMember(user: AuthUser, memberClanId: string, memberBranchId: string | null): void {
    if (!this.canManageMember(user, memberClanId, memberBranchId)) {
      throw new ForbiddenException('Bạn không có quyền quản lý hoặc phê duyệt hồ sơ thành viên này');
    }
  }

  /**
   * Helper ném lỗi ForbiddenException nếu tài khoản chưa được duyệt gia nhập / chưa liên kết hồ sơ.
   */
  assertLinkedMember(user: AuthUser, clanId?: string): void {
    if (!this.isLinkedMember(user, clanId)) {
      throw new ForbiddenException(
        'Tài khoản chưa được liên kết với hồ sơ thành viên trong dòng họ để truy cập nội dung này',
      );
    }
  }
}

