import type { Me } from '../lib/me';
import type { Clan, MemberProfile, Relationship } from '../lib/genealogy-api';

export type MockTableRow = { id: number; name: string; status: string };
export const mockRows: MockTableRow[] = [
  { id: 1, name: 'Gia đình Nguyễn', status: 'Hoạt động' },
  { id: 2, name: 'Gia đình Trần', status: 'Chờ duyệt' },
];

export interface MockAccount extends Me {
  password: string;
  label: string;
}

export interface MockBranchRecord {
  id: string;
  clanId: string;
  name: string;
  headAccountId: string | null;
}

export const DEMO_CLAN_ID = '11111111-1111-4111-8111-111111111111';
export const DEMO_BRANCH_TRUONG_ID = '22222222-2222-4222-8222-222222222201';
export const DEMO_BRANCH_THU_ID = '22222222-2222-4222-8222-222222222202';

export function createInitialMockState(): {
  clan: Clan | null;
  branches: MockBranchRecord[];
  profiles: MemberProfile[];
  relationships: Relationship[];
  accounts: MockAccount[];
} {
  const now = '2026-10-25T08:00:00.000Z';

  const clan: Clan = {
    id: DEMO_CLAN_ID,
    clanCode: 'CLAN-NGUYEN-DG',
    name: 'Dòng họ Nguyễn Tộc Đặng Giang',
    createdAt: now,
  };

  const branches: MockBranchRecord[] = [
    {
      id: DEMO_BRANCH_TRUONG_ID,
      clanId: DEMO_CLAN_ID,
      name: 'Chi Trưởng',
      headAccountId: 'acc-truong-chi',
    },
    {
      id: DEMO_BRANCH_THU_ID,
      clanId: DEMO_CLAN_ID,
      name: 'Chi Thứ',
      headAccountId: null,
    },
  ];

  const profiles: MemberProfile[] = [
    {
      id: '33333333-3333-4333-8333-333333333301',
      clanId: DEMO_CLAN_ID,
      branchId: null,
      accountId: null,
      fullName: 'Nguyễn Phúc Khang',
      gender: 'MALE',
      bio: 'Thủy tổ dòng họ Nguyễn Tộc Đặng Giang.',
      birthDate: '1910-01-01T00:00:00.000Z',
      deathDate: '1985-08-15T00:00:00.000Z',
      deathCalendar: 'LUNAR',
      status: 'DECEASED',
      generation: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '33333333-3333-4333-8333-333333333302',
      clanId: DEMO_CLAN_ID,
      branchId: null,
      accountId: null,
      fullName: 'Trần Thị Mơ',
      gender: 'FEMALE',
      bio: 'Phu nhân Thủy tổ.',
      birthDate: '1915-03-10T00:00:00.000Z',
      deathDate: '1992-04-20T00:00:00.000Z',
      deathCalendar: 'LUNAR',
      status: 'DECEASED',
      generation: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '33333333-3333-4333-8333-333333333303',
      clanId: DEMO_CLAN_ID,
      branchId: DEMO_BRANCH_TRUONG_ID,
      accountId: null,
      fullName: 'Nguyễn Phúc Thịnh',
      gender: 'MALE',
      bio: 'Trưởng nam đời 2, khai lập Chi Trưởng.',
      birthDate: '1938-05-12T00:00:00.000Z',
      deathDate: '2012-11-02T00:00:00.000Z',
      deathCalendar: 'LUNAR',
      status: 'DECEASED',
      generation: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '33333333-3333-4333-8333-333333333304',
      clanId: DEMO_CLAN_ID,
      branchId: DEMO_BRANCH_THU_ID,
      accountId: null,
      fullName: 'Nguyễn Phúc Khải',
      gender: 'MALE',
      bio: 'Thứ nam đời 2, khai lập Chi Thứ.',
      birthDate: '1942-09-18T00:00:00.000Z',
      deathDate: null,
      deathCalendar: null,
      status: 'ALIVE',
      generation: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '33333333-3333-4333-8333-333333333305',
      clanId: DEMO_CLAN_ID,
      branchId: DEMO_BRANCH_TRUONG_ID,
      accountId: 'acc-truong-ho',
      fullName: 'Nguyễn Minh Quân',
      gender: 'MALE',
      bio: 'Trưởng họ đương nhiệm.',
      birthDate: '1970-06-20T00:00:00.000Z',
      deathDate: null,
      deathCalendar: null,
      status: 'ALIVE',
      generation: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '33333333-3333-4333-8333-333333333306',
      clanId: DEMO_CLAN_ID,
      branchId: DEMO_BRANCH_TRUONG_ID,
      accountId: 'acc-truong-chi',
      fullName: 'Nguyễn Quốc Hưng',
      gender: 'MALE',
      bio: 'Trưởng Chi Trưởng.',
      birthDate: '1974-02-14T00:00:00.000Z',
      deathDate: null,
      deathCalendar: null,
      status: 'ALIVE',
      generation: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '33333333-3333-4333-8333-333333333307',
      clanId: DEMO_CLAN_ID,
      branchId: DEMO_BRANCH_THU_ID,
      accountId: 'acc-thanh-vien',
      fullName: 'Nguyễn Thảo Vy',
      gender: 'FEMALE',
      bio: 'Thành viên Chi Thứ.',
      birthDate: '1998-08-22T00:00:00.000Z',
      deathDate: null,
      deathCalendar: null,
      status: 'ALIVE',
      generation: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: '33333333-3333-4333-8333-333333333308',
      clanId: DEMO_CLAN_ID,
      branchId: DEMO_BRANCH_TRUONG_ID,
      accountId: null,
      fullName: 'Nguyễn Gia Bảo',
      gender: 'MALE',
      bio: 'Thế hệ trẻ đời 4.',
      birthDate: '2003-04-11T00:00:00.000Z',
      deathDate: null,
      deathCalendar: null,
      status: 'ALIVE',
      generation: 4,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const relationships: Relationship[] = [
    {
      id: '44444444-4444-4444-8444-444444444401',
      type: 'SPOUSE',
      fromId: profiles[0].id,
      toId: profiles[1].id,
      startDate: '1935-01-01T00:00:00.000Z',
      active: true,
    },
    {
      id: '44444444-4444-4444-8444-444444444402',
      type: 'PARENT_CHILD',
      fromId: profiles[0].id,
      toId: profiles[2].id,
      startDate: null,
      active: true,
    },
    {
      id: '44444444-4444-4444-8444-444444444403',
      type: 'PARENT_CHILD',
      fromId: profiles[0].id,
      toId: profiles[3].id,
      startDate: null,
      active: true,
    },
    {
      id: '44444444-4444-4444-8444-444444444404',
      type: 'PARENT_CHILD',
      fromId: profiles[2].id,
      toId: profiles[4].id,
      startDate: null,
      active: true,
    },
    {
      id: '44444444-4444-4444-8444-444444444405',
      type: 'PARENT_CHILD',
      fromId: profiles[2].id,
      toId: profiles[5].id,
      startDate: null,
      active: true,
    },
    {
      id: '44444444-4444-4444-8444-444444444406',
      type: 'PARENT_CHILD',
      fromId: profiles[3].id,
      toId: profiles[6].id,
      startDate: null,
      active: true,
    },
    {
      id: '44444444-4444-4444-8444-444444444407',
      type: 'PARENT_CHILD',
      fromId: profiles[4].id,
      toId: profiles[7].id,
      startDate: null,
      active: true,
    },
  ];

  const accounts: MockAccount[] = [
    {
      id: 'acc-truong-ho',
      accountCode: 'ACC00001',
      phone: '0901000001',
      email: 'truongho@giapha.vn',
      password: 'Dev@123456',
      label: 'Trưởng họ (toàn quyền)',
      status: 'ACTIVE',
      profileId: profiles[4].id,
      clanId: DEMO_CLAN_ID,
      profileLinks: [{ clanId: DEMO_CLAN_ID, profileId: profiles[4].id }],
      roles: [{ type: 'CLAN_HEAD', clanId: DEMO_CLAN_ID, branchId: null }],
    },
    {
      id: 'acc-truong-chi',
      accountCode: 'ACC00002',
      phone: '0901000002',
      email: 'truongchi@giapha.vn',
      password: 'Dev@123456',
      label: 'Trưởng Chi Trưởng',
      status: 'ACTIVE',
      profileId: profiles[5].id,
      clanId: DEMO_CLAN_ID,
      profileLinks: [{ clanId: DEMO_CLAN_ID, profileId: profiles[5].id }],
      roles: [{ type: 'BRANCH_HEAD', clanId: DEMO_CLAN_ID, branchId: DEMO_BRANCH_TRUONG_ID }],
    },
    {
      id: 'acc-thanh-vien',
      accountCode: 'ACC00003',
      phone: '0901000003',
      email: 'thanhvien@giapha.vn',
      password: 'Dev@123456',
      label: 'Thành viên Chi Thứ',
      status: 'ACTIVE',
      profileId: profiles[6].id,
      clanId: DEMO_CLAN_ID,
      profileLinks: [{ clanId: DEMO_CLAN_ID, profileId: profiles[6].id }],
      roles: [],
    },
    {
      id: 'acc-moi',
      accountCode: 'ACC00099',
      phone: '0901000099',
      email: 'nguoidungmoi@giapha.vn',
      password: 'Dev@123456',
      label: 'Tài khoản mới (chưa vào dòng họ)',
      status: 'ACTIVE',
      profileId: null,
      clanId: null,
      profileLinks: [],
      roles: [],
    },
  ];

  return { clan, branches, profiles, relationships, accounts };
}
