import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, FormField, Input, Spinner, Table, useToast } from '../../components/ui';
import { genealogyApi, type MemberProfile, type RelationType } from '../../lib/genealogy-api';
import { canManageBranch, getManagedBranchIds, isClanHead, useMe } from '../../lib/me';

export function RelationshipsPage() {
  const { user } = useMe();
  const canWrite = isClanHead(user) || getManagedBranchIds(user).length > 0;
  const toast = useToast();
  const queryClient = useQueryClient();

  const [type, setType] = useState<RelationType>('PARENT_CHILD');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [formError, setFormError] = useState('');

  const profilesQuery = useQuery({
    queryKey: ['profiles', 'all'],
    queryFn: () => genealogyApi.listProfiles({ limit: 100 }),
  });

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: () => genealogyApi.listBranches(50),
  });

  const relationshipsQuery = useQuery({
    queryKey: ['relationships'],
    queryFn: () => genealogyApi.listRelationships(),
  });

  const profiles = profilesQuery.data?.items ?? [];
  const activeProfiles = useMemo(() => profiles.filter((p) => p.status !== 'REMOVED'), [profiles]);
  const manageableProfiles = useMemo(
    () => activeProfiles.filter((p) => canManageBranch(user, p.branchId)),
    [activeProfiles, user],
  );
  const relationships = relationshipsQuery.data ?? [];

  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);

  const branchNameById = useMemo(
    () => new Map((branchesQuery.data?.items ?? []).map((b) => [b.id, b.name])),
    [branchesQuery.data],
  );

  const generations = useMemo(() => {
    const groups = new Map<number, MemberProfile[]>();
    for (const p of profiles) {
      const gen = p.generation ?? 0;
      const list = groups.get(gen) ?? [];
      list.push(p);
      groups.set(gen, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 0) return 1;
      if (b === 0) return -1;
      return a - b;
    });
  }, [profiles]);

  const relationsByProfile = useMemo(() => {
    const map = new Map<string, { parents: string[]; spouses: string[]; childrenCount: number }>();
    for (const p of profiles) {
      map.set(p.id, { parents: [], spouses: [], childrenCount: 0 });
    }
    for (const r of relationships) {
      const fromEntry = map.get(r.fromId);
      const toEntry = map.get(r.toId);
      const fromName =
        profileById.get(r.fromId)?.status === 'REMOVED'
          ? 'Khuyết danh'
          : (profileById.get(r.fromId)?.fullName ?? '?');
      const toName =
        profileById.get(r.toId)?.status === 'REMOVED'
          ? 'Khuyết danh'
          : (profileById.get(r.toId)?.fullName ?? '?');
      if (r.type === 'PARENT_CHILD') {
        if (toEntry) toEntry.parents.push(fromName);
        if (fromEntry) fromEntry.childrenCount += 1;
      } else {
        if (fromEntry) fromEntry.spouses.push(toName);
        if (toEntry) toEntry.spouses.push(fromName);
      }
    }
    return map;
  }, [profiles, relationships, profileById]);

  const createMutation = useMutation({
    mutationFn: () =>
      genealogyApi.createRelationship({
        type,
        fromId,
        toId,
        ...(startDate ? { startDate } : {}),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['relationships'] }),
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
      ]);
      toast.show('success', 'Đã thêm quan hệ phả hệ mới.');
      setFromId('');
      setToId('');
      setStartDate('');
      setFormError('');
    },
    onError: (err: Error) => setFormError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!fromId || !toId) {
      setFormError('Vui lòng chọn đầy đủ hai hồ sơ cần liên kết.');
      return;
    }
    if (fromId === toId) {
      setFormError('Không thể tạo quan hệ với chính mình.');
      return;
    }
    createMutation.mutate();
  }

  return (
    <div className="stack-md">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quan hệ &amp; Sơ đồ Cây Phả hệ (UC-10)</h1>
          <p className="page-subtitle">
            Thiết lập liên kết cha/mẹ – con hoặc vợ – chồng (chặn trùng lặp và vòng lặp tổ tiên) và
            quan sát cấu trúc các đời trong dòng họ.
          </p>
        </div>
      </div>

      {canWrite && (
        <section className="card stack-md">
          <h2 className="card-title" style={{ marginBottom: 0 }}>
            Thêm quan hệ phả hệ mới
          </h2>
          <form onSubmit={handleSubmit} className="stack-sm">
            <div className="filter-bar">
              <FormField label="Loại quan hệ" required>
                <select
                  className="select-input"
                  value={type}
                  onChange={(e) => setType(e.target.value as RelationType)}
                >
                  <option value="PARENT_CHILD">Cha/Mẹ → Con</option>
                  <option value="SPOUSE">Vợ ↔ Chồng</option>
                </select>
              </FormField>

              <FormField label={type === 'PARENT_CHILD' ? 'Cha / Mẹ' : 'Người thứ nhất'} required>
                <select
                  className="select-input"
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                >
                  <option value="">— Chọn hồ sơ —</option>
                  {manageableProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ·{' '}
                      {p.branchId ? (branchNameById.get(p.branchId) ?? 'Chi') : 'Toàn họ'} · Đời{' '}
                      {p.generation ?? '?'}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label={type === 'PARENT_CHILD' ? 'Con' : 'Người thứ hai'} required>
                <select
                  className="select-input"
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                >
                  <option value="">— Chọn hồ sơ —</option>
                  {manageableProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} ·{' '}
                      {p.branchId ? (branchNameById.get(p.branchId) ?? 'Chi') : 'Toàn họ'} · Đời{' '}
                      {p.generation ?? '?'}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Ngày bắt đầu" hint="Tùy chọn (ngày cưới...)">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </FormField>

              <div>
                <Button
                  type="submit"
                  isLoading={createMutation.isPending}
                  style={{ background: '#8f1d2c', width: '100%' }}
                >
                  + Liên kết
                </Button>
              </div>
            </div>

            {formError && (
              <div role="alert" className="alert alert-error">
                {formError}
              </div>
            )}
          </form>
        </section>
      )}

      <section className="card stack-md">
        <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
          <h2 className="card-title" style={{ marginBottom: 0 }}>
            Sơ đồ Phả hệ theo Thế hệ (Xem trước trực quan)
          </h2>
          <div className="row-wrap" style={{ gap: 6 }}>
            <span className="badge badge-success">Còn sống</span>
            <span className="badge badge-accent">Đã mất</span>
            <span className="badge badge-muted">Khuyết danh</span>
          </div>
        </div>

        {profilesQuery.isLoading ? (
          <Spinner fullPage />
        ) : generations.length === 0 ? (
          <p className="page-subtitle">Chưa có hồ sơ nào trên cây.</p>
        ) : (
          <div className="tree-canvas">
            {generations.map(([gen, list]) => (
              <div key={gen} className="tree-generation-row">
                <span className="tree-generation-label">
                  {gen === 0 ? 'Chưa gắn số đời' : `Thế hệ / Đời thứ ${gen}`} · {list.length} thành
                  viên
                </span>
                <div className="tree-nodes-grid">
                  {list.map((p) => {
                    const rel = relationsByProfile.get(p.id);
                    const cls =
                      p.status === 'REMOVED'
                        ? 'tree-node-card removed'
                        : p.status === 'DECEASED'
                          ? 'tree-node-card deceased'
                          : 'tree-node-card';
                    return (
                      <article key={p.id} className={cls}>
                        <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
                          <span className="tree-node-name">
                            {p.status === 'REMOVED' ? 'Khuyết danh' : p.fullName}
                          </span>
                          <span
                            className={`badge ${
                              p.status === 'ALIVE'
                                ? 'badge-success'
                                : p.status === 'DECEASED'
                                  ? 'badge-accent'
                                  : 'badge-muted'
                            }`}
                          >
                            {p.status === 'ALIVE'
                              ? 'Sống'
                              : p.status === 'DECEASED'
                                ? 'Đã mất'
                                : 'Khuyết danh'}
                          </span>
                        </div>
                        <span className="tree-node-meta">
                          {p.branchId
                            ? (branchNameById.get(p.branchId) ?? 'Chi')
                            : 'Toàn họ / Tổ tiên'}
                        </span>
                        {rel && rel.parents.length > 0 && (
                          <span className="tree-node-meta">Cha/mẹ: {rel.parents.join(', ')}</span>
                        )}
                        {rel && rel.spouses.length > 0 && (
                          <span className="tree-node-meta">Vợ/chồng: {rel.spouses.join(', ')}</span>
                        )}
                        {rel && rel.childrenCount > 0 && (
                          <span className="tree-node-meta">
                            Số con nối trực tiếp: {rel.childrenCount}
                          </span>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Danh sách Quan hệ Đang hoạt động ({relationships.length})</h2>
        <Table
          isLoading={relationshipsQuery.isLoading}
          data={relationships}
          rowKey={(r) => r.id}
          emptyText="Chưa có quan hệ phả hệ nào."
          columns={[
            {
              key: 'type',
              header: 'Loại',
              render: (r) => (
                <span
                  className={`badge ${r.type === 'PARENT_CHILD' ? 'badge-brand' : 'badge-info'}`}
                >
                  {r.type === 'PARENT_CHILD' ? 'Cha/Mẹ → Con' : 'Vợ ↔ Chồng'}
                </span>
              ),
            },
            {
              key: 'from',
              header: 'Hồ sơ nguồn',
              render: (r) => {
                const p = profileById.get(r.fromId);
                return p ? (p.status === 'REMOVED' ? 'Khuyết danh' : p.fullName) : r.fromId;
              },
            },
            {
              key: 'to',
              header: 'Hồ sơ đích',
              render: (r) => {
                const p = profileById.get(r.toId);
                return p ? (p.status === 'REMOVED' ? 'Khuyết danh' : p.fullName) : r.toId;
              },
            },
            {
              key: 'startDate',
              header: 'Ngày ghi nhận',
              render: (r) => (r.startDate ? r.startDate.slice(0, 10) : '—'),
            },
          ]}
        />
      </section>
    </div>
  );
}
