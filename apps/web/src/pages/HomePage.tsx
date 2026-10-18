import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function HomePage() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => api<{ status: string }>('/health') });
  return (
    <main style={{ padding: 16 }}>
      <h1>Gia phả dòng họ</h1>
      <p>
        API: {health.isLoading ? 'đang kiểm tra...' : health.isError ? 'không kết nối được' : health.data?.status}
      </p>
    </main>
  );
}
