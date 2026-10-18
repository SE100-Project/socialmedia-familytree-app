import { FormEvent, useState } from 'react';
import { api } from '../lib/api';

export function RegisterPage() {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    try {
      const res = await api<{ accountCode: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ phone, password, ...(email ? { email } : {}) }),
      });
      setMessage(`Đăng ký thành công. Mã tài khoản của bạn: ${res.accountCode}`);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  return (
    <main style={{ padding: 16, maxWidth: 360 }}>
      <h1>Đăng ký</h1>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
        <input placeholder="Số điện thoại (bắt buộc)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input placeholder="Email (tùy chọn)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Mật khẩu (≥ 8 ký tự)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Đăng ký</button>
        {message && <p role="status">{message}</p>}
      </form>
    </main>
  );
}
