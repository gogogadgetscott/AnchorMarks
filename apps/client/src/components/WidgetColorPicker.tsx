interface WidgetColorPickerProps {
  currentColor?: string;
  onColorSelect: (color: string) => void;
}

const WIDGET_COLORS = [
  { name: "Blue", value: "#6366f1" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#10b981" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Gray", value: "#6b7280" },
  { name: "Slate", value: "#475569" },
] as const;

export function WidgetColorPicker({
  currentColor,
  onColorSelect,
}: WidgetColorPickerProps) {
  return (
    <div className="widget-color-picker-inline">
      <div className="color-picker-grid">
        {WIDGET_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            className="color-picker-option"
            data-color={color.value}
            title={color.name}
            style={{ background: color.value }}
            onClick={(e) => {
              e.stopPropagation();
              onColorSelect(color.value);
            }}
          >
            {currentColor === color.value && (
              <span className="color-check">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
