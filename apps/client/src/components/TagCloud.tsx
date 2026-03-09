import { useMemo, useState, useEffect } from "react";
import { useBookmarks } from "../contexts/BookmarksContext";
import { useUI } from "../contexts/UIContext";
import { setFilterConfig as vanillaSetFilterConfig } from "../features/state";
import { Icon } from "./Icon.tsx";
import { pluralize, safeLocalStorage } from "@utils/index.ts";

/**
 * AnchorMarks - Tag Cloud Component
 * Renders an interactive, animated tag cloud visualization
 */

// Gradient stops used for count → color mapping (low → high)
const COUNT_GRADIENT_STOPS = [
  "#6366f1", // indigo (least)
  "#06b6d4", // cyan
  "#22c55e", // green
  "#eab308", // yellow
  "#f97316", // orange
  "#ec4899", // pink (most)
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const bigint = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function interpolate(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function interpolateGradient(stops: string[], t: number): string {
  if (t <= 0) return stops[0];
  if (t >= 1) return stops[stops.length - 1];
  const segment = 1 / (stops.length - 1);
  const i = Math.floor(t / segment);
  const localT = (t - i * segment) / segment;

  const c1 = hexToRgb(stops[i]);
  const c2 = hexToRgb(stops[i + 1]);
  const r = interpolate(c1.r, c2.r, localT);
  const g = interpolate(c1.g, c2.g, localT);
  const b = interpolate(c1.b, c2.b, localT);
  return rgbToHex(r, g, b);
}

function getColorForCount(
  count: number,
  minCount: number,
  maxCount: number,
): string {
  if (maxCount === minCount)
    return COUNT_GRADIENT_STOPS[Math.floor(COUNT_GRADIENT_STOPS.length / 2)];
  const t = (count - minCount) / (maxCount - minCount);
  return interpolateGradient(COUNT_GRADIENT_STOPS, t);
}

function getContrastText(bgHex: string): string {
  const { r, g, b } = hexToRgb(bgHex);
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  return L > 0.6 ? "#0f172a" : "#ffffff";
}

function getBaseFontSizes(containerHeight: number): number[] {
  const scale = Math.min(1, containerHeight / 600);
  const baseSizes = [12, 16, 20, 26, 32, 36, 44];
  return baseSizes.map((size) => Math.max(11, size * scale));
}

function getFontSizeForCount(
  count: number,
  minCount: number,
  maxCount: number,
  fontSizes: number[],
): number {
  if (maxCount === minCount) return fontSizes[Math.floor(fontSizes.length / 2)];
  const range = maxCount - minCount;
  const normalized = (count - minCount) / range;
  const index = Math.floor(normalized * (fontSizes.length - 1));
  return fontSizes[index];
}

function calculateOpacity(
  count: number,
  minCount: number,
  maxCount: number,
): number {
  const minOpacity = 0.6;
  const maxOpacity = 1;
  if (maxCount === minCount) return (minOpacity + maxOpacity) / 2;
  const scale = (count - minCount) / (maxCount - minCount);
  return minOpacity + scale * (maxOpacity - minOpacity);
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function TagCloud() {
  const { tagMetadata, setTagMetadata, fetchTagStats, filterConfig, setFilterConfig } = useBookmarks();
  const { setCurrentView } = useUI();
  const [showAll, setShowAll] = useState(() => {
    const stored = safeLocalStorage.getItem("anchormarks_tag_cloud_show_all");
    return stored === "true";
  });
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [canvasHeight, setCanvasHeight] = useState(600);

  useEffect(() => {
    fetchTagStats().then((tagStats) => {
      if (tagStats.length === 0) return;
      const metadata: Record<string, { color?: string; icon?: string; id?: string; count?: number }> = {};
      tagStats.forEach((t) => {
        metadata[t.name] = { color: t.color, id: t.id, count: t.count };
      });
      setTagMetadata(metadata);
    });
  }, []);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);

    // Initial canvas height calculation
    const headerEl = document.querySelector(".content-header") as HTMLElement;
    const headerHeight = headerEl
      ? headerEl.getBoundingClientRect().height
      : 64;
    const legendReserve = 150; // Roughly legend + header padding
    setCanvasHeight(
      Math.max(300, window.innerHeight - headerHeight - legendReserve),
    );

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const tags = useMemo(() => {
    return Object.keys(tagMetadata)
      .map((name) => ({
        name,
        count: Number(tagMetadata[name].count || 0),
      }))
      .sort((a, b) => b.count - a.count);
  }, [tagMetadata]);

  const displayedTags = useMemo(() => {
    let maxTags = 120;
    if (windowWidth < 480) maxTags = 40;
    else if (windowWidth < 768) maxTags = 60;
    else if (windowWidth < 1280) maxTags = 90;

    const baseTags = showAll ? tags : tags.slice(0, maxTags);
    return shuffleArray(baseTags);
  }, [tags, showAll, windowWidth]);

  const { minCount, maxCount, totalUsages } = useMemo(() => {
    if (displayedTags.length === 0)
      return { minCount: 0, maxCount: 0, totalUsages: 0 };
    const counts = displayedTags.map((t) => t.count);
    return {
      minCount: Math.min(...counts),
      maxCount: Math.max(...counts),
      totalUsages: tags.reduce((sum, t) => sum + t.count, 0),
    };
  }, [displayedTags, tags]);

  const fontSizes = useMemo(
    () => getBaseFontSizes(canvasHeight),
    [canvasHeight],
  );

  const handleTagClick = async (tagName: string) => {
    const newFilter = { ...filterConfig, tags: [tagName] };
    setFilterConfig(newFilter);
    vanillaSetFilterConfig(newFilter);
    await setCurrentView("all");
    // Update the filter button count in the header
    const { updateFilterButtonText } = await import("../features/bookmarks/filters.ts");
    updateFilterButtonText();
  };

  const handleToggleShowAll = () => {
    const next = !showAll;
    setShowAll(next);
    safeLocalStorage.setItem("anchormarks_tag_cloud_show_all", String(next));
  };

  if (tags.length === 0) {
    return (
      <div className="tag-cloud-container">
        <div className="tag-cloud-empty">
          <div className="tag-cloud-empty-icon">
            <Icon name="tag" size={48} />
          </div>
          <h3>No Tags Yet</h3>
          <p>
            Try organizing your bookmarks with <kbd>#tags</kbd> to see them
            visualized here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tag-cloud-container">
      <div className="tag-cloud-view">
        <div className="tag-cloud-header">
          <div className="tag-cloud-title">
            <Icon name="tag" size={24} />
            <h2>Tag Cloud</h2>
            <span className="tag-cloud-count">
              {showAll ? tags.length : displayedTags.length} of {tags.length}{" "}
              {pluralize(tags.length, "tag", "tags")}
            </span>
          </div>
          <div className="tag-cloud-stats">
            <div className="tag-cloud-stat">
              <span className="stat-number">{totalUsages}</span>
              <span className="stat-label">Total Usages</span>
            </div>
            <div className="tag-cloud-stat">
              <span className="stat-number">{maxCount}</span>
              <span className="stat-label">Most Used</span>
            </div>
            <div className="tag-cloud-stat">
              <button
                className="tag-cloud-toggle"
                onClick={handleToggleShowAll}
                aria-pressed={showAll}
              >
                {showAll ? "Show Top" : "Show All"}
              </button>
            </div>
            <div className="tag-cloud-stat">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setCurrentView("analytics")}
              >
                View Analytics
              </button>
            </div>
          </div>
        </div>

        <div
          className="tag-cloud-canvas"
          style={
            {
              minHeight: `${canvasHeight}px`,
              "--tag-cloud-canvas-height": `${canvasHeight}px`,
            } as any
          }
        >
          {displayedTags.map((tag, index) => {
            const fontSize = getFontSizeForCount(
              tag.count,
              minCount,
              maxCount,
              fontSizes,
            );
            const opacity = calculateOpacity(tag.count, minCount, maxCount);
            const delay = (index * 0.03).toFixed(2);
            const rotation =
              Math.random() > 0.85
                ? Math.random() > 0.5
                  ? "3deg"
                  : "-3deg"
                : "0deg";
            const bgColor = getColorForCount(tag.count, minCount, maxCount);
            const textColor = getContrastText(bgColor);

            return (
              <button
                key={tag.name}
                className="tag-cloud-tag"
                onClick={() => handleTagClick(tag.name)}
                style={
                  {
                    "--tag-color": bgColor,
                    "--tag-text": textColor,
                    "--tag-size": `${fontSize}px`,
                    "--tag-opacity": opacity,
                    "--tag-delay": `${delay}s`,
                    "--tag-rotation": rotation,
                  } as any
                }
                title={`${tag.name} (${tag.count} ${pluralize(tag.count, "bookmark", "bookmarks")})`}
              >
                {tag.name}
                <span className="tag-cloud-tag-count">{tag.count}</span>
              </button>
            );
          })}
        </div>

        <div className="tag-cloud-legend">
          <div className="legend-item">
            <span className="legend-size legend-small">A</span>
            <span>Less Used</span>
          </div>
          <div className="legend-gradient"></div>
          <div className="legend-item">
            <span className="legend-size legend-large">A</span>
            <span>Most Used</span>
          </div>
        </div>
      </div>
    </div>
  );
}
