import { PrismaClient, Gender, MemberStatus, CalendarType, RelationType, RoleType, AuthType, AccountStatus, ContentStatus, FundScope } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { encryptTotpSecret } from '../src/common/totp.ts';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Bắt đầu nạp dữ liệu mẫu (Dev Seed) ---');

  // 1. Dọn sạch dữ liệu cũ theo thứ tự quan hệ ngược
  console.log('1. Xóa dữ liệu cũ...');
  await prisma.financialVoucher.deleteMany({});
  await prisma.fundTransaction.deleteMany({});
  await prisma.contributionRequest.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.fund.deleteMany({});
  await prisma.electionVote.deleteMany({});
  await prisma.electionSession.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.reaction.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.attachment.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.approvalDecision.deleteMany({});
  await prisma.requestMessage.deleteMany({});
  await prisma.profileUpdateRequest.deleteMany({});
  await prisma.invitation.deleteMany({});
  await prisma.joinRequest.deleteMany({});
  await prisma.privacySetting.deleteMany({});
  await prisma.relationship.deleteMany({});
  await prisma.accountProfileLink.deleteMany({});
  await prisma.roleAssignment.deleteMany({});
  await prisma.totpCredential.deleteMany({});
  await prisma.passwordResetRequest.deleteMany({});
  await prisma.memberProfile.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.clan.deleteMany({});
  await prisma.account.deleteMany({});

  const defaultPasswordHash = await hash('Dev@123456');

  // 2. Tạo Dòng họ mẫu (Option A: 1 Dòng họ)
  console.log('2. Tạo Dòng họ mẫu...');
  const clan = await prisma.clan.create({
    data: {
      clanCode: 'CLAN-NGUYEN-DG',
      name: 'Dòng họ Nguyễn Tộc Đặng Giang',
    },
  });

  // 3. Tạo Chi phái
  console.log('3. Tạo các Chi phái...');
  const branchTruong = await prisma.branch.create({
    data: {
      clanId: clan.id,
      name: 'Chi Trưởng',
    },
  });

  const branchThu = await prisma.branch.create({
    data: {
      clanId: clan.id,
      name: 'Chi Thứ',
    },
  });

  // 4. Tạo các Tài khoản mẫu
  console.log('4. Tạo tài khoản mẫu...');
  const accTruongHo = await prisma.account.create({
    data: {
      accountCode: 'ACC00001',
      phone: '0901000001',
      email: 'truongho@giapha.vn',
      passwordHash: defaultPasswordHash,
      authType: AuthType.LOCAL,
      status: AccountStatus.ACTIVE,
    },
  });

  const accTruongChi = await prisma.account.create({
    data: {
      accountCode: 'ACC00002',
      phone: '0901000002',
      email: 'truongchi@giapha.vn',
      passwordHash: defaultPasswordHash,
      authType: AuthType.LOCAL,
      status: AccountStatus.ACTIVE,
    },
  });

  const accThanhVien = await prisma.account.create({
    data: {
      accountCode: 'ACC00003',
      phone: '0901000003',
      email: 'thanhvien@giapha.vn',
      passwordHash: defaultPasswordHash,
      authType: AuthType.LOCAL,
      status: AccountStatus.ACTIVE,
    },
  });

  const accKyThuatVien = await prisma.account.create({
    data: {
      accountCode: 'ACC00004',
      phone: '0901000004',
      email: 'kythuatvien@giapha.vn',
      passwordHash: defaultPasswordHash,
      authType: AuthType.LOCAL,
      status: AccountStatus.ACTIVE,
    },
  });

  // 5. Cấp vai trò (RoleAssignment)
  console.log('5. Phân quyền vai trò...');
  await prisma.roleAssignment.createMany({
    data: [
      {
        accountId: accTruongHo.id,
        clanId: clan.id,
        type: RoleType.CLAN_HEAD,
        branchId: null,
      },
      {
        accountId: accTruongChi.id,
        clanId: clan.id,
        type: RoleType.BRANCH_HEAD,
        branchId: branchTruong.id,
      },
      {
        accountId: accKyThuatVien.id,
        clanId: clan.id,
        type: RoleType.TECH_SUPPORT,
        branchId: null,
      },
    ],
  });

  // 6. Cấu hình TOTP mẫu cho Trưởng họ và Thành viên
  console.log('6. Tạo cấu hình TOTP mẫu...');
  const totpEncryptionKey = process.env.JWT_ACCESS_SECRET || 'local-development-secret-change-me';
  const sampleSecret = 'JBSWY3DPEHPK3PXP';
  const sampleEncrypted = encryptTotpSecret(sampleSecret, totpEncryptionKey);

  await prisma.totpCredential.createMany({
    data: [
      {
        accountId: accTruongHo.id,
        secretEncrypted: sampleEncrypted,
        verified: true,
      },
      {
        accountId: accThanhVien.id,
        secretEncrypted: sampleEncrypted,
        verified: true,
      },
    ],
  });

  // 7. Tạo Cây gia phả (Hồ sơ thành viên + Dâu/Rể)
  console.log('7. Tạo cây gia phả đa thế hệ...');

  // --- Đời 1: Thủy tổ ---
  const p1Khang = await prisma.memberProfile.create({
    data: {
      clanId: clan.id,
      fullName: 'Nguyễn Phúc Khang',
      gender: Gender.MALE,
      generation: 1,
      status: MemberStatus.DECEASED,
      birthDate: new Date('1910-01-01'),
      deathDate: new Date('1985-08-15'),
      deathCalendar: CalendarType.LUNAR,
      bio: 'Thủy tổ khai sáng dòng họ tại Đặng Giang',
    },
  });

  const p1Mo = await prisma.memberProfile.create({
    data: {
      clanId: clan.id,
      fullName: 'Trần Thị Mơ',
      gender: Gender.FEMALE,
      generation: 1,
      status: MemberStatus.DECEASED,
      birthDate: new Date('1912-05-10'),
      deathDate: new Date('1990-11-20'),
      deathCalendar: CalendarType.LUNAR,
      bio: 'Chính thất Cụ Nguyễn Phúc Khang',
    },
  });

  // --- Đời 2 ---
  const p2Thinh = await prisma.memberProfile.create({
    data: {
      clanId: clan.id,
      branchId: branchTruong.id,
      fullName: 'Nguyễn Phúc Thịnh',
      gender: Gender.MALE,
      generation: 2,
      status: MemberStatus.DECEASED,
      birthDate: new Date('1935-03-12'),
      deathDate: new Date('2010-04-05'),
      deathCalendar: CalendarType.LUNAR,
      bio: 'Cụ Trưởng nhánh Chi Trưởng',
    },
  });

  const p2Hoa = await prisma.memberProfile.create({
    data: {
      clanId: clan.id,
      branchId: branchTruong.id,
      fullName: 'Lê Thị Hoa',
      gender: Gender.FEMALE,
      generation: 2,
      status: MemberStatus.DECEASED,
      birthDate: new Date('1938-07-22'),
      deathDate: new Date('2015-09-18'),
      bio: 'Dâu trưởng - Vợ cụ Nguyễn Phúc Thịnh',
    },
  });

  const p2Loc = await prisma.memberProfile.create({
    data: {
      clanId: clan.id,
      branchId: branchThu.id,
      fullName: 'Nguyễn Phúc Lộc',
      gender: Gender.MALE,
      generation: 2,
      status: MemberStatus.ALIVE,
      birthDate: new Date('1942-10-15'),
      bio: 'Cụ Thứ phụ trách Chi Thứ',
    },
  });

  const p2Mai = await prisma.memberProfile.create({
    data: {
      clanId: clan.id,
      branchId: branchThu.id,
      fullName: 'Phạm Thị Mai',
      gender: Gender.FEMALE,
      generation: 2,
      status: MemberStatus.ALIVE,
      birthDate: new Date('1945-12-01'),
      bio: 'Dâu thứ - Vợ cụ Nguyễn Phúc Lộc',
    },
  });

  // --- Đời 3: Trưởng họ & Trưởng chi ---
  const p3An = await prisma.memberProfile.create({
    data: {
      clanId: clan.id,
      branchId: branchTruong.id,
      accountId: accTruongHo.id,
      fullName: 'Nguyễn Văn An',
      gender: Gender.MALE,
      generation: 3,
      status: MemberStatus.ALIVE,
      birthDate: new Date('1965-06-20'),
      bio: 'Đương kim Trưởng họ Nguyễn Tộc',
    },
  });

  const p3Cuc = await prisma.memberProfile.create({
    data: {
      clanId: clan.id,
      branchId: branchTruong.id,
      fullName: 'Hoàng Thị Cúc',
      gender: Gender.FEMALE,
      generation: 3,
      status: MemberStatus.ALIVE,
      birthDate: new Date('1968-08-14'),
      bio: 'Vợ Trưởng họ Nguyễn Văn An',
    },
  });

  const p3Binh = await prisma.memberProfile.create({
    data: {
      clanId: clan.id,
      branchId: branchTruong.id,
      accountId: accTruongChi.id,
      fullName: 'Nguyễn Văn Bình',
      gender: Gender.MALE,
      generation: 3,
      status: MemberStatus.ALIVE,
      birthDate: new Date('1970-02-18'),
      bio: 'Trưởng chi Chi Trưởng',
    },
  });

  const p3Lan = await prisma.memberProfile.create({
    data: {
      clanId: clan.id,
      branchId: branchTruong.id,
      fullName: 'Vũ Thị Lan',
      gender: Gender.FEMALE,
      generation: 3,
      status: MemberStatus.ALIVE,
      birthDate: new Date('1972-09-30'),
      bio: 'Vợ ông Nguyễn Văn Bình',
    },
  });

  // --- Đời 4: Thành viên trẻ ---
  const p4Dung = await prisma.memberProfile.create({
    data: {
      clanId: clan.id,
      branchId: branchTruong.id,
      accountId: accThanhVien.id,
      fullName: 'Nguyễn Văn Dũng',
      gender: Gender.MALE,
      generation: 4,
      status: MemberStatus.ALIVE,
      birthDate: new Date('1995-11-05'),
      bio: 'Thành viên đời 4 họ Nguyễn Tộc',
    },
  });

  const p4Hanh = await prisma.memberProfile.create({
    data: {
      clanId: clan.id,
      branchId: branchTruong.id,
      fullName: 'Nguyễn Thị Hạnh',
      gender: Gender.FEMALE,
      generation: 4,
      status: MemberStatus.ALIVE,
      birthDate: new Date('1998-04-12'),
      bio: 'Con gái Trưởng họ Nguyễn Văn An',
    },
  });

  // 8. Bảng liên kết tài khoản - hồ sơ (AccountProfileLink)
  console.log('8. Tạo AccountProfileLink theo chuẩn CSDL v1.2...');
  await prisma.accountProfileLink.createMany({
    data: [
      { accountId: accTruongHo.id, clanId: clan.id, profileId: p3An.id },
      { accountId: accTruongChi.id, clanId: clan.id, profileId: p3Binh.id },
      { accountId: accThanhVien.id, clanId: clan.id, profileId: p4Dung.id },
    ],
  });

  // 9. Thiết lập Quan hệ phả hệ (Huyết thống + Hôn nhân Dâu/Rể)
  console.log('9. Tạo quan hệ phả hệ (Huyết thống & Dâu/Rể ngang hàng)...');
  await prisma.relationship.createMany({
    data: [
      // Hôn nhân Đời 1
      { type: RelationType.SPOUSE, fromId: p1Khang.id, toId: p1Mo.id },

      // Cụ Khang/Mơ sinh Cụ Thịnh & Cụ Lộc (Đời 2)
      { type: RelationType.PARENT_CHILD, fromId: p1Khang.id, toId: p2Thinh.id },
      { type: RelationType.PARENT_CHILD, fromId: p1Mo.id, toId: p2Thinh.id },
      { type: RelationType.PARENT_CHILD, fromId: p1Khang.id, toId: p2Loc.id },
      { type: RelationType.PARENT_CHILD, fromId: p1Mo.id, toId: p2Loc.id },

      // Hôn nhân Đời 2
      { type: RelationType.SPOUSE, fromId: p2Thinh.id, toId: p2Hoa.id },
      { type: RelationType.SPOUSE, fromId: p2Loc.id, toId: p2Mai.id },

      // Cụ Thịnh/Hoa sinh ông An & ông Bình (Đời 3)
      { type: RelationType.PARENT_CHILD, fromId: p2Thinh.id, toId: p3An.id },
      { type: RelationType.PARENT_CHILD, fromId: p2Hoa.id, toId: p3An.id },
      { type: RelationType.PARENT_CHILD, fromId: p2Thinh.id, toId: p3Binh.id },
      { type: RelationType.PARENT_CHILD, fromId: p2Hoa.id, toId: p3Binh.id },

      // Hôn nhân Đời 3
      { type: RelationType.SPOUSE, fromId: p3An.id, toId: p3Cuc.id },
      { type: RelationType.SPOUSE, fromId: p3Binh.id, toId: p3Lan.id },

      // Ông An/bà Cúc sinh anh Dũng & chị Hạnh (Đời 4)
      { type: RelationType.PARENT_CHILD, fromId: p3An.id, toId: p4Dung.id },
      { type: RelationType.PARENT_CHILD, fromId: p3Cuc.id, toId: p4Dung.id },
      { type: RelationType.PARENT_CHILD, fromId: p3An.id, toId: p4Hanh.id },
      { type: RelationType.PARENT_CHILD, fromId: p3Cuc.id, toId: p4Hanh.id },
    ],
  });

  // 10. Tạo Quỹ và Bài viết mẫu
  console.log('10. Tạo Quỹ khuyến học và bài viết mẫu...');
  await prisma.fund.create({
    data: {
      clanId: clan.id,
      name: 'Quỹ Khuyến học Nguyễn Tộc',
      scope: FundScope.CLAN,
      openingBalance: 15000000,
    },
  });

  await prisma.post.create({
    data: {
      clanId: clan.id,
      authorId: accTruongHo.id,
      category: 'THONG_BAO',
      content: 'Chào mừng toàn thể con cháu dòng họ Nguyễn Tộc Đặng Giang đến với Cổng thông tin Gia phả số!',
      status: ContentStatus.PUBLISHED,
      pinned: true,
      official: true,
    },
  });

  console.log('=== Nạp dữ liệu mẫu thành công! ===');
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
