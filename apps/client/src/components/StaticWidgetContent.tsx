interface StaticWidgetContentProps {
  data: Record<string, number>;
  emptyLabel?: string;
}

export function StaticWidgetContent({
  data,
  emptyLabel = "No metrics yet",
}: StaticWidgetContentProps) {
  const entries = Object.entries(data);

  if (!entries.length) {
    return <p className="widget-empty-state">{emptyLabel}</p>;
  }

  return (
    <ul className="widget-stats-list" aria-label="Widget metrics">
      {entries.map(([label, value]) => (
        <li key={label} className="widget-stats-item">
          <span className="widget-stats-label">{label}</span>
          <span className="badge">{value}</span>
        </li>
      ))}
    </ul>
  );
}
