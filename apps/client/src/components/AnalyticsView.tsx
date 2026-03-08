import { useState, useEffect } from "react";
import { api } from "@services/api.ts";
import { Icon } from "./Icon.tsx";

/**
 * AnchorMarks - Analytics Dashboard Component
 * Provides insights and visualizations for bookmarking habits
 */

interface MonthlyGrowth {
  month: string;
  count: number;
}

interface DomainStats {
  domain: string;
  count: number;
}

interface AdvancedStats {
  total_bookmarks: number;
  total_folders: number;
  total_tags: number;
  favorites: number;
  top_clicked: {
    title: string;
    url: string;
    favicon: string;
    click_count: number;
  }[];
  top_tags: [string, number][];
  monthly_growth: MonthlyGrowth[];
  top_domains: DomainStats[];
  dead_links: number;
  totalClicks: number;
  unread: number;
  frequentlyUsed: number;
}

export function AnalyticsView() {
  const [stats, setStats] = useState<AdvancedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const data = await api<AdvancedStats>("/stats/advanced");
        setStats(data);
        setError(null);
      } catch (err) {
        setError("Failed to load analytics data. Please try again later.");
        console.error("Analytics fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="spinner"></div>
        <p>Crunching the numbers...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="analytics-container">
        <div className="error-state">
          <Icon name="archive" size={48} />
          <p>{error || "No data available."}</p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const avgTagsPerBookmark =
    stats.total_bookmarks > 0
      ? (
          stats.top_tags.reduce((sum, [, count]) => sum + count, 0) /
          stats.total_bookmarks
        ).toFixed(1)
      : "0";

  return (
    <div className="analytics-container">
      <div className="analytics-dashboard">
        <div className="analytics-header">
          <h1>Advanced Analytics</h1>
          <p>Your digital collection, by the numbers.</p>
        </div>

        <div className="analytics-grid">
          {/* Key Metrics */}
          <MetricCard
            value={stats.total_bookmarks}
            label="Total Bookmarks"
            sparklineData={stats.monthly_growth.map((m) => m.count)}
          />
          <MetricCard
            value={stats.favorites}
            label="Favorites"
            subtext={`${stats.total_bookmarks > 0 ? ((stats.favorites / stats.total_bookmarks) * 100).toFixed(1) : 0}% of total`}
          />
          <MetricCard
            value={stats.totalClicks}
            label="Total Clicks"
            subtext={`Engagement Score: ${stats.total_bookmarks > 0 ? (stats.totalClicks / stats.total_bookmarks).toFixed(1) : 0}`}
          />
          <MetricCard
            value={stats.dead_links}
            label="Dead Links"
            subtext={stats.dead_links > 0 ? "Action required" : "All clear!"}
            isDanger={stats.dead_links > 0}
          />
          <MetricCard
            value={stats.total_tags}
            label="Total Tags"
            subtext={`~${avgTagsPerBookmark} tags per bookmark`}
          />

          {/* Monthly Growth Chart */}
          <div className="analytics-card chart-card growth-chart">
            <h3>Monthly Growth</h3>
            <BarChart data={stats.monthly_growth} color="#6366f1" />
          </div>

          {/* Top Domains */}
          <div className="analytics-card list-card">
            <h3>Top Domains</h3>
            <div className="domain-list">
              {stats.top_domains.map((d) => (
                <ProgressBarItem
                  key={d.domain}
                  label={d.domain}
                  value={d.count}
                  max={stats.top_domains[0]?.count || 1}
                />
              ))}
            </div>
          </div>

          {/* Tag Insights */}
          <div className="analytics-card list-card analytics-tag-insights">
            <h3>Tag Insights</h3>
            <div className="tag-insights-summary">
              <span className="tag-insight-stat">
                {stats.total_tags} unique tags
              </span>
              <span className="tag-insight-stat">
                {stats.top_tags.reduce((s, [, c]) => s + c, 0)} total usages
              </span>
            </div>
            <div className="domain-list tag-list">
              {stats.top_tags.map(([name, count]) => (
                <ProgressBarItem
                  key={name}
                  label={name}
                  value={count}
                  max={stats.top_tags[0]?.[1] || 1}
                  className="tag-bar"
                />
              ))}
            </div>
          </div>

          {/* Distribution */}
          <div className="analytics-card list-card">
            <h3>Collection Distribution</h3>
            <div className="dist-item">
              <span>Read vs Unread</span>
              <div className="progress-multi">
                <div
                  className="progress-segment"
                  style={{
                    width: `${stats.total_bookmarks > 0 ? ((stats.total_bookmarks - stats.unread) / stats.total_bookmarks) * 100 : 0}%`,
                    background: "#6366f1",
                  }}
                  title="Read"
                ></div>
                <div
                  className="progress-segment"
                  style={{
                    width: `${stats.total_bookmarks > 0 ? (stats.unread / stats.total_bookmarks) * 100 : 0}%`,
                    background: "#e5e7eb",
                  }}
                  title="Unread"
                ></div>
              </div>
              <div className="dist-labels">
                <span>Read: {stats.total_bookmarks - stats.unread}</span>
                <span>Unread: {stats.unread}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ value, label, subtext, sparklineData, isDanger }: any) {
  return (
    <div className="analytics-card metric-card">
      <div className={`metric-value ${isDanger ? "text-danger" : ""}`}>
        {value}
      </div>
      <div className="metric-label">{label}</div>
      {subtext && <div className="metric-subtext">{subtext}</div>}
      {sparklineData && <Sparkline data={sparklineData} color="#6366f1" />}
    </div>
  );
}

function ProgressBarItem({ label, value, max, className = "" }: any) {
  return (
    <div className={`domain-item ${className}`}>
      <span className="domain-name">{label}</span>
      <span className="domain-count">{value}</span>
      <div
        className={`domain-bar`}
        style={{ width: `${(value / max) * 100}%` }}
      ></div>
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const width = 100;
  const height = 30;
  const padding = 2;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y =
        height -
        ((d - min) / (max - min || 1)) * (height - padding * 2) -
        padding;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function BarChart({ data, color }: { data: MonthlyGrowth[]; color: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  const width = 100;
  const height = 40;
  const gap = 2;
  const barWidth = (width - (data.length - 1) * gap) / data.length;

  return (
    <div className="bar-chart-container">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const barHeight = (d.count / max) * height;
          const x = i * (barWidth + gap);
          const y = height - barHeight;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={color}
              rx="1"
            />
          );
        })}
      </svg>
      <div className="bar-chart-labels">
        {data.map((d, i) => (
          <span key={i}>{d.month.split("-")[1]}</span>
        ))}
      </div>
    </div>
  );
}
