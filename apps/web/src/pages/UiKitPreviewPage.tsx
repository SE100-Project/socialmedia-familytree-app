import { useState } from 'react';
import { Button, FormField, Input, Modal, Spinner, Table, ToastProvider, useToast } from '../components/ui';
import { mockRows } from '../mocks/data';

function PreviewContent() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return <main style={{ display: 'grid', gap: 20, maxWidth: 720, padding: 16, margin: '0 auto' }}><h1>UI Kit Preview</h1><section><h2>Button</h2><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><Button size="sm">Primary</Button><Button variant="secondary">Secondary</Button><Button variant="danger">Danger</Button><Button variant="ghost">Ghost</Button><Button isLoading>Loading</Button></div></section><section><h2>Form</h2><FormField label="Tên hiển thị" required hint="Tối đa 100 ký tự"><Input placeholder="Nhập tên" /></FormField></section><section><h2>Modal & Toast</h2><div style={{ display: 'flex', gap: 8 }}><Button onClick={() => setOpen(true)}>Mở modal</Button><Button variant="secondary" onClick={() => toast.show('success', 'Đã lưu thành công')}>Hiện toast</Button></div><Modal isOpen={open} onClose={() => setOpen(false)} title="Xác nhận" footer={<Button onClick={() => setOpen(false)}>Đóng</Button>}>Nội dung modal mẫu.</Modal></section><section><h2>Table</h2><Table data={mockRows} rowKey={(row) => row.id} columns={[{ key: 'name', header: 'Tên', render: (row) => row.name }, { key: 'status', header: 'Trạng thái', render: (row) => row.status }]} /></section><section><h2>Spinner</h2><Spinner size="lg" /></section></main>;
}
export function UiKitPreviewPage() { return <ToastProvider><PreviewContent /></ToastProvider>; }
