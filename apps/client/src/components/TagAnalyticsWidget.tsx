import { useState, useCallback } from "react";
import type { TagAnalyticsItem, CooccurrenceItem } from "../types/index";

interface TagAnalyticsWidgetProps {
  widgetIndex: number;
  tags: TagAnalyticsItem[];
  cooccurrence: CooccurrenceItem[];
  initialSettings?: {
    metric?: string;
    limit?: number;
    pairSort?: string;
    colors?: {
      usage?: string;
      clicks?: string;
      favorites?: string;
      pairs?: string;
    };
  };
  onSettingsChange?: (
    widgetIndex: number,
    settings: {
      metric?: string;
      limit?: number;
      pairSort?: string;
      colors?: {
        usage?: string;
        clicks?: string;
        favorites?: string;
        pairs?: string;
      };
    },
  ) => void;
}

const DEFAULT_COLORS = {
  usage: "#6366f1",
  clicks: "#f97316",
  favorites: "#eab308",
  pairs: "#6b7280",
};

export function TagAnalyticsWidget({
  widgetIndex,
  tags,
  cooccurrence,
  initialSettings = {},
  onSettingsChange,
}: TagAnalyticsWidgetProps) {
  const [metric, setMetric] = useState(initialSettings.metric || "count");
  const [limit, setLimit] = useState(initialSettings.limit || 20);
  const [pairSort, setPairSort] = useState(
    initialSettings.pairSort || "count",
  );
  const [colors, setColors] = useState({
    ...DEFAULT_COLORS,
    ...initialSettings.colors,
  });

  const notifyChange = useCallback(
    (updates: Partial<typeof initialSettings>) => {
      if (onSettingsChange) {
        onSettingsChange(widgetIndex, {
          metric,
          limit,
          pairSort,
          colors,
          ...updates,
        });
      }
    },
    [widgetIndex, metric, limit, pairSort, colors, onSettingsChange],
  );

  const handleMetricChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newMetric = e.target.value;
      setMetric(newMetric);
      notifyChange({ metric: newMetric });
    },
    [notifyChange],
  );

  const handleLimitChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLimit = parseInt(e.target.value, 10);
      setLimit(newLimit);
      notifyChange({ limit: newLimit });
    },
    [notifyChange],
  );

  const handlePairSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newPairSort = e.target.value;
      setPairSort(newPairSort);
      notifyChange({ pairSort: newPairSort });
    },
    [notifyChange],
  );

  const handleColorChange = useCallback(
    (colorKey: keyof typeof colors) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColors = { ...colors, [colorKey]: e.target.value };
        setColors(newColors);
        notifyChange({ colors: newColors });
      },
    [colors, notifyChange],
  );

  const downloadFile = useCallback(
    (name: string, mime: string, text: string) => {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = name;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    },
    [],
  );

  const toCSV = useCallback(<T extends object>(rows: T[], columns: string[]) => {
    const header = columns.join(",");
    const body = rows
      .map((r) =>
        columns
          .map((c) => {
            const value = (r as Record<string, unknown>)[c];
            const v = value != null ? String(value) : "";
            const escaped = v.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(","),
      )
      .join("\n");
    return `${header}\n${body}`;
  }, []);

  const handleExportJSON = useCallback(() => {
    const payload = JSON.stringify({ tags, cooccurrence }, null, 2);
    downloadFile("tag-analytics.json", "application/json", payload);
  }, [tags, cooccurrence, downloadFile]);

  const handleExportTagsCSV = useCallback(() => {
    const columns = ["name", "count"];
    if (tags.length > 0) {
      if (typeof tags[0].click_count_sum !== "undefined") {
        columns.push("click_count_sum");
      }
      if (typeof tags[0].favorite_count_sum !== "undefined") {
        columns.push("favorite_count_sum");
      }
    }
    const csv = toCSV(tags, columns);
    downloadFile("tag-analytics-tags.csv", "text/csv", csv);
  }, [tags, toCSV, downloadFile]);

  const handleExportPairsCSV = useCallback(() => {
    const csv = toCSV(cooccurrence, ["tag_name_a", "tag_name_b", "count"]);
    downloadFile("tag-analytics-pairs.csv", "text/csv", csv);
  }, [cooccurrence, toCSV, downloadFile]);

  // Sort and filter tags
  const sortedTags = [...tags].sort((a, b) => {
    const metricKey = metric as keyof TagAnalyticsItem;
    const left = Number(a[metricKey] || 0);
    const right = Number(b[metricKey] || 0);
    return right - left;
  });
  const topTags = sortedTags.slice(0, limit);

  // Sort and filter pairs
  const sortedPairs = [...cooccurrence].sort((a, b) => {
    if (pairSort === "alpha") {
      const left = `${a.tag_name_a} + ${a.tag_name_b}`.toLowerCase();
      const right = `${b.tag_name_a} + ${b.tag_name_b}`.toLowerCase();
      return left.localeCompare(right);
    }
    return (b.count || 0) - (a.count || 0);
  });
  const topPairs = sortedPairs.slice(0, limit);

  // Determine metric color
  const metricColor =
    metric === "count"
      ? colors.usage
      : metric === "click_count_sum"
        ? colors.clicks
        : colors.favorites;

  return (
    <div className="tag-analytics">
      <div
        className="tag-analytics-controls"
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "0.5rem",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
            Metric
          </span>
          <select
            className="tag-analytics-metric"
            value={metric}
            onChange={handleMetricChange}
          >
            <option value="count">Usage</option>
            <option value="click_count_sum">Clicks</option>
            <option value="favorite_count_sum">Favorites</option>
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
            Top N
          </span>
          <select
            className="tag-analytics-limit"
            value={limit}
            onChange={handleLimitChange}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="30">30</option>
            <option value="50">50</option>
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
            Pairs Sort
          </span>
          <select
            className="tag-analytics-pairsort"
            value={pairSort}
            onChange={handlePairSortChange}
          >
            <option value="count">Count</option>
            <option value="alpha">A-Z</option>
          </select>
        </label>
        <div
          className="tag-analytics-exports"
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: "0.25rem",
          }}
        >
          <button
            type="button"
            className="btn btn-sm tag-analytics-export-json"
            title="Export JSON"
            onClick={handleExportJSON}
          >
            JSON
          </button>
          <button
            type="button"
            className="btn btn-sm tag-analytics-export-tags-csv"
            title="Export Tags CSV"
            onClick={handleExportTagsCSV}
          >
            Tags CSV
          </button>
          <button
            type="button"
            className="btn btn-sm tag-analytics-export-pairs-csv"
            title="Export Pairs CSV"
            onClick={handleExportPairsCSV}
          >
            Pairs CSV
          </button>
        </div>
      </div>

      <div
        className="tag-analytics-colors"
        style={{
          display: "flex",
          gap: "0.5rem",
          alignItems: "center",
          marginBottom: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
            Usage
          </span>
          <input
            type="color"
            className="tag-analytics-color-usage"
            style={{ width: "24px", height: "20px", border: "none", cursor: "pointer" }}
            value={colors.usage}
            onChange={handleColorChange("usage")}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
            Clicks
          </span>
          <input
            type="color"
            className="tag-analytics-color-clicks"
            style={{ width: "24px", height: "20px", border: "none", cursor: "pointer" }}
            value={colors.clicks}
            onChange={handleColorChange("clicks")}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
            Favorites
          </span>
          <input
            type="color"
            className="tag-analytics-color-favorites"
            style={{ width: "24px", height: "20px", border: "none", cursor: "pointer" }}
            value={colors.favorites}
            onChange={handleColorChange("favorites")}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-tertiary)" }}>
            Pairs
          </span>
          <input
            type="color"
            className="tag-analytics-color-pairs"
            style={{ width: "24px", height: "20px", border: "none", cursor: "pointer" }}
            value={colors.pairs}
            onChange={handleColorChange("pairs")}
          />
        </label>
      </div>

      <div
        className="tag-analytics-legend"
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}
      >
        <span
          className="legend-item"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.75rem",
            color: "var(--text-tertiary)",
          }}
        >
          <span
            className="legend-color legend-usage"
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              background: colors.usage,
              borderRadius: "2px",
            }}
          ></span>
          Usage
        </span>
        <span
          className="legend-item"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.75rem",
            color: "var(--text-tertiary)",
          }}
        >
          <span
            className="legend-color legend-clicks"
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              background: colors.clicks,
              borderRadius: "2px",
            }}
          ></span>
          Clicks
        </span>
        <span
          className="legend-item"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.75rem",
            color: "var(--text-tertiary)",
          }}
        >
          <span
            className="legend-color legend-favorites"
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              background: colors.favorites,
              borderRadius: "2px",
            }}
          ></span>
          Favorites
        </span>
        <span
          className="legend-item"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            fontSize: "0.75rem",
            color: "var(--text-tertiary)",
          }}
        >
          <span
            className="legend-color legend-pairs"
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              background: colors.pairs,
              borderRadius: "2px",
            }}
          ></span>
          Pairs
        </span>
      </div>

      <div
        className="tag-analytics-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.75rem",
        }}
      >
        <div className="tag-analytics-col">
          <div
            className="tag-analytics-col-title"
            style={{ fontWeight: 600, marginBottom: "0.25rem" }}
          >
            Top Tags
          </div>
          <div
            className="tag-analytics-list tag-analytics-top-tags"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "0.25rem",
            }}
          >
            {topTags.map((t) => {
              const metricKey = metric as keyof TagAnalyticsItem;
              const value = Number(t[metricKey] || 0);
              return (
                <div
                  key={t.name}
                  style={{ display: "contents" }}
                  data-testid="tag-analytics-tag"
                >
                  <div className="tag-name" title={t.name}>
                    {t.name}
                  </div>
                  <div
                    className="tag-count"
                    style={{ textAlign: "right", color: metricColor }}
                  >
                    {value}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="tag-analytics-col">
          <div
            className="tag-analytics-col-title"
            style={{ fontWeight: 600, marginBottom: "0.25rem" }}
          >
            Top Co-occurrence
          </div>
          <div
            className="tag-analytics-list tag-analytics-cooccurrence"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "0.25rem",
            }}
          >
            {topPairs.map((p, idx) => (
              <div
                key={`${p.tag_name_a}-${p.tag_name_b}-${idx}`}
                style={{ display: "contents" }}
                data-testid="tag-analytics-pair"
              >
                <div
                  className="pair-name"
                  title={`${p.tag_name_a} + ${p.tag_name_b}`}
                >
                  {p.tag_name_a} + {p.tag_name_b}
                </div>
                <div
                  className="pair-count"
                  style={{ textAlign: "right", color: colors.pairs }}
                >
                  {p.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
