import { forwardRef, type InputHTMLAttributes } from 'react';
export type InputProps = InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean };
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ hasError = false, style, ...props }, ref) { return <input ref={ref} {...props} style={{ boxSizing: 'border-box', minWidth: 0, width: '100%', border: `1px solid ${hasError ? '#dc2626' : '#d1d5db'}`, borderRadius: 8, padding: '9px 12px', ...style }} />; });
