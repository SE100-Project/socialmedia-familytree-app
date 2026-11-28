import { ApiError } from '../lib/api';
import type {
  BranchView,
  CreateClanPayload,
  CreateProfilePayload,
  CreateRelationshipPayload,
  MemberProfile,
  UpdateProfilePayload,
} from '../lib/genealogy-api';
import { createInitialMockState, type MockAccount } from './data';

let db = createInitialMockState();
let idCounter = 100;

export function resetMockDb(options?: { emptyClan?: boolean }) {
  db = createInitialMockState();
  idCounter = 100;
  if (options?.emptyClan) {
    db.clan = null;
    db.branches = [];
    db.profiles = [];
    db.relationships = [];
    db.accounts = db.accounts.map((acc) => ({
      ...acc,
      clanId: null,
      profileId: null,
      profileLinks: [],
      roles: [],
    }));
  }
}

function nextUuid(): string {
  idCounter += 1;
  return `99999999-9999-4999-8999-${String(idCounter).padStart(12, '0')}`;
}

function parseBody<T>(init?: RequestInit): T {
  if (!init?.body || typeof init.body !== 'string') return {} as T;
  return JSON.parse(init.body) as T;
}

function getCurrentAccount(token: string | null): MockAccount {
  if (!token) {
    throw new ApiError('Vui lòng đăng nhập để tiếp tục', 401);
  }
  const accId = token.replace(/^mock-token:/, '');
  const account = db.accounts.find((a) => a.id === accId);
  if (!account) {
    throw new ApiError('Phiên đăng nhập không hợp lệ', 401);
  }
  return account;
}

function isClanHeadAccount(acc: MockAccount): boolean {
  return acc.roles.some((r) => r.type === 'CLAN_HEAD' && r.clanId === acc.clanId);
}

function canManageBranchAccount(acc: MockAccount, branchId: string | null): boolean {
  if (isClanHeadAccount(acc)) return true;
  if (!branchId) return false;
  return acc.roles.some((r) => r.type === 'BRANCH_HEAD' && r.branchId === branchId);
}

function toBranchView(branch: (typeof db.branches)[number]): BranchView {
  const memberCount = db.profiles.filter(
    (p) => p.branchId === branch.id && p.status !== 'REMOVED',
  ).length;
  const headProfile = branch.headAccountId
    ? (db.profiles.find((p) => p.accountId === branch.headAccountId) ?? null)
    : null;
  return {
    id: branch.id,
    clanId: branch.clanId,
    name: branch.name,
    memberCount,
    branchHead: branch.headAccountId
      ? {
          accountId: branch.headAccountId,
          profileId: headProfile?.id ?? null,
          fullName: headProfile?.fullName ?? null,
        }
      : null,
  };
}

function isAncestor(ancestorId: string, descendantId: string): boolean {
  const parentsOf = new Map<string, string[]>();
  for (const rel of db.relationships) {
    if (rel.type !== 'PARENT_CHILD' || !rel.active) continue;
    const list = parentsOf.get(rel.toId) ?? [];
    list.push(rel.fromId);
    parentsOf.set(rel.toId, list);
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
}

export async function mockApi<T>(
  pathWithQuery: string,
  init: RequestInit = {},
  token: string | null = null,
): Promise<T> {
  const result = await executeMockApi(pathWithQuery, init, token);
  return structuredClone(result) as T;
}

async function executeMockApi<T>(
  pathWithQuery: string,
  init: RequestInit = {},
  token: string | null = null,
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const url = new URL(pathWithQuery, 'http://mock.local');
  const pathname = url.pathname;

  if (pathname === '/health' && method === 'GET') {
    return { status: 'ok (mock)' } as T;
  }

  if (pathname === '/auth/login' && method === 'POST') {
    const body = parseBody<{ identifier?: string; phone?: string; password?: string }>(init);
    const key = (body.identifier ?? body.phone ?? '').trim().toLowerCase();
    const account = db.accounts.find(
      (a) => a.phone?.toLowerCase() === key || a.email?.toLowerCase() === key,
    );
    if (!account || account.password !== body.password) {
      throw new ApiError('Sai số điện thoại/email hoặc mật khẩu', 401);
    }
    return { accessToken: `mock-token:${account.id}`, user: account } as T;
  }

  if (pathname === '/auth/register' && method === 'POST') {
    const body = parseBody<{ phone?: string; email?: string; password?: string }>(init);
    const phone = (body.phone ?? '').trim();
    if (!phone) throw new ApiError('Vui lòng nhập số điện thoại', 400);
    if (!body.password || body.password.length < 8) {
      throw new ApiError('Mật khẩu phải từ 8 ký tự trở lên', 400);
    }
    if (db.accounts.some((a) => a.phone === phone)) {
      throw new ApiError('Số điện thoại đã được đăng ký', 409);
    }
    const newAcc: MockAccount = {
      id: `acc-${++idCounter}`,
      accountCode: `ACC${String(idCounter).padStart(5, '0')}`,
      phone,
      email: body.email?.trim() || null,
      password: body.password,
      label: 'Tài khoản mới đăng ký',
      status: 'ACTIVE',
      profileId: null,
      clanId: null,
      profileLinks: [],
      roles: [],
    };
    db.accounts.push(newAcc);
    return { id: newAcc.id, accountCode: newAcc.accountCode, phone: newAcc.phone } as T;
  }

  if (pathname === '/auth/me' && method === 'GET') {
    const account = getCurrentAccount(token);
    const { password: _password, label: _label, ...publicMe } = account;
    return publicMe as T;
  }

  const user = getCurrentAccount(token);

  if (pathname === '/clans' && method === 'POST') {
    const body = parseBody<CreateClanPayload>(init);
    if (db.clan) {
      throw new ApiError('Hệ thống đã khởi tạo dòng họ, không thể khởi tạo lại', 409);
    }
    if (user.profileId || user.clanId) {
      throw new ApiError('Tài khoản của bạn đã liên kết với một hồ sơ dòng họ', 409);
    }
    const now = new Date().toISOString();
    const clanId = nextUuid();
    db.clan = {
      id: clanId,
      clanCode: (body.clanCode?.trim() || `CLAN-${idCounter}`).toUpperCase(),
      name: body.name.trim(),
      createdAt: now,
    };
    const ancestorProfile: MemberProfile = {
      id: nextUuid(),
      clanId,
      branchId: null,
      accountId: null,
      fullName: body.ancestor.fullName.trim(),
      gender: body.ancestor.gender,
      bio: body.ancestor.bio?.trim() || null,
      birthDate: body.ancestor.birthDate ?? null,
      deathDate: body.ancestor.deathDate ?? null,
      deathCalendar: body.ancestor.deathCalendar ?? null,
      status: body.ancestor.status ?? 'DECEASED',
      generation: 1,
      createdAt: now,
      updatedAt: now,
    };
    const creatorProfile: MemberProfile = {
      id: nextUuid(),
      clanId,
      branchId: null,
      accountId: user.id,
      fullName: body.creator.fullName.trim(),
      gender: body.creator.gender,
      bio: body.creator.bio?.trim() || null,
      birthDate: body.creator.birthDate ?? null,
      deathDate: null,
      deathCalendar: null,
      status: 'ALIVE',
      generation: body.creator.generation ?? 2,
      createdAt: now,
      updatedAt: now,
    };
    db.profiles.push(ancestorProfile, creatorProfile);
    user.clanId = clanId;
    user.profileId = creatorProfile.id;
    user.profileLinks = [{ clanId, profileId: creatorProfile.id }];
    user.roles = [{ type: 'CLAN_HEAD', clanId, branchId: null }];
    return {
      clan: db.clan,
      ancestorProfile,
      creatorProfile,
      role: 'CLAN_HEAD',
    } as T;
  }

  if (!user.clanId || !user.profileId || !db.clan) {
    throw new ApiError('Bạn chưa liên kết hồ sơ thành viên trong dòng họ', 403);
  }

  if (pathname === '/clans/current' && method === 'GET') {
    return db.clan as T;
  }

  if (pathname === '/branches' && method === 'GET') {
    return { items: db.branches.map(toBranchView), nextCursor: null } as T;
  }

  if (pathname === '/branches' && method === 'POST') {
    if (!isClanHeadAccount(user)) {
      throw new ApiError('Chỉ Trưởng họ mới có quyền tạo chi mới', 403);
    }
    const body = parseBody<{ name?: string }>(init);
    const name = (body.name ?? '').trim();
    if (!name) throw new ApiError('Tên chi không được để trống', 400);
    if (db.branches.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
      throw new ApiError(`Chi "${name}" đã tồn tại trong dòng họ`, 409);
    }
    const created = { id: nextUuid(), clanId: user.clanId, name, headAccountId: null };
    db.branches.push(created);
    return toBranchView(created) as T;
  }

  const branchMatch = pathname.match(/^\/branches\/([^/]+)$/);
  if (branchMatch && method === 'PATCH') {
    if (!isClanHeadAccount(user)) {
      throw new ApiError('Chỉ Trưởng họ mới có quyền chỉnh sửa chi', 403);
    }
    const branchId = branchMatch[1];
    const branch = db.branches.find((b) => b.id === branchId);
    if (!branch) throw new ApiError('Không tìm thấy chi trong dòng họ', 404);
    const body = parseBody<{ name?: string; branchHeadProfileId?: string | null }>(init);
    if (body.name !== undefined) {
      const nextName = body.name.trim();
      if (!nextName) throw new ApiError('Tên chi không được để trống', 400);
      if (
        db.branches.some(
          (b) => b.id !== branchId && b.name.toLowerCase() === nextName.toLowerCase(),
        )
      ) {
        throw new ApiError(`Chi "${nextName}" đã tồn tại trong dòng họ`, 409);
      }
      branch.name = nextName;
    }
    if (body.branchHeadProfileId !== undefined) {
      if (body.branchHeadProfileId === null) {
        if (branch.headAccountId) {
          const oldAcc = db.accounts.find((a) => a.id === branch.headAccountId);
          if (oldAcc) {
            oldAcc.roles = oldAcc.roles.filter(
              (r) => !(r.type === 'BRANCH_HEAD' && r.branchId === branchId),
            );
          }
        }
        branch.headAccountId = null;
      } else {
        const target = db.profiles.find((p) => p.id === body.branchHeadProfileId);
        if (!target) throw new ApiError('Không tìm thấy hồ sơ Trưởng chi được chỉ định', 404);
        if (target.status !== 'ALIVE') {
          throw new ApiError('Chỉ có thể chỉ định thành viên đang còn sống làm Trưởng chi', 400);
        }
        if (!target.accountId) {
          throw new ApiError('Hồ sơ được chỉ định Trưởng chi phải đã liên kết tài khoản', 400);
        }
        if (target.branchId && target.branchId !== branchId) {
          throw new ApiError(
            'Thành viên đang thuộc chi khác, không thể chỉ định làm Trưởng chi',
            400,
          );
        }
        if (db.branches.some((b) => b.id !== branchId && b.headAccountId === target.accountId)) {
          throw new ApiError('Thành viên này đang giữ vai trò Trưởng chi ở một chi khác', 400);
        }
        if (branch.headAccountId && branch.headAccountId !== target.accountId) {
          const oldAcc = db.accounts.find((a) => a.id === branch.headAccountId);
          if (oldAcc) {
            oldAcc.roles = oldAcc.roles.filter(
              (r) => !(r.type === 'BRANCH_HEAD' && r.branchId === branchId),
            );
          }
        }
        target.branchId = branchId;
        branch.headAccountId = target.accountId;
        const nextAcc = db.accounts.find((a) => a.id === target.accountId);
        if (
          nextAcc &&
          !nextAcc.roles.some((r) => r.type === 'BRANCH_HEAD' && r.branchId === branchId)
        ) {
          nextAcc.roles.push({ type: 'BRANCH_HEAD', clanId: user.clanId, branchId });
        }
      }
    }
    return toBranchView(branch) as T;
  }

  if (pathname === '/profiles' && method === 'GET') {
    const branchId = url.searchParams.get('branchId');
    const gen = url.searchParams.get('generation');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search')?.trim().toLowerCase();
    const items = db.profiles.filter((p) => {
      if (branchId && p.branchId !== branchId) return false;
      if (gen && p.generation !== Number(gen)) return false;
      if (status && p.status !== status) return false;
      if (search && !p.fullName.toLowerCase().includes(search)) return false;
      return true;
    });
    return { items, nextCursor: null } as T;
  }

  if (pathname === '/profiles' && method === 'POST') {
    const body = parseBody<CreateProfilePayload>(init);
    const branchId = body.branchId ?? null;
    if (!canManageBranchAccount(user, branchId)) {
      throw new ApiError('Bạn không có quyền tạo hồ sơ ngoài phạm vi chi được phân công', 403);
    }
    const fullName = (body.fullName ?? '').trim();
    if (!fullName) throw new ApiError('Họ tên không được để trống', 400);
    const status = body.status ?? 'ALIVE';
    if (status === 'ALIVE' && body.deathDate) {
      throw new ApiError('Hồ sơ còn sống (ALIVE) không thể có ngày mất', 400);
    }
    const now = new Date().toISOString();
    const created: MemberProfile = {
      id: nextUuid(),
      clanId: user.clanId,
      branchId,
      accountId: null,
      fullName,
      gender: body.gender,
      bio: body.bio?.trim() || null,
      birthDate: body.birthDate ?? null,
      deathDate: body.deathDate ?? null,
      deathCalendar: status === 'DECEASED' ? (body.deathCalendar ?? null) : null,
      status,
      generation: body.generation ?? null,
      createdAt: now,
      updatedAt: now,
    };
    db.profiles.push(created);
    return created as T;
  }

  const profileMatch = pathname.match(/^\/profiles\/([^/]+)$/);
  if (profileMatch && method === 'GET') {
    const found = db.profiles.find((p) => p.id === profileMatch[1]);
    if (!found) throw new ApiError('Không tìm thấy hồ sơ thành viên', 404);
    return found as T;
  }

  if (profileMatch && method === 'PATCH') {
    const found = db.profiles.find((p) => p.id === profileMatch[1]);
    if (!found) throw new ApiError('Không tìm thấy hồ sơ thành viên', 404);
    if (!canManageBranchAccount(user, found.branchId)) {
      throw new ApiError('Bạn không có quyền chỉnh sửa hồ sơ ngoài chi mình', 403);
    }
    if (found.status === 'REMOVED') {
      throw new ApiError('Không thể chỉnh sửa hồ sơ đã bị xóa mềm', 400);
    }
    const body = parseBody<UpdateProfilePayload>(init);
    if (body.expectedUpdatedAt !== found.updatedAt) {
      throw new ApiError('Hồ sơ đã được người khác cập nhật, vui lòng tải lại trước khi lưu', 409);
    }
    if (body.branchId !== undefined && body.branchId !== found.branchId) {
      if (!canManageBranchAccount(user, body.branchId)) {
        throw new ApiError('Bạn không có quyền chuyển hồ sơ sang chi khác', 403);
      }
      found.branchId = body.branchId;
    }
    if (body.fullName !== undefined) found.fullName = body.fullName.trim();
    if (body.gender !== undefined) found.gender = body.gender;
    if (body.birthDate !== undefined) found.birthDate = body.birthDate;
    if (body.deathDate !== undefined) found.deathDate = body.deathDate;
    const nextStatus = body.status ?? found.status;
    if (nextStatus === 'ALIVE' && found.deathDate && body.deathDate === undefined) {
      found.deathDate = null;
    }
    if (nextStatus === 'ALIVE' && found.deathDate) {
      throw new ApiError('Hồ sơ còn sống (ALIVE) không thể có ngày mất', 400);
    }
    if (
      found.birthDate &&
      found.deathDate &&
      found.deathDate.slice(0, 10) < found.birthDate.slice(0, 10)
    ) {
      throw new ApiError('Ngày mất không được nhỏ hơn ngày sinh', 400);
    }
    if (
      nextStatus === 'DECEASED' &&
      found.accountId &&
      db.accounts.some(
        (a) => a.id === found.accountId && a.roles.some((r) => r.type === 'CLAN_HEAD'),
      )
    ) {
      throw new ApiError(
        'Không thể chuyển hồ sơ Trưởng họ đang đương nhiệm sang trạng thái Đã mất trước khi chuyển giao vai trò',
        400,
      );
    }

    const prevBranchId = found.branchId;
    if (body.branchId !== undefined) found.branchId = body.branchId;
    const branchChanged = body.branchId !== undefined && body.branchId !== prevBranchId;
    if (found.accountId && (nextStatus === 'DECEASED' || branchChanged)) {
      const targetAcc = db.accounts.find((a) => a.id === found.accountId);
      for (const b of db.branches) {
        if (
          b.headAccountId === found.accountId &&
          (nextStatus === 'DECEASED' || b.id === prevBranchId)
        ) {
          b.headAccountId = null;
        }
      }
      if (targetAcc) {
        targetAcc.roles = targetAcc.roles.filter(
          (r) =>
            !(
              r.type === 'BRANCH_HEAD' &&
              (nextStatus === 'DECEASED' || r.branchId === prevBranchId)
            ),
        );
      }
    }

    found.status = nextStatus;
    if (body.generation !== undefined) found.generation = body.generation;
    if (body.bio !== undefined) found.bio = body.bio?.trim() || null;
    found.deathCalendar =
      nextStatus === 'ALIVE'
        ? null
        : body.deathCalendar !== undefined
          ? body.deathCalendar
          : found.deathCalendar;
    found.updatedAt = new Date(Date.now() + ++idCounter).toISOString();
    return { ...found } as T;
  }

  if (profileMatch && method === 'DELETE') {
    const found = db.profiles.find((p) => p.id === profileMatch[1]);
    if (!found) throw new ApiError('Không tìm thấy hồ sơ thành viên', 404);
    if (!canManageBranchAccount(user, found.branchId)) {
      throw new ApiError('Bạn không có quyền xóa hồ sơ ngoài chi mình', 403);
    }
    if (found.status === 'REMOVED') {
      throw new ApiError('Hồ sơ đã được xóa mềm trước đó', 400);
    }
    if (
      found.accountId &&
      db.accounts.some(
        (a) => a.id === found.accountId && a.roles.some((r) => r.type === 'CLAN_HEAD'),
      )
    ) {
      throw new ApiError('Không thể xóa mềm hồ sơ của Trưởng họ đang đương nhiệm', 400);
    }
    const expected = url.searchParams.get('expectedUpdatedAt');
    if (expected && expected !== found.updatedAt) {
      throw new ApiError('Hồ sơ đã được cập nhật bởi thao tác khác, vui lòng tải lại', 409);
    }
    if (found.accountId) {
      for (const b of db.branches) {
        if (b.headAccountId === found.accountId) b.headAccountId = null;
      }
      const targetAcc = db.accounts.find((a) => a.id === found.accountId);
      if (targetAcc) {
        targetAcc.roles = targetAcc.roles.filter((r) => r.type !== 'BRANCH_HEAD');
      }
    }
    found.status = 'REMOVED';
    found.updatedAt = new Date(Date.now() + ++idCounter).toISOString();
    return { ...found } as T;
  }

  if (pathname === '/relationships' && method === 'GET') {
    const profileId = url.searchParams.get('profileId');
    const items = db.relationships.filter(
      (r) => r.active && (!profileId || r.fromId === profileId || r.toId === profileId),
    );
    return items as T;
  }

  if (pathname === '/relationships' && method === 'POST') {
    const body = parseBody<CreateRelationshipPayload>(init);
    if (body.fromId === body.toId) {
      throw new ApiError('Không thể tạo quan hệ với chính mình', 400);
    }
    const fromP = db.profiles.find((p) => p.id === body.fromId);
    const toP = db.profiles.find((p) => p.id === body.toId);
    if (!fromP || !toP) {
      throw new ApiError('Hồ sơ không tồn tại trong dòng họ', 400);
    }
    if (fromP.status === 'REMOVED' || toP.status === 'REMOVED') {
      throw new ApiError('Không thể tạo quan hệ với hồ sơ đã bị xóa mềm', 400);
    }
    if (
      !canManageBranchAccount(user, fromP.branchId) ||
      !canManageBranchAccount(user, toP.branchId)
    ) {
      throw new ApiError('Bạn chỉ được thêm quan hệ trong phạm vi chi mình quản lý', 403);
    }
    if (body.type === 'PARENT_CHILD') {
      if (
        db.relationships.some(
          (r) => r.type === 'PARENT_CHILD' && r.fromId === body.fromId && r.toId === body.toId,
        )
      ) {
        throw new ApiError('Quan hệ cha/mẹ - con này đã tồn tại', 409);
      }
      if (
        db.relationships.some(
          (r) =>
            r.active &&
            r.type === 'SPOUSE' &&
            ((r.fromId === body.fromId && r.toId === body.toId) ||
              (r.fromId === body.toId && r.toId === body.fromId)),
        )
      ) {
        throw new ApiError(
          'Hai hồ sơ đang có quan hệ vợ/chồng, không thể tạo quan hệ cha/mẹ - con',
          400,
        );
      }
      if (
        db.relationships.some(
          (r) =>
            r.active &&
            r.type === 'PARENT_CHILD' &&
            r.fromId === body.toId &&
            r.toId === body.fromId,
        ) ||
        isAncestor(body.toId, body.fromId)
      ) {
        throw new ApiError('Quan hệ tạo vòng lặp tổ tiên', 400);
      }
      if (fromP.generation !== null && toP.generation === null) {
        toP.generation = fromP.generation + 1;
      }
    } else {
      if (
        db.relationships.some(
          (r) =>
            r.type === 'SPOUSE' &&
            ((r.fromId === body.fromId && r.toId === body.toId) ||
              (r.fromId === body.toId && r.toId === body.fromId)),
        )
      ) {
        throw new ApiError('Quan hệ vợ/chồng này đã tồn tại', 409);
      }
      if (
        db.relationships.some(
          (r) =>
            r.active &&
            r.type === 'PARENT_CHILD' &&
            ((r.fromId === body.fromId && r.toId === body.toId) ||
              (r.fromId === body.toId && r.toId === body.fromId)),
        ) ||
        isAncestor(body.fromId, body.toId) ||
        isAncestor(body.toId, body.fromId)
      ) {
        throw new ApiError(
          'Không thể tạo quan hệ vợ/chồng giữa hai người có quan hệ huyết thống trực hệ',
          400,
        );
      }
      if (fromP.generation !== null && toP.generation === null) {
        toP.generation = fromP.generation;
      } else if (toP.generation !== null && fromP.generation === null) {
        fromP.generation = toP.generation;
      }
    }
    const created = {
      id: nextUuid(),
      type: body.type,
      fromId: body.fromId,
      toId: body.toId,
      startDate: body.startDate ?? null,
      active: true,
    };
    db.relationships.push(created);
    return created as T;
  }

  throw new ApiError(`Mock chưa hỗ trợ ${method} ${pathname}`, 404);
}
