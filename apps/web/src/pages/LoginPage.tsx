import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api';

export function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const { accessToken } = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
      });
      setToken(accessToken);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <main style={{ padding: 16, maxWidth: 360 }}>
      <h1>Đăng nhập</h1>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
        <input placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input type="password" placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Đăng nhập</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
}
