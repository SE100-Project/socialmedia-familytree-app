import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './Spinner';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md' | 'lg'; isLoading?: boolean; fullWidth?: boolean };
const colors = { primary: '#2563eb', secondary: '#e5e7eb', danger: '#dc2626', ghost: 'transparent' };
export function Button({ variant = 'primary', size = 'md', isLoading = false, fullWidth = false, disabled, children, style, ...props }: ButtonProps) {
  const padding = { sm: '6px 10px', md: '9px 14px', lg: '12px 18px' }[size];
  const foreground = variant === 'secondary' || variant === 'ghost' ? '#111827' : '#fff';
  return <button {...props} disabled={disabled || isLoading} style={{ border: variant === 'ghost' ? '1px solid #d1d5db' : '0', borderRadius: 8, padding, background: colors[variant], color: foreground, cursor: disabled || isLoading ? 'not-allowed' : 'pointer', opacity: disabled || isLoading ? 0.6 : 1, width: fullWidth ? '100%' : undefined, ...style }}>{isLoading ? <Spinner size="sm" /> : children}</button>;
}
