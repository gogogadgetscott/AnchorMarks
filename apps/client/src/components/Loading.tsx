import React, { memo } from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const LoadingSpinner = memo<LoadingSpinnerProps>(
  ({ size = "md", className = "" }) => {
    const sizeClasses = {
      sm: "spinner-sm",
      md: "spinner-md",
      lg: "spinner-lg",
    };

    return (
      <div
        className={`loading-spinner ${sizeClasses[size]} ${className}`.trim()}
      >
        <div className="spinner"></div>
      </div>
    );
  },
);

LoadingSpinner.displayName = "LoadingSpinner";

interface LoadingStateProps {
  message?: string;
}

export const LoadingState = memo<LoadingStateProps>(
  ({ message = "Loading..." }) => {
    return (
      <div className="loading-state">
        <LoadingSpinner size="lg" />
        <p className="loading-message">{message}</p>
      </div>
    );
  },
);

LoadingState.displayName = "LoadingState";
