import type { CSSProperties } from 'react';

export type SpinnerSize = 'sm' | 'md' | 'lg';
export type SpinnerProps = { size?: SpinnerSize; fullPage?: boolean };

const sizes: Record<SpinnerSize, number> = { sm: 14, md: 22, lg: 32 };
export function Spinner({ size = 'md', fullPage = false }: SpinnerProps) {
  const spinner = <span aria-label="Đang tải" role="status" style={{ ...styles.spinner, width: sizes[size], height: sizes[size] }} />;
  return fullPage ? <div style={styles.fullPage}>{spinner}</div> : spinner;
}
const styles: Record<string, CSSProperties> = { spinner: { display: 'inline-block', border: '3px solid #dbeafe', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }, fullPage: { display: 'grid', placeItems: 'center', minHeight: 180 } };
