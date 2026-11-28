import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, FormField, Input } from '../components/ui';
import { api, isMockMode, setToken } from '../lib/api';

const DEMO_ACCOUNTS = [
  { phone: '0901000001', label: 'Trưởng họ · 0901000001' },
  { phone: '0901000002', label: 'Trưởng Chi Trưởng · 0901000002' },
  { phone: '0901000003', label: 'Thành viên · 0901000003' },
  { phone: '0901000099', label: 'Tài khoản mới (Onboarding) · 0901000099' },
];

export function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Vui lòng nhập số điện thoại/email và mật khẩu.');
      return;
    }
    setSubmitting(true);
    try {
      const { accessToken } = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      setToken(accessToken);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <main className="auth-card">
        <div className="stack-sm">
          <div className="row-wrap">
            <span className="app-brand-crest">GP</span>
            <div>
              <h1 style={{ fontSize: '1.35rem', lineHeight: 1.2 }}>Gia Phả Dòng Họ</h1>
              <p className="page-subtitle">Cổng kết nối và quản trị gia phả nội bộ</p>
            </div>
          </div>
          {isMockMode() && (
            <div className="alert alert-info">
              Đang chạy chế độ <strong>Mock Demo</strong> (không cần PostgreSQL). Mật khẩu mẫu:{' '}
              <code>Dev@123456</code>.
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="stack-md">
          <FormField label="Số điện thoại hoặc Email" required>
            <Input
              placeholder="Ví dụ: 0901000001"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
            />
          </FormField>

          <FormField label="Mật khẩu" required>
            <Input
              type="password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </FormField>

          {error && (
            <div role="alert" className="alert alert-error">
              {error}
            </div>
          )}

          <Button type="submit" isLoading={submitting} fullWidth size="lg">
            Đăng nhập
          </Button>
        </form>

        {isMockMode() && (
          <div className="stack-sm">
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Điền nhanh tài khoản mẫu:
            </span>
            <div className="stack-sm">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.phone}
                  type="button"
                  className="demo-chip"
                  onClick={() => {
                    setIdentifier(acc.phone);
                    setPassword('Dev@123456');
                    setError('');
                  }}
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          Chưa có tài khoản? <Link to="/register">Đăng ký thành viên mới</Link>
        </p>
      </main>
    </div>
  );
}
