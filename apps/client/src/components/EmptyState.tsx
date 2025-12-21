import React, { memo } from "react";
import { Icon } from "./Icon.tsx";
import { Button } from "./Button.tsx";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = memo<EmptyStateProps>(
  ({ icon = "info", title, description, actionLabel, onAction }) => {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <Icon name={icon} size={48} />
        </div>
        <h3 className="empty-state-title">{title}</h3>
        {description && (
          <p className="empty-state-description">{description}</p>
        )}
        {actionLabel && onAction && (
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    );
  },
);

EmptyState.displayName = "EmptyState";
