import React from "react";
import { Icon } from "./Icon.tsx";

export type ViewMode = "grid" | "list" | "compact";

interface ViewToggleProps {
  activeMode?: ViewMode;
  modes?: ViewMode[];
  onModeChange?: (mode: ViewMode) => void;
}

const modeConfig: Record<ViewMode, { icon: string; title: string }> = {
  grid: { icon: "grid", title: "Grid View" },
  list: { icon: "list", title: "List View" },
  compact: { icon: "compact", title: "Compact List" },
};

export function ViewToggle({
  activeMode = "grid",
  modes = ["grid", "list", "compact"],
  onModeChange,
}: ViewToggleProps) {
  return (
    <div className="view-toggle">
      {modes.map((mode) => (
        <button
          key={mode}
          className={`view-btn ${mode === activeMode ? "active" : ""}`}
          data-view-mode={mode}
          title={modeConfig[mode].title}
          onClick={() => onModeChange?.(mode)}
        >
          <Icon name={modeConfig[mode].icon} size={18} />
        </button>
      ))}
    </div>
  );
}
