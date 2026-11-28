import { api } from './api';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type MemberStatus = 'ALIVE' | 'DECEASED' | 'REMOVED';
export type CalendarType = 'SOLAR' | 'LUNAR';
export type RelationType = 'PARENT_CHILD' | 'SPOUSE';

export interface Clan {
  id: string;
  clanCode: string;
  name: string;
  createdAt: string;
}

export interface BranchHeadSummary {
  accountId: string;
  profileId: string | null;
  fullName: string | null;
}

export interface BranchView {
  id: string;
  clanId: string;
  name: string;
  memberCount: number;
  branchHead: BranchHeadSummary | null;
}

export interface MemberProfile {
  id: string;
  clanId: string;
  branchId: string | null;
  accountId: string | null;
  fullName: string;
  gender: Gender;
  bio: string | null;
  birthDate: string | null;
  deathDate: string | null;
  deathCalendar: CalendarType | null;
  status: MemberStatus;
  generation: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Relationship {
  id: string;
  type: RelationType;
  fromId: string;
  toId: string;
  startDate: string | null;
  active: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CreateClanPayload {
  name: string;
  clanCode?: string;
  ancestor: {
    fullName: string;
    gender: Gender;
    birthDate?: string;
    deathDate?: string;
    deathCalendar?: CalendarType;
    status?: 'ALIVE' | 'DECEASED';
    bio?: string;
  };
  creator: {
    fullName: string;
    gender: Gender;
    birthDate?: string;
    generation?: number;
    bio?: string;
  };
}

export interface CreateProfilePayload {
  branchId?: string;
  fullName: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  deathCalendar?: CalendarType;
  status?: 'ALIVE' | 'DECEASED';
  generation?: number;
  bio?: string;
}

export interface UpdateProfilePayload {
  expectedUpdatedAt: string;
  branchId?: string | null;
  fullName?: string;
  gender?: Gender;
  birthDate?: string | null;
  deathDate?: string | null;
  deathCalendar?: CalendarType | null;
  status?: 'ALIVE' | 'DECEASED';
  generation?: number | null;
  bio?: string | null;
}

export interface CreateRelationshipPayload {
  type: RelationType;
  fromId: string;
  toId: string;
  startDate?: string;
}

export const genealogyApi = {
  getCurrentClan: () => api<Clan>('/clans/current'),

  createClan: (payload: CreateClanPayload) =>
    api<{
      clan: Clan;
      ancestorProfile: MemberProfile;
      creatorProfile: MemberProfile;
      role: 'CLAN_HEAD';
    }>('/clans', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  listBranches: (limit = 50) => api<PaginatedResult<BranchView>>(`/branches?limit=${limit}`),

  createBranch: (name: string) =>
    api<BranchView>('/branches', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateBranch: (id: string, payload: { name?: string; branchHeadProfileId?: string | null }) =>
    api<BranchView>(`/branches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  listProfiles: (
    params: {
      limit?: number;
      branchId?: string;
      generation?: number;
      status?: MemberStatus;
      search?: string;
    } = {},
  ) => {
    const qs = new URLSearchParams();
    qs.set('limit', String(params.limit ?? 50));
    if (params.branchId) qs.set('branchId', params.branchId);
    if (params.generation) qs.set('generation', String(params.generation));
    if (params.status) qs.set('status', params.status);
    if (params.search?.trim()) qs.set('search', params.search.trim());
    return api<PaginatedResult<MemberProfile>>(`/profiles?${qs.toString()}`);
  },

  getProfile: (id: string) => api<MemberProfile>(`/profiles/${id}`),

  createProfile: (payload: CreateProfilePayload) =>
    api<MemberProfile>('/profiles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateProfile: (id: string, payload: UpdateProfilePayload) =>
    api<MemberProfile>(`/profiles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  softDeleteProfile: (id: string, expectedUpdatedAt?: string) => {
    const qs = expectedUpdatedAt
      ? `?expectedUpdatedAt=${encodeURIComponent(expectedUpdatedAt)}`
      : '';
    return api<MemberProfile>(`/profiles/${id}${qs}`, { method: 'DELETE' });
  },

  listRelationships: (profileId?: string) => {
    const qs = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
    return api<Relationship[]>(`/relationships${qs}`);
  },

  createRelationship: (payload: CreateRelationshipPayload) =>
    api<Relationship>('/relationships', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
