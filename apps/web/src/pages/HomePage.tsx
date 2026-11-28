import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Spinner } from '../components/ui';
import { api } from '../lib/api';
import { genealogyApi } from '../lib/genealogy-api';
import { formatRoleLabel, useMe } from '../lib/me';

export function HomePage() {
  const { user } = useMe();

  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api<{ status: string }>('/health'),
  });
  const clan = useQuery({
    queryKey: ['clan', 'current'],
    queryFn: () => genealogyApi.getCurrentClan(),
  });
  const branches = useQuery({
    queryKey: ['branches'],
    queryFn: () => genealogyApi.listBranches(50),
  });
  const profiles = useQuery({
    queryKey: ['profiles', 'all'],
    queryFn: () => genealogyApi.listProfiles({ limit: 100 }),
  });
  const relationships = useQuery({
    queryKey: ['relationships'],
    queryFn: () => genealogyApi.listRelationships(),
  });

  const allProfiles = profiles.data?.items ?? [];
  const aliveCount = allProfiles.filter((p) => p.status === 'ALIVE').length;
  const deceasedCount = allProfiles.filter((p) => p.status === 'DECEASED').length;
  const removedCount = allProfiles.filter((p) => p.status === 'REMOVED').length;
  const maxGeneration = allProfiles.reduce((max, p) => Math.max(max, p.generation ?? 0), 0);

  return (
    <div className="stack-md">
      <div className="page-header">
        <div>
          <div className="row-wrap" style={{ marginBottom: 6 }}>
            <span className="badge badge-brand">{formatRoleLabel(user)}</span>
            {clan.data?.clanCode && (
              <span className="badge badge-accent">Mã gia phả: {clan.data.clanCode}</span>
            )}
          </div>
          <h1 className="page-title">{clan.data?.name ?? 'Tổng quan Gia phả dòng họ'}</h1>
          <p className="page-subtitle">
            Quản trị cấu trúc chi phái, hồ sơ thành viên và liên kết phả hệ nhiều thế hệ.
          </p>
        </div>

        <span className={`badge ${health.isError ? 'badge-danger' : 'badge-success'}`}>
          API:{' '}
          {health.isLoading
            ? 'đang kiểm tra...'
            : health.isError
              ? 'chưa kết nối'
              : (health.data?.status ?? 'ok')}
        </span>
      </div>

      {clan.isLoading || profiles.isLoading ? (
        <Spinner fullPage />
      ) : (
        <>
          <section className="grid-stats">
            <div className="stat-card">
              <span className="stat-label">Tổng hồ sơ phả hệ</span>
              <span className="stat-value">{allProfiles.length}</span>
              <span className="stat-hint">
                {aliveCount} còn sống · {deceasedCount} đã mất
                {removedCount > 0 ? ` · ${removedCount} khuyết danh` : ''}
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Số chi phái</span>
              <span className="stat-value">{branches.data?.items.length ?? 0}</span>
              <span className="stat-hint">Quản trị tập trung theo phạm vi chi</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Quan hệ phả hệ</span>
              <span className="stat-value">{relationships.data?.length ?? 0}</span>
              <span className="stat-hint">Cha/mẹ - con &amp; vợ/chồng đang hoạt động</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Số đời trên cây</span>
              <span className="stat-value">{maxGeneration || '—'}</span>
              <span className="stat-hint">Theo thứ tự thế hệ từ Thủy tổ</span>
            </div>
          </section>

          <section className="grid-3">
            <article className="card stack-sm">
              <span className="badge badge-brand" style={{ width: 'fit-content' }}>
                UC-08
              </span>
              <h2 className="card-title" style={{ marginBottom: 0 }}>
                Quản lý Chi phái
              </h2>
              <p className="page-subtitle">
                Tạo chi mới, đổi tên chi và chỉ định hoặc bỏ trống Trưởng chi (bảo toàn huyết thống
                BR-04).
              </p>
              <Link to="/branches" style={{ fontWeight: 600 }}>
                Mở trang Quản lý Chi →
              </Link>
            </article>

            <article className="card stack-sm">
              <span className="badge badge-accent" style={{ width: 'fit-content' }}>
                UC-10
              </span>
              <h2 className="card-title" style={{ marginBottom: 0 }}>
                Hồ sơ Thành viên
              </h2>
              <p className="page-subtitle">
                Tra cứu theo chi/đời, thêm mới, chỉnh sửa có khóa lạc quan (chống ghi đè 409) và xóa
                mềm giữ nút trên cây.
              </p>
              <Link to="/profiles" style={{ fontWeight: 600 }}>
                Mở trang Hồ sơ Thành viên →
              </Link>
            </article>

            <article className="card stack-sm">
              <span className="badge badge-info" style={{ width: 'fit-content' }}>
                UC-10 · Cây phả hệ
              </span>
              <h2 className="card-title" style={{ marginBottom: 0 }}>
                Quan hệ &amp; Sơ đồ Thế hệ
              </h2>
              <p className="page-subtitle">
                Nối quan hệ cha/mẹ - con hoặc vợ/chồng (chặn trùng &amp; vòng tổ tiên) và xem sơ đồ
                trực quan theo từng đời.
              </p>
              <Link to="/relationships" style={{ fontWeight: 600 }}>
                Mở Quan hệ &amp; Cây phả hệ →
              </Link>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
