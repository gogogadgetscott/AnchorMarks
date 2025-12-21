import React, { memo, HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "success" | "danger" | "warning";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const Badge = memo<BadgeProps>(
  ({
    variant = "secondary",
    size = "sm",
    className = "",
    children,
    ...props
  }) => {
    const classes = `badge badge-${variant} badge-${size} ${className}`.trim();

    return (
      <span className={classes} {...props}>
        {children}
      </span>
    );
  },
);

Badge.displayName = "Badge";
