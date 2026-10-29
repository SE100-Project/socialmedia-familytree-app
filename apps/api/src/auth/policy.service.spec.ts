import { ForbiddenException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { PolicyService } from './policy.service';
import { AuthUser } from './auth.guard';

describe('PolicyService - Ma trận Phân quyền (NFR-01 / FR-03)', () => {
  const service = new PolicyService();

  const clanA = 'clan-nguyen-id';
  const clanB = 'clan-tran-id';
  const branch1 = 'branch-truong-id';
  const branch2 = 'branch-thu-id';

  // 1. Trưởng họ Clan A
  const clanHeadUser: AuthUser = {
    id: 'user-truong-ho',
    profileId: 'profile-an',
    profileLinks: [{ clanId: clanA, profileId: 'profile-an' }],
    roles: [{ type: RoleType.CLAN_HEAD, clanId: clanA, branchId: null }],
  };

  // 2. Trưởng chi Chi 1 của Clan A
  const branchHeadUser: AuthUser = {
    id: 'user-truong-chi',
    profileId: 'profile-binh',
    profileLinks: [{ clanId: clanA, profileId: 'profile-binh' }],
    roles: [{ type: RoleType.BRANCH_HEAD, clanId: clanA, branchId: branch1 }],
  };

  // 3. Thành viên bình thường Clan A
  const memberUser: AuthUser = {
    id: 'user-thanh-vien',
    profileId: 'profile-dung',
    profileLinks: [{ clanId: clanA, profileId: 'profile-dung' }],
    roles: [],
  };

  // 4. Người đăng ký (chưa liên kết hồ sơ)
  const unlinkedUser: AuthUser = {
    id: 'user-chua-lien-ket',
    profileId: null,
    profileLinks: [],
    roles: [],
  };

  describe('Kiểm tra quyền Trưởng họ (CLAN_HEAD)', () => {
    it('Trưởng họ quản lý được toàn họ và mọi chi nhánh trong dòng họ mình', () => {
      expect(service.isClanHead(clanHeadUser, clanA)).toBe(true);
      expect(service.canManageBranch(clanHeadUser, clanA, branch1)).toBe(true);
      expect(service.canManageBranch(clanHeadUser, clanA, branch2)).toBe(true);
      expect(service.canManageBranch(clanHeadUser, clanA, null)).toBe(true);
    });

    it('Trưởng họ không có quyền quản lý dòng họ khác', () => {
      expect(service.isClanHead(clanHeadUser, clanB)).toBe(false);
      expect(service.canManageBranch(clanHeadUser, clanB, 'branch-khac')).toBe(false);
    });

    it('Trưởng họ quản lý được mọi hồ sơ kể cả nút gốc (chưa gán chi)', () => {
      expect(service.canManageMember(clanHeadUser, clanA, branch1)).toBe(true);
      expect(service.canManageMember(clanHeadUser, clanA, null)).toBe(true); // Nút gốc Thủy tổ
    });
  });

  describe('Kiểm tra quyền Trưởng chi (BRANCH_HEAD)', () => {
    it('Trưởng chi quản lý được chi nhánh của mình', () => {
      expect(service.isBranchHead(branchHeadUser, branch1)).toBe(true);
      expect(service.canManageBranch(branchHeadUser, clanA, branch1)).toBe(true);
      expect(service.canManageMember(branchHeadUser, clanA, branch1)).toBe(true);
    });

    it('Trưởng chi KHÔNG quản lý được chi khác hoặc hồ sơ nút gốc', () => {
      expect(service.canManageBranch(branchHeadUser, clanA, branch2)).toBe(false);
      expect(service.canManageMember(branchHeadUser, clanA, branch2)).toBe(false);
      expect(service.canManageMember(branchHeadUser, clanA, null)).toBe(false); // Nút gốc
    });

    it('Trưởng chi ném ngoại lệ khi can thiệp sai phạm vi', () => {
      expect(() =>
        service.assertCanManageMember(branchHeadUser, clanA, branch2),
      ).toThrow(ForbiddenException);
    });
  });

  describe('Kiểm tra thành viên đã liên kết vs chưa liên kết hồ sơ (NFR-01)', () => {
    it('Thành viên đã liên kết được nhận diện hợp lệ', () => {
      expect(service.isLinkedMember(memberUser, clanA)).toBe(true);
      expect(() => service.assertLinkedMember(memberUser, clanA)).not.toThrow();
    });

    it('Người chưa liên kết hồ sơ bị từ chối truy cập dữ liệu nội bộ (403 Forbidden)', () => {
      expect(service.isLinkedMember(unlinkedUser)).toBe(false);
      expect(() => service.assertLinkedMember(unlinkedUser)).toThrow(ForbiddenException);
    });
  });

  describe('Phân quyền Quỹ và Kiểm duyệt nội dung', () => {
    it('Quỹ toàn họ chỉ Trưởng họ quản lý; Quỹ chi thì Trưởng họ và Trưởng chi đều có quyền', () => {
      // Quỹ toàn họ
      expect(service.canManageFund(clanHeadUser, clanA, null)).toBe(true);
      expect(service.canManageFund(branchHeadUser, clanA, null)).toBe(false);

      // Quỹ Chi 1
      expect(service.canManageFund(clanHeadUser, clanA, branch1)).toBe(true);
      expect(service.canManageFund(branchHeadUser, clanA, branch1)).toBe(true);
      expect(service.canManageFund(branchHeadUser, clanA, branch2)).toBe(false);
    });

    it('Kiểm duyệt bài viết: tác giả tự sửa, Trưởng họ duyệt toàn họ, Trưởng chi duyệt bài thuộc chi', () => {
      const authorId = memberUser.id;

      // Tác giả tự sửa bài của mình
      expect(service.canModeratePost(memberUser, clanA, branch1, authorId)).toBe(true);

      // Trưởng họ kiểm duyệt được bài của thành viên
      expect(service.canModeratePost(clanHeadUser, clanA, branch1, authorId)).toBe(true);

      // Trưởng chi Chi 1 kiểm duyệt được bài trong Chi 1
      expect(service.canModeratePost(branchHeadUser, clanA, branch1, authorId)).toBe(true);

      // Trưởng chi Chi 1 KHÔNG kiểm duyệt được bài thuộc Chi 2
      expect(service.canModeratePost(branchHeadUser, clanA, branch2, authorId)).toBe(false);
    });

    it('canManageClan & assertMember theo đúng đặc tả thẻ CRC', () => {
      expect(service.canManageClan(clanHeadUser, clanA)).toBe(true);
      expect(service.canManageClan(branchHeadUser, clanA)).toBe(false);

      expect(() => service.assertMember(memberUser, clanA)).not.toThrow();
      expect(() => service.assertMember(unlinkedUser, clanA)).toThrow(ForbiddenException);
    });
  });
});

