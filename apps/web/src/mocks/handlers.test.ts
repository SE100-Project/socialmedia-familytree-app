import { beforeEach, describe, expect, it } from 'vitest';
import type { BranchView, MemberProfile, Relationship } from '../lib/genealogy-api';
import type { Me } from '../lib/me';
import { mockApi, resetMockDb } from './handlers';

describe('Web Mock API - Stage 1 Vertical Flow (UC-01, UC-02, UC-07, UC-08, UC-10)', () => {
  beforeEach(() => {
    resetMockDb();
  });

  it('đăng nhập bằng identifier, lấy /auth/me, kiểm soát phân quyền chi và khóa lạc quan 409', async () => {
    const loginHead = await mockApi<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: '0901000001', password: 'Dev@123456' }),
    });
    const headToken = loginHead.accessToken;

    const me = await mockApi<Me>('/auth/me', {}, headToken);
    expect(me.profileId).toBeTruthy();
    expect(me.roles[0]?.type).toBe('CLAN_HEAD');

    const newBranch = await mockApi<BranchView>(
      '/branches',
      { method: 'POST', body: JSON.stringify({ name: 'Chi Ba' }) },
      headToken,
    );
    expect(newBranch.name).toBe('Chi Ba');

    // Trưởng chi không được tạo chi mới -> 403
    const loginBranchHead = await mockApi<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: '0901000002', password: 'Dev@123456' }),
    });
    await expect(
      mockApi(
        '/branches',
        { method: 'POST', body: JSON.stringify({ name: 'Chi Lậu' }) },
        loginBranchHead.accessToken,
      ),
    ).rejects.toMatchObject({ status: 403 });

    // Tạo hồ sơ, cập nhật thành công và chặn xung đột 409
    const created = await mockApi<MemberProfile>(
      '/profiles',
      {
        method: 'POST',
        body: JSON.stringify({
          branchId: newBranch.id,
          fullName: 'Nguyễn Minh Đức',
          gender: 'MALE',
          generation: 3,
        }),
      },
      headToken,
    );

    const updated = await mockApi<MemberProfile>(
      `/profiles/${created.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          expectedUpdatedAt: created.updatedAt,
          bio: 'Thành viên Chi Ba',
        }),
      },
      headToken,
    );
    expect(updated.bio).toBe('Thành viên Chi Ba');

    await expect(
      mockApi(
        `/profiles/${created.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ expectedUpdatedAt: created.updatedAt, fullName: 'Cũ' }),
        },
        headToken,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('cho phép khởi tạo dòng họ khi hệ thống trống (UC-07) và chặn vòng tổ tiên (UC-10)', async () => {
    resetMockDb({ emptyClan: true });

    const { accessToken } = await mockApi<{ accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: '0901000099', password: 'Dev@123456' }),
    });

    const init = await mockApi<{
      clan: { id: string; clanCode: string };
      ancestorProfile: MemberProfile;
      creatorProfile: MemberProfile;
    }>(
      '/clans',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Dòng họ Đặng',
          clanCode: 'CLAN-DANG-99',
          ancestor: { fullName: 'Đặng Cụ Tổ', gender: 'MALE', status: 'DECEASED' },
          creator: { fullName: 'Đặng Đăng Khoa', gender: 'MALE', generation: 2 },
        }),
      },
      accessToken,
    );
    expect(init.clan.clanCode).toBe('CLAN-DANG-99');

    const edge = await mockApi<Relationship>(
      '/relationships',
      {
        method: 'POST',
        body: JSON.stringify({
          type: 'PARENT_CHILD',
          fromId: init.ancestorProfile.id,
          toId: init.creatorProfile.id,
        }),
      },
      accessToken,
    );
    expect(edge.active).toBe(true);

    // Chặn vòng lặp tổ tiên ngược lại
    await expect(
      mockApi(
        '/relationships',
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'PARENT_CHILD',
            fromId: init.creatorProfile.id,
            toId: init.ancestorProfile.id,
          }),
        },
        accessToken,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
