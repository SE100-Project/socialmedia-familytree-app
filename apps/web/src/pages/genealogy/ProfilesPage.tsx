import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, FormField, Input, Modal, Table, useToast } from '../../components/ui';
import { ApiError } from '../../lib/api';
import {
  genealogyApi,
  type CalendarType,
  type Gender,
  type MemberProfile,
  type MemberStatus,
} from '../../lib/genealogy-api';
import { canManageBranch, getManagedBranchIds, isClanHead, useMe } from '../../lib/me';

function formatDateInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function genderLabel(gender: Gender): string {
  if (gender === 'MALE') return 'Nam';
  if (gender === 'FEMALE') return 'Nữ';
  return 'Khác';
}

export function ProfilesPage() {
  const { user } = useMe();
  const clanHead = isClanHead(user);
  const managedBranchIds = getManagedBranchIds(user);
  const canCreateAny = clanHead || managedBranchIds.length > 0;
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | ''>('');

  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingProfile, setEditingProfile] = useState<MemberProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<Gender>('MALE');
  const [branchId, setBranchId] = useState('');
  const [generation, setGeneration] = useState('');
  const [status, setStatus] = useState<'ALIVE' | 'DECEASED'>('ALIVE');
  const [birthDate, setBirthDate] = useState('');
  const [deathDate, setDeathDate] = useState('');
  const [deathCalendar, setDeathCalendar] = useState<CalendarType>('LUNAR');
  const [bio, setBio] = useState('');
  const [formError, setFormError] = useState('');
  const [deletingProfile, setDeletingProfile] = useState<MemberProfile | null>(null);

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => genealogyApi.listBranches(50),
  });

  const profilesQuery = useQuery({
    queryKey: ['profiles', { search, branchFilter, statusFilter }],
    queryFn: () =>
      genealogyApi.listProfiles({
        limit: 100,
        search: search || undefined,
        branchId: branchFilter || undefined,
        status: statusFilter || undefined,
      }),
  });

  const branchNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of branchesQuery.data?.items ?? []) {
      map.set(b.id, b.name);
    }
    return map;
  }, [branchesQuery.data]);

  const selectableBranches = useMemo(() => {
    const list = branchesQuery.data?.items ?? [];
    if (clanHead) return list;
    return list.filter((b) => managedBranchIds.includes(b.id));
  }, [branchesQuery.data, clanHead, managedBranchIds]);

  const createMutation = useMutation({
    mutationFn: () =>
      genealogyApi.createProfile({
        fullName: fullName.trim(),
        gender,
        ...(branchId ? { branchId } : {}),
        ...(generation ? { generation: Number(generation) } : {}),
        status,
        ...(birthDate ? { birthDate } : {}),
        ...(status === 'DECEASED' && deathDate ? { deathDate, deathCalendar } : {}),
        ...(bio.trim() ? { bio: bio.trim() } : {}),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['branches'] }),
      ]);
      toast.show('success', 'Đã tạo hồ sơ thành viên mới.');
      setModalMode(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editingProfile) throw new Error('Thiếu hồ sơ đang sửa');
      return genealogyApi.updateProfile(editingProfile.id, {
        expectedUpdatedAt: editingProfile.updatedAt,
        fullName: fullName.trim(),
        gender,
        branchId: branchId || null,
        generation: generation ? Number(generation) : null,
        status,
        birthDate: birthDate || null,
        deathDate: status === 'DECEASED' && deathDate ? deathDate : null,
        deathCalendar: status === 'DECEASED' ? deathCalendar : null,
        bio: bio.trim() || null,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['branches'] }),
      ]);
      toast.show('success', 'Đã cập nhật hồ sơ thành viên.');
      setModalMode(null);
    },
    onError: async (err: Error) => {
      if (err instanceof ApiError && err.status === 409) {
        await queryClient.invalidateQueries({ queryKey: ['profiles'] });
        setFormError(
          'Xung đột phiên bản (409): Hồ sơ vừa được người khác cập nhật. Dữ liệu mới đã được tải lại, vui lòng mở lại để sửa.',
        );
        return;
      }
      setFormError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (profile: MemberProfile) =>
      genealogyApi.softDeleteProfile(profile.id, profile.updatedAt),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['branches'] }),
      ]);
      toast.show('info', 'Đã xóa mềm hồ sơ (trạng thái Khuyết danh, giữ nguyên nút trên cây).');
      setDeletingProfile(null);
    },
    onError: (err: Error) => toast.show('error', err.message),
  });

  function openCreate() {
    setFormError('');
    setEditingProfile(null);
    setFullName('');
    setGender('MALE');
    setBranchId(clanHead ? '' : (managedBranchIds[0] ?? ''));
    setGeneration('');
    setStatus('ALIVE');
    setBirthDate('');
    setDeathDate('');
    setDeathCalendar('LUNAR');
    setBio('');
    setModalMode('create');
  }

  function openEdit(profile: MemberProfile) {
    setFormError('');
    setEditingProfile(profile);
    setFullName(profile.fullName);
    setGender(profile.gender);
    setBranchId(profile.branchId ?? '');
    setGeneration(profile.generation ? String(profile.generation) : '');
    setStatus(profile.status === 'DECEASED' ? 'DECEASED' : 'ALIVE');
    setBirthDate(formatDateInput(profile.birthDate));
    setDeathDate(formatDateInput(profile.deathDate));
    setDeathCalendar(profile.deathCalendar ?? 'LUNAR');
    setBio(profile.bio ?? '');
    setModalMode('edit');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!fullName.trim()) {
      setFormError('Vui lòng nhập họ tên thành viên.');
      return;
    }
    if (status === 'ALIVE' && deathDate) {
      setFormError('Hồ sơ còn sống không được nhập ngày mất.');
      return;
    }
    if (modalMode === 'create') {
      createMutation.mutate();
    } else if (modalMode === 'edit') {
      updateMutation.mutate();
    }
  }

  return (
    <div className="stack-md">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hồ sơ Thành viên (UC-10)</h1>
          <p className="page-subtitle">
            Quản lý hồ sơ trong phạm vi chi, hỗ trợ khóa lạc quan chống ghi đè đồng thời và xóa mềm
            giữ nguyên nút phả hệ (BR-13).
          </p>
        </div>

        {canCreateAny && (
          <Button onClick={openCreate} style={{ background: '#8f1d2c' }}>
            + Thêm hồ sơ mới
          </Button>
        )}
      </div>

      <section className="card filter-bar">
        <FormField label="Tìm theo họ tên">
          <Input
            placeholder="Nhập họ tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </FormField>

        <FormField label="Lọc theo chi">
          <select
            className="select-input"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="">Tất cả các chi</option>
            {(branchesQuery.data?.items ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Trạng thái">
          <select
            className="select-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MemberStatus | '')}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ALIVE">Còn sống</option>
            <option value="DECEASED">Đã mất</option>
            <option value="REMOVED">Khuyết danh (đã xóa mềm)</option>
          </select>
        </FormField>
      </section>

      <div className="card">
        <Table
          isLoading={profilesQuery.isLoading}
          data={profilesQuery.data?.items ?? []}
          rowKey={(p) => p.id}
          emptyText="Không tìm thấy hồ sơ phù hợp."
          columns={[
            {
              key: 'fullName',
              header: 'Họ và tên',
              render: (p) => (
                <div>
                  <strong>{p.status === 'REMOVED' ? 'Khuyết danh' : p.fullName}</strong>
                  {p.status === 'REMOVED' && (
                    <div className="tree-node-meta">(Tên cũ: {p.fullName})</div>
                  )}
                  {p.bio && p.status !== 'REMOVED' && <div className="tree-node-meta">{p.bio}</div>}
                </div>
              ),
            },
            {
              key: 'gender',
              header: 'Giới tính',
              render: (p) => genderLabel(p.gender),
            },
            {
              key: 'generation',
              header: 'Đời',
              render: (p) => (p.generation ? `Đời ${p.generation}` : '—'),
            },
            {
              key: 'branch',
              header: 'Chi phái',
              render: (p) =>
                p.branchId ? (branchNameById.get(p.branchId) ?? 'Chi') : 'Toàn họ / Tổ tiên',
            },
            {
              key: 'status',
              header: 'Trạng thái',
              render: (p) => {
                if (p.status === 'ALIVE') {
                  return <span className="badge badge-success">Còn sống</span>;
                }
                if (p.status === 'DECEASED') {
                  return (
                    <span className="badge badge-accent">
                      Đã mất{p.deathCalendar === 'LUNAR' ? ' (Âm lịch)' : ''}
                    </span>
                  );
                }
                return <span className="badge badge-muted">Khuyết danh</span>;
              },
            },
            {
              key: 'actions',
              header: 'Thao tác',
              render: (p) => {
                const editable = p.status !== 'REMOVED' && canManageBranch(user, p.branchId);
                if (!editable) return <span className="tree-node-meta">—</span>;
                return (
                  <div className="row-wrap" style={{ gap: 6 }}>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                      Sửa
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setDeletingProfile(p)}>
                      Xóa mềm
                    </Button>
                  </div>
                );
              },
            },
          ]}
        />
      </div>

      <Modal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        title={modalMode === 'create' ? 'Thêm hồ sơ thành viên' : 'Chỉnh sửa hồ sơ thành viên'}
        footer={
          <div className="row-wrap" style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setModalMode(null)}>
              Hủy
            </Button>
            <Button
              type="submit"
              form="profile-form"
              isLoading={createMutation.isPending || updateMutation.isPending}
              style={{ background: '#8f1d2c' }}
            >
              {modalMode === 'create' ? 'Tạo hồ sơ' : 'Lưu cập nhật'}
            </Button>
          </div>
        }
      >
        <form id="profile-form" onSubmit={handleSubmit} className="stack-sm">
          <FormField label="Họ và tên" required>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </FormField>

          <div className="grid-2">
            <FormField label="Giới tính">
              <select
                className="select-input"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
              >
                <option value="MALE">Nam</option>
                <option value="FEMALE">Nữ</option>
                <option value="OTHER">Khác</option>
              </select>
            </FormField>

            <FormField label="Đời / Thế hệ" hint="Để trống nếu muốn tự suy khi nối quan hệ">
              <Input
                type="number"
                min={1}
                max={50}
                value={generation}
                onChange={(e) => setGeneration(e.target.value)}
              />
            </FormField>
          </div>

          <div className="grid-2">
            <FormField label="Thuộc chi">
              <select
                className="select-input"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                {clanHead && <option value="">— Chưa gán chi / Toàn họ —</option>}
                {selectableBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Tình trạng">
              <select
                className="select-input"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'ALIVE' | 'DECEASED')}
              >
                <option value="ALIVE">Còn sống</option>
                <option value="DECEASED">Đã mất</option>
              </select>
            </FormField>
          </div>

          <div className="grid-2">
            <FormField label="Ngày sinh">
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </FormField>

            {status === 'DECEASED' && (
              <FormField label="Ngày mất">
                <Input
                  type="date"
                  value={deathDate}
                  onChange={(e) => setDeathDate(e.target.value)}
                />
              </FormField>
            )}
          </div>

          {status === 'DECEASED' && (
            <FormField label="Loại lịch ngày giỗ">
              <select
                className="select-input"
                value={deathCalendar}
                onChange={(e) => setDeathCalendar(e.target.value as CalendarType)}
              >
                <option value="LUNAR">Âm lịch</option>
                <option value="SOLAR">Dương lịch</option>
              </select>
            </FormField>
          )}

          <FormField label="Tiểu sử ngắn">
            <textarea
              className="textarea-input"
              placeholder="Ghi chú ngắn về vai vế, quê quán..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </FormField>

          {formError && (
            <div role="alert" className="alert alert-error">
              {formError}
            </div>
          )}
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(deletingProfile)}
        onClose={() => setDeletingProfile(null)}
        title="Xác nhận xóa mềm hồ sơ"
        footer={
          <div className="row-wrap" style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setDeletingProfile(null)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              isLoading={deleteMutation.isPending}
              onClick={() => deletingProfile && deleteMutation.mutate(deletingProfile)}
            >
              Xác nhận xóa mềm
            </Button>
          </div>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.94rem' }}>
          Hồ sơ <strong>{deletingProfile?.fullName}</strong> sẽ chuyển sang trạng thái{' '}
          <strong>Khuyết danh (REMOVED)</strong>. Nút và các liên kết phả hệ vẫn được giữ nguyên để
          không làm đứt cây gia phả (BR-13).
        </p>
      </Modal>
    </div>
  );
}
