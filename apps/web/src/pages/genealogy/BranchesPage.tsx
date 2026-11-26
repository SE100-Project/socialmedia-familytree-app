import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, FormField, Input, Modal, Table, useToast } from '../../components/ui';
import { genealogyApi, type BranchView } from '../../lib/genealogy-api';
import { isClanHead, useMe } from '../../lib/me';

export function BranchesPage() {
  const { user } = useMe();
  const canEdit = isClanHead(user);
  const toast = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<BranchView | null>(null);
  const [editName, setEditName] = useState('');
  const [editHeadProfileId, setEditHeadProfileId] = useState<string>('');
  const [formError, setFormError] = useState('');

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => genealogyApi.listBranches(50),
  });

  const profilesQuery = useQuery({
    queryKey: ['profiles', 'all'],
    queryFn: () => genealogyApi.listProfiles({ limit: 100 }),
  });

  const eligibleCandidates = useMemo(() => {
    const items = profilesQuery.data?.items ?? [];
    if (!editing) return [];
    return items.filter(
      (p) =>
        p.status === 'ALIVE' &&
        Boolean(p.accountId) &&
        (p.branchId === null || p.branchId === editing.id),
    );
  }, [profilesQuery.data, editing]);

  const createMutation = useMutation({
    mutationFn: (name: string) => genealogyApi.createBranch(name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.show('success', 'Đã tạo chi mới thành công.');
      setNewName('');
      setFormError('');
      setCreateOpen(false);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { name?: string; branchHeadProfileId?: string | null };
    }) => genealogyApi.updateBranch(id, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['branches'] }),
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
      ]);
      toast.show('success', 'Đã cập nhật thông tin chi.');
      setEditing(null);
      setFormError('');
    },
    onError: (err: Error) => setFormError(err.message),
  });

  function openEdit(branch: BranchView) {
    setFormError('');
    setEditing(branch);
    setEditName(branch.name);
    setEditHeadProfileId(branch.branchHead?.profileId ?? '');
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!newName.trim()) {
      setFormError('Vui lòng nhập tên chi.');
      return;
    }
    createMutation.mutate(newName.trim());
  }

  function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setFormError('');
    if (!editName.trim()) {
      setFormError('Tên chi không được để trống.');
      return;
    }
    updateMutation.mutate({
      id: editing.id,
      payload: {
        name: editName.trim(),
        branchHeadProfileId: editHeadProfileId ? editHeadProfileId : null,
      },
    });
  }

  return (
    <div className="stack-md">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản lý Chi phái (UC-08)</h1>
          <p className="page-subtitle">
            Danh sách các chi trong dòng họ, số lượng thành viên hoạt động và Trưởng chi đương
            nhiệm.
          </p>
        </div>

        {canEdit && (
          <Button
            onClick={() => {
              setFormError('');
              setNewName('');
              setCreateOpen(true);
            }}
            style={{ background: '#8f1d2c' }}
          >
            + Tạo chi mới
          </Button>
        )}
      </div>

      {!canEdit && (
        <div className="alert alert-info">
          Bạn đang xem ở chế độ chỉ đọc. Theo quy định <strong>UC-08</strong>, chỉ{' '}
          <strong>Trưởng họ (CLAN_HEAD)</strong> mới được tạo chi, đổi tên hoặc chỉ định Trưởng chi.
        </div>
      )}

      <div className="card">
        <Table
          isLoading={branchesQuery.isLoading}
          data={branchesQuery.data?.items ?? []}
          rowKey={(b) => b.id}
          emptyText="Chưa có chi nào trong dòng họ."
          columns={[
            {
              key: 'name',
              header: 'Tên chi',
              render: (b) => <strong>{b.name}</strong>,
            },
            {
              key: 'head',
              header: 'Trưởng chi đương nhiệm',
              render: (b) =>
                b.branchHead ? (
                  <span className="badge badge-info">
                    {b.branchHead.fullName ?? b.branchHead.accountId}
                  </span>
                ) : (
                  <span className="badge badge-muted">Chưa chỉ định</span>
                ),
            },
            {
              key: 'memberCount',
              header: 'Thành viên hoạt động',
              render: (b) => <span>{b.memberCount} hồ sơ</span>,
            },
            ...(canEdit
              ? [
                  {
                    key: 'actions',
                    header: 'Thao tác',
                    render: (b: BranchView) => (
                      <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                        Sửa / Bổ nhiệm
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </div>

      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Tạo chi phái mới"
        footer={
          <div className="row-wrap" style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              form="create-branch-form"
              isLoading={createMutation.isPending}
              style={{ background: '#8f1d2c' }}
            >
              Tạo chi
            </Button>
          </div>
        }
      >
        <form id="create-branch-form" onSubmit={handleCreate} className="stack-md">
          <FormField label="Tên chi" required hint="Tên chi không được trùng trong cùng dòng họ">
            <Input
              placeholder="Ví dụ: Chi Ba"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
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
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Cập nhật ${editing?.name ?? 'chi'}`}
        footer={
          <div className="row-wrap" style={{ justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Hủy
            </Button>
            <Button
              type="submit"
              form="edit-branch-form"
              isLoading={updateMutation.isPending}
              style={{ background: '#8f1d2c' }}
            >
              Lưu thay đổi
            </Button>
          </div>
        }
      >
        <form id="edit-branch-form" onSubmit={handleUpdate} className="stack-md">
          <FormField label="Tên chi" required>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </FormField>

          <FormField
            label="Trưởng chi"
            hint="Chỉ chọn thành viên còn sống đã có tài khoản thuộc chi này hoặc chưa thuộc chi nào (BR-04 không thay đổi quan hệ huyết thống)."
          >
            <select
              className="select-input"
              value={editHeadProfileId}
              onChange={(e) => setEditHeadProfileId(e.target.value)}
            >
              <option value="">— Để trống (chưa có Trưởng chi) —</option>
              {eligibleCandidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} (Đời {p.generation ?? '?'})
                </option>
              ))}
            </select>
          </FormField>

          {formError && (
            <div role="alert" className="alert alert-error">
              {formError}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
