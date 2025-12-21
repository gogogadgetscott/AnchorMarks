import React, { memo, ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
  icon?: ReactNode;
  children?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
  loading?: boolean;
}

export const Button = memo<ButtonProps>(({
  variant = 'primary',
  icon,
  children,
  className = '',
  disabled,
  loading,
  type = 'button',
  ...props
}) => {
  const variantClass = variant === 'icon' ? 'btn-icon' : `btn btn-${variant}`;
  const classes = `${variantClass} ${className} ${loading ? 'btn-loading' : ''}`.trim();

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {icon && <span className="btn-icon-wrapper">{icon}</span>}
      {children && <span className="btn-text">{children}</span>}
    </button>
  );
});

Button.displayName = 'Button';
