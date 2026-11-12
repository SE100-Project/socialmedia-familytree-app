import { mockUsers, type MockUser } from './data';
export type MockScenario = 'unauthenticated' | 'pending' | 'onboarded';
export const MOCK_SCENARIO: MockScenario = 'onboarded';
export async function mockApi<T>(path: string): Promise<T> { await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 200)); if (path === '/auth/me') { if (MOCK_SCENARIO === 'unauthenticated') throw Object.assign(new Error('Chưa đăng nhập'), { status: 401 }); if (MOCK_SCENARIO === 'pending') return mockUsers.pending as T; return mockUsers.onboarded as T; } throw new Error(`Mock chưa hỗ trợ ${path}`); }
export function isMockUnauthorized(error: unknown): error is Error & { status: number } { return error instanceof Error && 'status' in error && (error as Error & { status: number }).status === 401; }
