import React, { memo, useEffect, useState } from 'react';
import { Icon } from '../components/Icon';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose?: () => void;
}

export const Toast = memo<ToastProps>(({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  if (!visible) return null;

  const icons = {
    success: 'check',
    error: 'close',
    info: 'info',
    warning: 'info',
  };

  return (
    <div className={`toast toast-${type} ${visible ? 'toast-visible' : ''}`}>
      <Icon name={icons[type]} size={20} />
      <span className="toast-message">{message}</span>
      <button
        className="toast-close"
        onClick={() => {
          setVisible(false);
          onClose?.();
        }}
        aria-label="Close"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
});

Toast.displayName = 'Toast';

// Toast container for managing multiple toasts
interface ToastContainerProps {
  toasts: Array<{
    id: string;
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
  }>;
  onRemove: (id: string) => void;
}

export const ToastContainer = memo<ToastContainerProps>(({ toasts, onRemove }) => {
  return (
    <div className="toast-container" id="toast-container">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
});

ToastContainer.displayName = 'ToastContainer';
