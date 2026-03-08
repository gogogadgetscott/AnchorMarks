import React from "react";
import { Icon } from "./Icon.tsx";

interface ButtonProps {
  text?: string;
  id?: string;
  className?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "icon" | string;
  icon?: string;
  title?: string;
  type?: "button" | "submit" | "reset";
  data?: Record<string, string | number | boolean>;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export function Button({
  text = "",
  id,
  className = "",
  variant = "primary",
  icon = "",
  title,
  type = "button",
  data = {},
  onClick,
}: ButtonProps) {
  const variantClass = variant === "icon" ? "btn-icon" : `btn btn-${variant}`;
  const dataAttrs = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [`data-${key}`, String(value)]),
  );

  return (
    <button
      type={type}
      id={id}
      className={`${variantClass} ${className}`}
      title={title}
      onClick={onClick}
      {...dataAttrs}
    >
      {icon && <Icon name={icon} size={variant === "icon" ? 20 : 16} />}
      {text && <span>{text}</span>}
    </button>
  );
}
