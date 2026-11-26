import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, FormField, Input, useToast } from '../components/ui';
import { genealogyApi, type Gender } from '../lib/genealogy-api';
import { useMe } from '../lib/me';

export function OnboardingPage() {
  const { user, refreshMe, logout } = useMe();
  const navigate = useNavigate();
  const toast = useToast();

  const [clanName, setClanName] = useState('');
  const [clanCode, setClanCode] = useState('');
  const [ancestorName, setAncestorName] = useState('');
  const [ancestorGender, setAncestorGender] = useState<Gender>('MALE');
  const [ancestorStatus, setAncestorStatus] = useState<'DECEASED' | 'ALIVE'>('DECEASED');
  const [creatorName, setCreatorName] = useState('');
  const [creatorGender, setCreatorGender] = useState<Gender>('MALE');
  const [creatorGeneration, setCreatorGeneration] = useState('3');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onInitClan(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!clanName.trim() || !ancestorName.trim() || !creatorName.trim()) {
      setError('Vui lòng điền đủ tên dòng họ, họ tên cụ tổ và họ tên của bạn.');
      return;
    }

    setSubmitting(true);
    try {
      await genealogyApi.createClan({
        name: clanName.trim(),
        ...(clanCode.trim() ? { clanCode: clanCode.trim().toUpperCase() } : {}),
        ancestor: {
          fullName: ancestorName.trim(),
          gender: ancestorGender,
          status: ancestorStatus,
        },
        creator: {
          fullName: creatorName.trim(),
          gender: creatorGender,
          generation: Number(creatorGeneration) || 2,
        },
      });
      toast.show('success', 'Khởi tạo dòng họ thành công! Bạn đã trở thành Trưởng họ.');
      await refreshMe();
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-wrapper">
      <main className="onboarding-card">
        <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
          <div className="row-wrap">
            <span className="app-brand-crest">GP</span>
            <div>
              <h1 className="page-title" style={{ fontSize: '1.35rem' }}>
                Chào mừng đến với Gia Phả Dòng Họ
              </h1>
              <p className="page-subtitle">
                Tài khoản <strong>{user?.phone ?? user?.email ?? user?.id}</strong>
                {user?.accountCode ? ` (${user.accountCode})` : ''} chưa liên kết hồ sơ thành viên.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            Đăng xuất
          </Button>
        </div>

        <div className="alert alert-info">
          Nếu hệ thống chưa có dòng họ nào, bạn có thể <strong>Khởi tạo dòng họ đầu tiên</strong>{' '}
          (UC-07) ngay bên dưới. Nếu dòng họ đã tồn tại, hãy gửi mã tài khoản{' '}
          <strong>{user?.accountCode ?? user?.phone}</strong> cho Trưởng họ / Trưởng chi hoặc dùng
          chức năng Xin gia nhập (UC-04).
        </div>

        <form onSubmit={onInitClan} className="stack-md">
          <div className="card stack-md">
            <h2 className="card-title">1. Thông tin Dòng họ (UC-07)</h2>
            <div className="grid-2">
              <FormField label="Tên dòng họ" required>
                <Input
                  placeholder="Ví dụ: Dòng họ Nguyễn Văn"
                  value={clanName}
                  onChange={(e) => setClanName(e.target.value)}
                />
              </FormField>
              <FormField label="Mã gia phả" hint="Tùy chọn (chữ in hoa, số, dấu gạch ngang)">
                <Input
                  placeholder="Ví dụ: CLAN-NGUYEN-01"
                  value={clanCode}
                  onChange={(e) => setClanCode(e.target.value)}
                />
              </FormField>
            </div>
          </div>

          <div className="grid-2">
            <div className="card stack-sm">
              <h2 className="card-title">2. Hồ sơ Cụ tổ (Đời 1)</h2>
              <FormField label="Họ và tên cụ tổ" required>
                <Input
                  placeholder="Ví dụ: Nguyễn Văn Tổ"
                  value={ancestorName}
                  onChange={(e) => setAncestorName(e.target.value)}
                />
              </FormField>
              <FormField label="Giới tính">
                <select
                  className="select-input"
                  value={ancestorGender}
                  onChange={(e) => setAncestorGender(e.target.value as Gender)}
                >
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </FormField>
              <FormField label="Tình trạng">
                <select
                  className="select-input"
                  value={ancestorStatus}
                  onChange={(e) => setAncestorStatus(e.target.value as 'DECEASED' | 'ALIVE')}
                >
                  <option value="DECEASED">Đã mất</option>
                  <option value="ALIVE">Còn sống</option>
                </select>
              </FormField>
            </div>

            <div className="card stack-sm">
              <h2 className="card-title">3. Hồ sơ của bạn (Trưởng họ)</h2>
              <FormField label="Họ và tên của bạn" required>
                <Input
                  placeholder="Ví dụ: Nguyễn Minh Quân"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                />
              </FormField>
              <FormField label="Giới tính">
                <select
                  className="select-input"
                  value={creatorGender}
                  onChange={(e) => setCreatorGender(e.target.value as Gender)}
                >
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </FormField>
              <FormField label="Đời / Thế hệ" hint="Mặc định đời 2 trở lên">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={creatorGeneration}
                  onChange={(e) => setCreatorGeneration(e.target.value)}
                />
              </FormField>
            </div>
          </div>

          {error && (
            <div role="alert" className="alert alert-error">
              {error}
            </div>
          )}

          <div className="row-wrap" style={{ justifyContent: 'flex-end' }}>
            <Button type="submit" isLoading={submitting} style={{ background: '#8f1d2c' }}>
              Khởi tạo dòng họ &amp; trở thành Trưởng họ
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
