import * as state from "@features/state.ts";
import { escapeHtml } from "@utils/index.ts";

interface RenderTagCloudOptions {
  skipViewCheck?: boolean;
}

interface TagItem {
  name: string;
  count: number;
}

function buildTagItems(): TagItem[] {
  const counts = new Map<string, number>();

  for (const bookmark of state.bookmarks) {
    const rawTags = typeof bookmark.tags === "string" ? bookmark.tags : "";
    const tags = rawTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

async function applyTagFilter(tagName: string): Promise<void> {
  state.setFilterConfig({
    ...state.filterConfig,
    tags: [tagName],
  });
  await state.setCurrentView("all");

  const viewTitle = document.getElementById("view-title");
  if (viewTitle) {
    viewTitle.textContent = `Tag: ${tagName}`;
  }

  const appModule: any = await import("@/App.ts");
  await appModule.updateHeaderContent?.();

  const { loadBookmarks } = await import("@features/bookmarks/bookmarks.ts");
  await loadBookmarks();
}

export async function renderTagCloud(
  outlet?: HTMLElement | null,
  options: RenderTagCloudOptions = {},
): Promise<void> {
  if (!options.skipViewCheck && state.currentView !== "tag-cloud") {
    return;
  }

  const target = outlet || document.getElementById("main-view-outlet");
  if (!target) {
    return;
  }

  const tagItems = buildTagItems();
  if (!tagItems.length) {
    target.innerHTML = '<div class="tag-cloud-empty">No tags yet.</div>';
    return;
  }

  target.innerHTML = `
    <section class="tag-cloud-view" data-testid="tag-cloud-view">
      <div class="tag-cloud-canvas">
        ${tagItems
          .map(
            (item) =>
              `<button type="button" class="tag-cloud-tag" data-tag="${escapeHtml(item.name)}" title="${escapeHtml(item.name)} (${item.count})">${escapeHtml(item.name)}<span class="tag-cloud-tag-count">${item.count}</span></button>`,
          )
          .join("")}
      </div>
    </section>
  `;

  target
    .querySelectorAll<HTMLButtonElement>(".tag-cloud-tag")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const tagName = button.dataset.tag;
        if (!tagName) {
          return;
        }
        void applyTagFilter(tagName);
      });
    });

  (window as Window & { __tagCloudResizeCleanup?: () => void }).__tagCloudResizeCleanup =
    () => {
      // Kept for backward-compatible test cleanup hooks.
    };
}
