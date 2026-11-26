// Client mỏng gọi REST API. Token lưu tạm trong bộ nhớ + sessionStorage (cân nhắc cookie httpOnly ở bản sau).
let token: string | null = null;
try {
  token = sessionStorage.getItem('accessToken');
} catch {
  /* sessionStorage có thể bị chặn */
}

const authListeners = new Set<() => void>();

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getToken(): string | null {
  return token;
}

export function setToken(t: string | null) {
  token = t;
  try {
    if (t) sessionStorage.setItem('accessToken', t);
    else sessionStorage.removeItem('accessToken');
  } catch {
    /* bỏ qua */
  }
  authListeners.forEach((listener) => listener());
}

export function onAuthChange(listener: () => void) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

export function isMockMode(): boolean {
  return import.meta.env.VITE_USE_MOCK === 'true';
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (isMockMode()) {
    try {
      const { mockApi } = await import('../mocks/handlers');
      return await mockApi<T>(path, init, token);
    } catch (error) {
      if ((error as { status?: number }).status === 401) setToken(null);
      throw error;
    }
  }
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401) setToken(null);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const rawMsg = body.message;
    const message = Array.isArray(rawMsg)
      ? rawMsg.join(', ')
      : typeof rawMsg === 'string'
        ? rawMsg
        : `Lỗi ${res.status}`;
    throw new ApiError(message, res.status, typeof body.code === 'string' ? body.code : undefined);
  }
  return res.json() as Promise<T>;
}
