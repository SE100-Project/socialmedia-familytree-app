import type { ReactNode } from 'react';
export type FormFieldProps = { label: string; required?: boolean; hint?: ReactNode; error?: ReactNode; children: ReactNode };
export function FormField({ label, required, hint, error, children }: FormFieldProps) { return <div style={{ display: 'grid', gap: 5 }}><label style={{ fontWeight: 600 }}>{label}{required && <span aria-hidden="true" style={{ color: '#dc2626' }}> *</span>}</label>{children}{error ? <small role="alert" style={{ color: '#dc2626' }}>{error}</small> : hint ? <small style={{ color: '#6b7280' }}>{hint}</small> : null}</div>; }
