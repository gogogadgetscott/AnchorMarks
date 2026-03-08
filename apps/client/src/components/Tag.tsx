import React from "react";

interface TagProps {
  name: string;
  color?: string;
  className?: string;
  data?: Record<string, string | number | boolean>;
  clickable?: boolean;
  onClick?: React.MouseEventHandler<HTMLSpanElement>;
}

export function Tag({
  name,
  color = "#f59e0b",
  className = "",
  data = {},
  clickable = true,
  onClick,
}: TagProps) {
  const dataAttrs = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [`data-${key}`, String(value)]),
  );

  return (
    <span
      className={`tag ${className}`}
      {...dataAttrs}
      style={
        {
          "--tag-color": color,
          cursor: clickable ? "pointer" : "default",
        } as React.CSSProperties
      }
      onClick={onClick}
    >
      {name}
    </span>
  );
}

interface TagChipProps {
  name: string;
  id?: string;
  className?: string;
  active?: boolean;
  onRemove?: () => void;
}

export function TagChip({
  name,
  id,
  className = "",
  active = false,
  onRemove,
}: TagChipProps) {
  return (
    <div
      id={id}
      className={`filter-chip tag-chip ${active ? "active" : ""} ${className}`}
      data-tag={name}
    >
      <span>{name}</span>
      <button
        type="button"
        className="remove-filter"
        aria-label="Remove tag filter"
        onClick={onRemove}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
