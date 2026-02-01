/**
 * AnchorMarks - Maintenance Module
 * Handles maintenance operations: favicon refresh, duplicate detection, broken link checking
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import { showToast } from "@utils/ui-helpers.ts";
import { escapeHtml } from "@utils/index.ts";
import { confirmDialog } from "@features/ui/confirm-dialog.ts";

let linkCheckAbortController: AbortController | null = null;

// Delay between requests to prevent overwhelming the server with concurrent outgoing HTTP requests
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const CONCURRENCY_DELAY = 200; // ms between requests - needed to prevent server connection floods

/**
 * Initialize maintenance event listeners
 */
export function initMaintenance(): void {
  // Refresh Favicons
  document
    .getElementById("refresh-favicons-btn")
    ?.addEventListener("click", refreshFavicons);

  // Find Duplicates
  document
    .getElementById("find-duplicates-btn")
    ?.addEventListener("click", findDuplicates);

  // Check Broken Links
  document
    .getElementById("check-links-btn")
    ?.addEventListener("click", checkBrokenLinks);
  document
    .getElementById("stop-check-links-btn")
    ?.addEventListener("click", stopLinkCheck);
}

/**
 * Refresh all favicons
 */
async function refreshFavicons(): Promise<void> {
  const btn = document.getElementById(
    "refresh-favicons-btn",
  ) as HTMLButtonElement;
  const progress = document.getElementById("favicon-progress");
  const progressFill = document.getElementById("favicon-progress-fill");
  const progressText = document.getElementById("favicon-progress-text");

  if (!btn || !progress || !progressFill || !progressText) return;

  btn.disabled = true;
  progress.classList.remove("hidden");

  try {
    // Fetch all bookmarks directly from API to ensure we process everything
    const response = await api<{ bookmarks: any[] }>("/bookmarks?limit=10000"); // Ensure we get all bookmarks
    const allBookmarks = response.bookmarks || [];

    const bookmarks = allBookmarks.filter(
      (b) =>
        b.url &&
        !b.url.startsWith("view:") &&
        !b.url.startsWith("bookmark-view:") &&
        !b.url.startsWith("javascript:"),
    );
    const total = bookmarks.length;
    let completed = 0;

    for (const bookmark of bookmarks) {
      try {
        // Get favicon URL from Google's service
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(bookmark.url).hostname)}&sz=32`;

        // Update bookmark with new favicon
        await api(`/bookmarks/${bookmark.id}`, {
          method: "PUT",
          body: JSON.stringify({ favicon: faviconUrl }),
        });
      } catch {
        // Skip individual failures
      }

      completed++;
      const percent = Math.round((completed / total) * 100);
      progressFill.style.width = `${percent}%`;
      progressText.textContent = `${percent}% (${completed}/${total})`;

      // Small delay to prevent connection floods
      if (completed < total) {
        await delay(CONCURRENCY_DELAY);
      }
    }

    showToast(
      `Refreshed favicons for ${completed} ${completed === 1 ? "bookmark" : "bookmarks"}`,
      "success",
    );

    // Reload bookmarks to show new favicons
    const { loadBookmarks } = await import("@features/bookmarks/bookmarks.ts");
    await loadBookmarks();
  } catch (err: any) {
    showToast(err.message || "Failed to refresh favicons", "error");
  } finally {
    btn.disabled = false;
    setTimeout(() => {
      progress.classList.add("hidden");
      progressFill.style.width = "0%";
    }, 2000);
  }
}

/**
 * Find duplicate bookmarks
 */
async function findDuplicates(): Promise<void> {
  const btn = document.getElementById(
    "find-duplicates-btn",
  ) as HTMLButtonElement;
  const results = document.getElementById("duplicates-results");
  const list = document.getElementById("duplicates-list");
  const count = document.getElementById("duplicates-count");

  if (!btn || !results || !list || !count) return;

  btn.disabled = true;

  try {
    const duplicates = await api<any[]>("/maintenance/duplicates");

    if (duplicates.length === 0) {
      showToast("No duplicate bookmarks found!", "success");
      results.classList.add("hidden");
      btn.disabled = false;
      return;
    }

    count.textContent = `${duplicates.length} found`;
    results.classList.remove("hidden");

    list.innerHTML = duplicates
      .map((dup: any) => {
        const ids = dup.ids.split(",");
        return `
          <div class="maintenance-item">
            <div class="maintenance-item-info">
              <div class="maintenance-item-url" title="${escapeHtml(dup.url)}">${escapeHtml(dup.url)}</div>
              <div style="font-size: 0.75rem; color: var(--text-tertiary);">
                ${dup.count} copies
              </div>
            </div>
            <div class="maintenance-item-actions">
              <button class="btn btn-sm btn-outline-danger" data-action="delete-duplicates" data-ids="${escapeHtml(ids.slice(1).join(","))}" title="Keep first, delete others">
                Remove Duplicates
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    // Attach delete handlers
    list
      .querySelectorAll('[data-action="delete-duplicates"]')
      .forEach((btn) => {
        btn.addEventListener("click", async (e: any) => {
          const ids = e.target.dataset.ids.split(",");
          if (
            !(await confirmDialog(
              `Delete ${ids.length} duplicate bookmark(s)?`,
              {
                title: "Delete Duplicates",
                destructive: true,
              },
            ))
          )
            return;

          try {
            for (const id of ids) {
              await api(`/bookmarks/${id}`, { method: "DELETE" });
            }
            showToast(`Deleted ${ids.length} duplicates`, "success");
            e.target.closest(".maintenance-item")?.remove();

            // Refresh data
            const { loadBookmarks } =
              await import("@features/bookmarks/bookmarks.ts");
            await loadBookmarks();
          } catch (err: any) {
            showToast(err.message || "Failed to delete duplicates", "error");
          }
        });
      });
  } catch (err: any) {
    showToast(err.message || "Failed to find duplicates", "error");
  } finally {
    btn.disabled = false;
  }
}

/**
 * Check for broken links
 */
async function checkBrokenLinks(): Promise<void> {
  const btn = document.getElementById("check-links-btn") as HTMLButtonElement;
  const stopBtn = document.getElementById(
    "stop-check-links-btn",
  ) as HTMLButtonElement;
  const progress = document.getElementById("links-progress");
  const progressFill = document.getElementById("links-progress-fill");
  const progressText = document.getElementById("links-progress-text");
  const results = document.getElementById("broken-links-results");
  const list = document.getElementById("broken-links-list");
  const count = document.getElementById("broken-links-count");

  if (
    !btn ||
    !stopBtn ||
    !progress ||
    !progressFill ||
    !progressText ||
    !results ||
    !list ||
    !count
  )
    return;

  btn.disabled = true;
  stopBtn.style.display = "inline-flex";
  progress.classList.remove("hidden");
  results.classList.remove("hidden");
  list.innerHTML = "";

  linkCheckAbortController = new AbortController();

  const bookmarks = state.bookmarks.filter(
    (b) =>
      b.url &&
      !b.url.startsWith("view:") &&
      !b.url.startsWith("bookmark-view:") &&
      !b.url.startsWith("javascript:"),
  );
  const total = bookmarks.length;
  let completed = 0;
  let brokenCount = 0;

  try {
    for (const bookmark of bookmarks) {
      if (linkCheckAbortController.signal.aborted) break;

      try {
        const result = await api<{ ok: boolean; status: number }>(
          "/maintenance/check-link",
          {
            method: "POST",
            body: JSON.stringify({ url: bookmark.url }),
          },
        );

        if (!result.ok) {
          brokenCount++;
          const statusClass = result.status === 0 ? "error" : "warning";
          const statusText =
            result.status === 0 ? "Unreachable" : `HTTP ${result.status}`;

          list.innerHTML += `
            <div class="maintenance-item" data-bookmark-id="${bookmark.id}">
              <div class="maintenance-item-info">
                <div class="maintenance-item-title">${escapeHtml(bookmark.title)}</div>
                <div class="maintenance-item-url" title="${escapeHtml(bookmark.url)}">${escapeHtml(bookmark.url)}</div>
              </div>
              <span class="maintenance-status ${statusClass}">${statusText}</span>
              <div class="maintenance-item-actions">
                <button class="btn-icon" data-action="edit-broken-link" data-id="${bookmark.id}" title="Edit">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="btn-icon text-danger" data-action="delete-broken-link" data-id="${bookmark.id}" title="Delete">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          `;
        }
      } catch {
        // Network error, skip
      }

      completed++;
      const percent = Math.round((completed / total) * 100);
      progressFill.style.width = `${percent}%`;
      progressText.textContent = `${completed} / ${total}`;
      count.textContent = `${brokenCount} found`;

      // Small delay to prevent connection floods
      if (completed < total && !linkCheckAbortController.signal.aborted) {
        await delay(CONCURRENCY_DELAY);
      }
    }

    // Attach event handlers
    list
      .querySelectorAll('[data-action="edit-broken-link"]')
      .forEach((editBtn) => {
        editBtn.addEventListener("click", async (e: any) => {
          const id = e.currentTarget.dataset.id;
          const { editBookmark } =
            await import("@features/bookmarks/bookmarks.ts");
          editBookmark(id);
        });
      });

    list
      .querySelectorAll('[data-action="delete-broken-link"]')
      .forEach((deleteBtn) => {
        deleteBtn.addEventListener("click", async (e: any) => {
          const id = e.currentTarget.dataset.id;
          if (
            !(await confirmDialog("Delete this bookmark?", {
              title: "Delete Broken Link",
              destructive: true,
            }))
          )
            return;

          try {
            await api(`/bookmarks/${id}`, { method: "DELETE" });
            e.currentTarget.closest(".maintenance-item")?.remove();
            showToast("Bookmark deleted", "success");

            const { loadBookmarks } =
              await import("@features/bookmarks/bookmarks.ts");
            await loadBookmarks();
          } catch (err: any) {
            showToast(err.message || "Failed to delete", "error");
          }
        });
      });

    if (!linkCheckAbortController.signal.aborted) {
      showToast(
        brokenCount === 0
          ? "All links are working!"
          : `Found ${brokenCount} broken ${brokenCount === 1 ? "link" : "links"}`,
        brokenCount === 0 ? "success" : "warning",
      );
    }
  } catch (err: any) {
    showToast(err.message || "Failed to check links", "error");
  } finally {
    btn.disabled = false;
    stopBtn.style.display = "none";
    linkCheckAbortController = null;
  }
}

/**
 * Stop link checking
 */
function stopLinkCheck(): void {
  if (linkCheckAbortController) {
    linkCheckAbortController.abort();
    showToast("Link check stopped", "info");
  }
}

export default {
  initMaintenance,
};
