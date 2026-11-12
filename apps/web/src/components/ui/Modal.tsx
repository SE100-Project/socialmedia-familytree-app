import { useEffect, type ReactNode } from 'react';
export type ModalProps = { isOpen: boolean; onClose: () => void; title: string; footer?: ReactNode; children: ReactNode };
export function Modal({ isOpen, onClose, title, footer, children }: ModalProps) {
  useEffect(() => { if (!isOpen) return; const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [isOpen, onClose]);
  if (!isOpen) return null;
  return <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 10, display: 'grid', placeItems: 'center', padding: 12, background: 'rgba(17,24,39,.5)' }}><section role="dialog" aria-modal="true" aria-labelledby="modal-title" style={{ width: 'calc(100vw - 24px)', maxWidth: 448, maxHeight: 'calc(100vh - 24px)', overflow: 'auto', borderRadius: 12, background: '#fff', padding: 20 }}><h2 id="modal-title">{title}</h2>{children}{footer && <footer style={{ marginTop: 16 }}>{footer}</footer>}</section></div>;
}
