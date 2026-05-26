import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className={`confirm-icon confirm-icon-${variant}`}>
          <AlertTriangle size={22} />
        </div>
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button ref={cancelRef} className="secondary-button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={variant === 'danger' ? 'danger-button' : 'warning-button'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
