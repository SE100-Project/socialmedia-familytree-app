import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, FormField, Input } from '../components/ui';
import { api } from '../lib/api';

export function RegisterPage() {
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successCode, setSuccessCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessCode('');
    if (!phone.trim()) {
      setError('Vui lòng nhập số điện thoại.');
      return;
    }
    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<{ accountCode: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          phone: phone.trim(),
          password,
          ...(email.trim() ? { email: email.trim() } : {}),
        }),
      });
      setSuccessCode(res.accountCode);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <main className="auth-card">
        <div className="row-wrap">
          <span className="app-brand-crest">GP</span>
          <div>
            <h1 style={{ fontSize: '1.35rem', lineHeight: 1.2 }}>Đăng ký tài khoản</h1>
            <p className="page-subtitle">Tạo tài khoản mới để khởi tạo hoặc gia nhập dòng họ</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="stack-md">
          <FormField
            label="Số điện thoại"
            required
            hint="Định dạng SĐT Việt Nam (ví dụ: 0901234567)"
          >
            <Input
              placeholder="0901234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </FormField>

          <FormField label="Email" hint="Tùy chọn — có thể dùng để đăng nhập">
            <Input
              type="email"
              placeholder="ban@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </FormField>

          <FormField label="Mật khẩu" required hint="Tối thiểu 8 ký tự">
            <Input
              type="password"
              placeholder="Nhập mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </FormField>

          {error && (
            <div role="alert" className="alert alert-error">
              {error}
            </div>
          )}

          {successCode && (
            <div role="status" className="alert alert-success">
              Đăng ký thành công! Mã tài khoản của bạn là <strong>{successCode}</strong>.{' '}
              <Link to="/login">Đăng nhập ngay</Link>
            </div>
          )}

          <Button type="submit" isLoading={submitting} fullWidth style={{ background: '#8f1d2c' }}>
            Đăng ký
          </Button>
        </form>

        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
          Đã có tài khoản? <Link to="/login">Quay lại đăng nhập</Link>
        </p>
      </main>
    </div>
  );
}
