// Client mỏng gọi REST API. Token lưu tạm trong bộ nhớ + sessionStorage (cân nhắc cookie httpOnly ở bản sau).
let token: string | null = null;
try {
  token = sessionStorage.getItem('accessToken');
} catch {
  /* sessionStorage có thể bị chặn */
}

const authListeners = new Set<() => void>();

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

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (import.meta.env.VITE_USE_MOCK === 'true') {
    try {
      const { mockApi } = await import('../mocks/handlers');
      return await mockApi<T>(path);
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
    throw new Error(body.message ?? `Lỗi ${res.status}`);
  }
  return res.json() as Promise<T>;
}
