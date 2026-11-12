import type { ReactNode } from 'react';
import { Spinner } from './Spinner';
export type TableColumn<T> = { key: string; header: ReactNode; render: (row: T) => ReactNode };
export type TableProps<T> = { columns: TableColumn<T>[]; data: T[]; rowKey: (row: T) => string | number; isLoading?: boolean; emptyText?: string };
export function Table<T>({ columns, data, rowKey, isLoading = false, emptyText = 'Không có dữ liệu' }: TableProps<T>) { return <div style={{ overflowX: 'auto', width: '100%' }}><table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse' }}><thead><tr>{columns.map((column) => <th key={column.key} style={styles.cell}>{column.header}</th>)}</tr></thead><tbody>{isLoading ? <tr><td colSpan={columns.length} style={styles.cell}><Spinner /></td></tr> : data.length === 0 ? <tr><td colSpan={columns.length} style={styles.cell}>{emptyText}</td></tr> : data.map((row) => <tr key={rowKey(row)}>{columns.map((column) => <td key={column.key} style={styles.cell}>{column.render(row)}</td>)}</tr>)}</tbody></table></div>; }
const styles = { cell: { padding: 10, textAlign: 'left' as const, borderBottom: '1px solid #e5e7eb' } };
