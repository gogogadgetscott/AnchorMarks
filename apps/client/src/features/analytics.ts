/**
 * AnchorMarks - Analytics Module
 * Provides insights and visualizations for bookmarking habits
 */

import { api } from "@services/api.ts";
import * as state from "@features/state.ts";
import { escapeHtml } from "@utils/index.ts";
import { dom, showToast } from "@utils/ui-helpers.ts";
import { logger } from "@utils/logger.ts";

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

/**
 * Render the Advanced Analytics dashboard
 */
export async function renderAnalytics(): Promise<void> {
  if (state.currentView !== "analytics") return;

  const container =
    dom.mainViewOutlet || document.getElementById("main-view-outlet");
  if (!container) return;

  container.innerHTML = `
    <div class="analytics-loading">
      <div class="spinner"></div>
      <p>Crunching the numbers...</p>
    </div>
  `;

  try {
    const stats = await api<AdvancedStats>("/stats/advanced");
    renderDashboard(container, stats);
  } catch (err) {
    logger.error("Failed to fetch analytics data", err);
    showToast("Failed to load analytics", "error");
    container.innerHTML = `<div class="error-state">Failed to load analytics data.</div>`;
  }
}

function renderDashboard(container: HTMLElement, stats: AdvancedStats): void {
  const topDomains = stats.top_domains ?? [];
  const maxDomainCount = topDomains.length > 0 ? topDomains[0].count : 1;
  const topTags = stats.top_tags ?? [];
  const maxTagCount = topTags.length > 0 ? topTags[0][1] : 1;
  const totalTagUsages = topTags.reduce((sum, [, count]) => sum + count, 0);
  const avgTagsPerBookmark =
    stats.total_bookmarks > 0 && totalTagUsages > 0
      ? (totalTagUsages / stats.total_bookmarks).toFixed(1)
      : "0";

  container.innerHTML = `
    <div class="analytics-dashboard">
      <div class="analytics-header">
        <h1>Advanced Analytics</h1>
        <p>Your digital collection, by the numbers.</p>
      </div>

      <div class="analytics-grid">
        <!-- Key Metrics -->
        <div class="analytics-card metric-card">
          <div class="metric-value">${stats.total_bookmarks}</div>
          <div class="metric-label">Total Bookmarks</div>
          ${renderSparkline(
            stats.monthly_growth?.map((m) => m.count) ?? [],
            "#6366f1",
          )}
        </div>
        <div class="analytics-card metric-card">
          <div class="metric-value">${stats.favorites}</div>
          <div class="metric-label">Favorites</div>
          <div class="metric-subtext">${stats.total_bookmarks > 0 ? ((stats.favorites / stats.total_bookmarks) * 100).toFixed(1) : 0}% of total</div>
        </div>
        <div class="analytics-card metric-card">
          <div class="metric-value">${stats.totalClicks}</div>
          <div class="metric-label">Total Clicks</div>
          <div class="metric-subtext">Engagement Score: ${stats.total_bookmarks > 0 && stats.totalClicks > 0 ? (stats.totalClicks / stats.total_bookmarks).toFixed(1) : 0}</div>
        </div>
        <div class="analytics-card metric-card">
          <div class="metric-value ${stats.dead_links > 0 ? "text-danger" : ""}">${stats.dead_links}</div>
          <div class="metric-label">Dead Links</div>
          <div class="metric-subtext">${stats.dead_links > 0 ? "Action required" : "All clear!"}</div>
        </div>
        <div class="analytics-card metric-card">
          <div class="metric-value">${stats.total_tags}</div>
          <div class="metric-label">Total Tags</div>
          <div class="metric-subtext">~${avgTagsPerBookmark} tags per bookmark</div>
        </div>

        <!-- Monthly Growth Chart -->
        <div class="analytics-card chart-card growth-chart">
          <h3>Monthly Growth</h3>
          ${renderBarChart(stats.monthly_growth, "#6366f1")}
        </div>

        <!-- Top Domains -->
        <div class="analytics-card list-card">
          <h3>Top Domains</h3>
          <div class="domain-list">
            ${topDomains
              .map(
                (d) => `
              <div class="domain-item">
                <span class="domain-name">${escapeHtml(d.domain)}</span>
                <span class="domain-count">${d.count}</span>
                <div class="domain-bar" style="width: ${(d.count / maxDomainCount) * 100}%"></div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>

        <!-- Tag Insights -->
        <div class="analytics-card list-card analytics-tag-insights">
          <h3>Tag Insights</h3>
          <div class="tag-insights-summary">
            <span class="tag-insight-stat">${stats.total_tags} unique tags</span>
            <span class="tag-insight-stat">${totalTagUsages} total usages</span>
          </div>
          <div class="domain-list tag-list">
            ${topTags
              .map(
                ([name, count]) => `
              <div class="domain-item tag-item">
                <span class="domain-name">${escapeHtml(name)}</span>
                <span class="domain-count">${count}</span>
                <div class="domain-bar tag-bar" style="width: ${(count / maxTagCount) * 100}%"></div>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>

        <!-- Distribution -->
        <div class="analytics-card list-card">
          <h3>Collection Distribution</h3>
          <div class="dist-item">
            <span>Read vs Unread</span>
            <div class="progress-multi">
              <div class="progress-segment" style="width: ${stats.total_bookmarks > 0 ? ((stats.total_bookmarks - (stats.unread ?? 0)) / stats.total_bookmarks) * 100 : 0}%; background: #6366f1" title="Read"></div>
              <div class="progress-segment" style="width: ${stats.total_bookmarks > 0 ? ((stats.unread ?? 0) / stats.total_bookmarks) * 100 : 0}%; background: #e5e7eb" title="Unread"></div>
            </div>
            <div class="dist-labels">
              <span>Read: ${stats.total_bookmarks - (stats.unread ?? 0)}</span>
              <span>Unread: ${stats.unread ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSparkline(data: number[], color: string): string {
  if (data.length < 2) return "";
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

  return `
    <svg viewBox="0 0 ${width} ${height}" class="sparkline">
      <polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
    </svg>
  `;
}

function renderBarChart(data: MonthlyGrowth[], color: string): string {
  const max = Math.max(...data.map((d) => d.count), 1);
  const width = 100;
  const height = 40;
  const gap = 2;
  const barWidth = (width - (data.length - 1) * gap) / data.length;

  return `
    <div class="bar-chart-container">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        ${data
          .map((d, i) => {
            const barHeight = (d.count / max) * height;
            const x = i * (barWidth + gap);
            const y = height - barHeight;
            return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="1" />`;
          })
          .join("")}
      </svg>
      <div class="bar-chart-labels">
        ${data.map((d) => `<span>${d.month.split("-")[1]}</span>`).join("")}
      </div>
    </div>
  `;
}

export default { renderAnalytics };
