// Client mỏng gọi REST API. Token lưu tạm trong bộ nhớ + sessionStorage (cân nhắc cookie httpOnly ở bản sau).
let token: string | null = null;
try {
  token = sessionStorage.getItem('accessToken');
} catch {
  /* sessionStorage có thể bị chặn */
}

export function setToken(t: string | null) {
  token = t;
  try {
    if (t) sessionStorage.setItem('accessToken', t);
    else sessionStorage.removeItem('accessToken');
  } catch {
    /* bỏ qua */
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Lỗi ${res.status}`);
  }
  return res.json() as Promise<T>;
}
