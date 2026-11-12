export type MockUser = { id: string; role: string; profile?: { displayName: string } | null };
export const mockUsers = { onboarded: { id: 'mock-1', role: 'MEMBER', profile: { displayName: 'Nguyễn Văn A' } }, pending: { id: 'mock-2', role: 'MEMBER', profile: null } } satisfies Record<string, MockUser>;
export type MockTableRow = { id: number; name: string; status: string };
export const mockRows: MockTableRow[] = [{ id: 1, name: 'Gia đình Nguyễn', status: 'Hoạt động' }, { id: 2, name: 'Gia đình Trần', status: 'Chờ duyệt' }];
