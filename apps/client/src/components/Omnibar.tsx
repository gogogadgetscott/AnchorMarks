import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import { Icon } from "./Icon.tsx";
import { safeLocalStorage } from "@utils/index.ts";
import {
  getOmnibarCommands,
  getAllBookmarks,
} from "@features/bookmarks/commands.ts";
import { useUI } from "@contexts/UIContext";
import { useBookmarks } from "@contexts/BookmarksContext";
import type { Command } from "../types/index";

// ─── localStorage helpers (kept as pure functions, no React) ─────────────────

const RECENT_SEARCHES_KEY = "anchormarks_recent_searches";
const MAX_RECENT_SEARCHES = 10;

function getRecentSearches(): string[] {
  try {
    const stored = safeLocalStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string): void {
  if (!query.trim()) return;
  const trimmed = query.trim();
  const recent = getRecentSearches().filter((s) => s !== trimmed);
  recent.unshift(trimmed);
  try {
    safeLocalStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(recent.slice(0, MAX_RECENT_SEARCHES)),
    );
  } catch {
    // ignore
  }
}

function deleteRecentSearch(query: string): string[] {
  const next = getRecentSearches().filter((s) => s !== query);
  try {
    safeLocalStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

function clearAllRecentSearches(): void {
  try {
    safeLocalStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // ignore
  }
}

// ─── Tag suggestion helper ────────────────────────────────────────────────────

function getSuggestedTags(): { name: string; count: number }[] {
  const tagCounts: Record<string, number> = {};
  getAllBookmarks().forEach((b) => {
    if (b.tags) {
      b.tags.split(",").forEach((t) => {
        const tag = t.trim();
        if (tag) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      });
    }
  });
  return Object.entries(tagCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// ─── Quick actions (bridge to navigation via hooks) ──────────────────────────

interface QuickAction {
  label: string;
  icon: string;
  run: () => void;
}

function getQuickActions(
  setCurrentView: (val: string) => Promise<void>,
  setCurrentFolder: (val: string | null) => void,
  loadBookmarks: () => Promise<void>,
): QuickAction[] {
  return [
    {
      label: "Add bookmark",
      icon: "plus",
      run: () =>
        import("@utils/ui-helpers.ts").then(({ openModal }) =>
          openModal("bookmark-modal"),
        ),
    },
    {
      label: "View favorites",
      icon: "star",
      run: async () => {
        await setCurrentView("favorites");
        setCurrentFolder(null);
        await loadBookmarks();
      },
    },
    {
      label: "View dashboard",
      icon: "grid",
      run: async () => {
        await setCurrentView("dashboard");
        setCurrentFolder(null);
        await loadBookmarks();
      },
    },
    {
      label: "Open settings",
      icon: "settings",
      run: () =>
        import("@utils/ui-helpers.ts").then(({ openModal }) =>
          openModal("settings-modal"),
        ),
    },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RecentItem({
  query,
  onSelect,
  onRemove,
}: {
  query: string;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="omnibar-recent-item" data-search={query}>
      <div
        style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
        onClick={onSelect}
      >
        <Icon name="clock" size={16} />
        <span>{query}</span>
      </div>
      <button
        className="omnibar-recent-remove btn-icon"
        title="Remove"
        onMouseDown={(e) => e.preventDefault()} // prevent blur
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

function TagPill({
  name,
  count,
  onSelect,
}: {
  name: string;
  count: number;
  onSelect: () => void;
}) {
  return (
    <div
      className="omnibar-tag-pill"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
    >
      <span>{name}</span>
      <span style={{ opacity: 0.6, fontSize: "0.75rem" }}>{count}</span>
    </div>
  );
}

function ActionItem({
  action,
  onRun,
}: {
  action: QuickAction;
  onRun: () => void;
}) {
  return (
    <div
      className="omnibar-item"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onRun}
    >
      <div className="omnibar-item-icon">
        <Icon name={action.icon} size={18} />
      </div>
      <div className="omnibar-item-content">
        <div className="omnibar-item-label">{action.label}</div>
      </div>
    </div>
  );
}

const categoryIconMap: Record<string, string> = {
  view: "eye",
  bookmark: "link",
  folder: "folder",
  tag: "tag",
  action: "sparkles",
};

function ResultItem({
  cmd,
  index,
  isActive,
  onSelect,
  onHover,
}: {
  cmd: Command;
  index: number;
  isActive: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  const iconEl =
    cmd.category === "bookmark" && cmd.favicon ? (
      <img
        className="command-favicon"
        src={cmd.favicon}
        alt=""
        style={{ width: 16, height: 16, borderRadius: 2 }}
      />
    ) : cmd.icon ? (
      <span className="command-icon">{cmd.icon}</span>
    ) : null;

  const categoryBadge =
    cmd.category && cmd.category !== "command" ? (
      <span className={`command-category ${cmd.category}`}>
        <Icon name={categoryIconMap[cmd.category] ?? "link"} size={12} />
        {` ${cmd.category.charAt(0).toUpperCase()}${cmd.category.slice(1)}`}
      </span>
    ) : null;

  return (
    <div
      className={`omnibar-item ${cmd.category ?? ""} ${isActive ? "active" : ""}`}
      data-index={index}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      <div className="omnibar-item-icon">{iconEl}</div>
      <div className="omnibar-item-content">
        <div className="omnibar-item-label">{cmd.label}</div>
        {cmd.description && cmd.category !== "bookmark" && (
          <div className="omnibar-item-description">{cmd.description}</div>
        )}
      </div>
      {categoryBadge}
    </div>
  );
}

// ─── Main Omnibar component ───────────────────────────────────────────────────

interface OmnibarProps {
  id?: string;
  placeholder?: string;
  shortcut?: string;
  showDropdown?: boolean;
}

export function Omnibar({
  id = "search-input",
  placeholder = "Search or type > for commands...",
  shortcut = "Ctrl+K or /",
  showDropdown = true,
}: OmnibarProps) {
  const { currentView, setCurrentView, setCurrentFolder } = useUI();
  const { filterConfig, setFilterConfig, loadBookmarks } = useBookmarks();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<
    { name: string; count: number }[]
  >([]);
  const [results, setResults] = useState<Command[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLDivElement>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchFilterTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const isCommandMode = query.trim().startsWith(">");
  const hasQuery = query.trim().length > 0;

  // Get quick actions with hooks
  const quickActions = getQuickActions(
    setCurrentView,
    setCurrentFolder,
    loadBookmarks,
  );

  // Recompute panel content whenever query or open state changes
  useEffect(() => {
    if (!isOpen) return;

    if (hasQuery) {
      setResults(getOmnibarCommands(query.trim()));
      setActiveIndex(0);
    } else {
      setRecentSearches(getRecentSearches());
      setSuggestedTags(getSuggestedTags());
    }
  }, [isOpen, query, hasQuery]);

  // Bridge: apply search filter to bookmark system
  useEffect(() => {
    if (searchFilterTimeout.current) clearTimeout(searchFilterTimeout.current);

    const trimmed = query.trim();

    if (currentView === "favorites" || currentView === "recent") {
      searchFilterTimeout.current = setTimeout(() => {
        import("@features/bookmarks/bookmarks.ts").then((m) =>
          m.renderBookmarks(),
        );
      }, 120);
      return;
    }

    if (isCommandMode) {
      if (filterConfig.search !== undefined) {
        setFilterConfig({
          ...filterConfig,
          search: undefined,
        });
        searchFilterTimeout.current = setTimeout(() => {
          import("@features/bookmarks/bookmarks.ts").then((m) =>
            m.renderBookmarks(),
          );
        }, 120);
      }
      return;
    }

    setFilterConfig({
      ...filterConfig,
      search: trimmed || undefined,
    });

    searchFilterTimeout.current = setTimeout(() => {
      import("@features/bookmarks/filters.ts").then(async (m) => {
        await m.applyFilters();
        import("@features/bookmarks/search.ts").then((s) =>
          s.renderActiveFilters(),
        );
        import("@features/bookmarks/filters.ts").then((f) =>
          f.updateFilterButtonText(),
        );
      });
    }, 120);

    return () => {
      if (searchFilterTimeout.current)
        clearTimeout(searchFilterTimeout.current);
    };
  }, [query, isCommandMode, currentView, filterConfig, setFilterConfig]);

  const open = useCallback(() => {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setIsOpen(true);
    setRecentSearches(getRecentSearches());
    setSuggestedTags(getSuggestedTags());
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(0);
    setResults([]);
  }, []);

  const handleFocus = useCallback(() => open(), [open]);

  const handleBlur = useCallback(() => {
    blurTimeout.current = setTimeout(() => close(), 200);
  }, [close]);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (!isOpen) open();
    },
    [isOpen, open],
  );

  const executeResult = useCallback(
    (cmd: Command) => {
      cmd.action();
      if (cmd.category !== "view") {
        close();
        const q = query.trim();
        if (
          q &&
          !q.startsWith(">") &&
          !q.startsWith("@") &&
          !q.startsWith("#")
        ) {
          saveRecentSearch(q);
        }
      }
    },
    [close, query],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(results.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        if (hasQuery && results.length > 0) {
          e.preventDefault();
          const cmd = results[activeIndex];
          if (cmd) executeResult(cmd);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setQuery("");
        close();
        inputRef.current?.blur();
      }
    },
    [isOpen, results, activeIndex, hasQuery, executeResult, close],
  );

  const handleTagSelect = useCallback(
    async (tagName: string) => {
      const { sidebarFilterTag } =
        await import("@features/bookmarks/search.ts");
      await sidebarFilterTag(tagName);
      close();
    },
    [close],
  );

  const handleRemoveRecent = useCallback((search: string) => {
    setRecentSearches(deleteRecentSearch(search));
  }, []);

  const handleClearRecent = useCallback(() => {
    clearAllRecentSearches();
    setRecentSearches([]);
  }, []);

  const handleRecentSelect = useCallback(
    (search: string) => {
      setQuery(search);
      if (inputRef.current) inputRef.current.value = search;
      close();
    },
    [close],
  );

  // Auto-scroll active result into view
  useEffect(() => {
    if (!resultsListRef.current) return;
    const active = resultsListRef.current.querySelector(".omnibar-item.active");
    if (active) active.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!showDropdown) {
    return (
      <div className="omnibar-container" role="search">
        <div className="header-search-bar omnibar-input">
          <Icon name="search" size={20} />
          <input
            ref={inputRef}
            type="text"
            id={id}
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-label="Search bookmarks or enter commands"
            aria-autocomplete="list"
            aria-expanded={false}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
          <kbd className="search-shortcut-hint">{shortcut}</kbd>
        </div>
      </div>
    );
  }

  return (
    <div className="omnibar-container" role="search">
      <div className="header-search-bar omnibar-input">
        <Icon name="search" size={20} />
        <input
          ref={inputRef}
          type="text"
          id={id}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-label="Search bookmarks or enter commands"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="omnibar-panel"
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        <kbd className="search-shortcut-hint">{shortcut}</kbd>
      </div>

      <div
        id="omnibar-panel"
        className={`omnibar-panel ${isOpen ? "" : "hidden"}`}
        role="listbox"
        aria-label="Search suggestions and quick actions"
      >
        {!hasQuery ? (
          <>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="omnibar-section" id="omnibar-recent">
                <div className="omnibar-section-header">
                  <span>Recent Searches</span>
                  <button
                    className="omnibar-clear-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleClearRecent}
                  >
                    Clear
                  </button>
                </div>
                <div className="omnibar-section-content">
                  {recentSearches.map((search) => (
                    <RecentItem
                      key={search}
                      query={search}
                      onSelect={() => handleRecentSelect(search)}
                      onRemove={() => handleRemoveRecent(search)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Tags */}
            {suggestedTags.length > 0 && (
              <div className="omnibar-section" id="omnibar-tags">
                <div className="omnibar-section-header">
                  <span>Suggested Tags</span>
                </div>
                <div className="omnibar-section-content">
                  <div className="omnibar-tags-grid">
                    {suggestedTags.map((tag) => (
                      <TagPill
                        key={tag.name}
                        name={tag.name}
                        count={tag.count}
                        onSelect={() => handleTagSelect(tag.name)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="omnibar-section" id="omnibar-actions">
              <div className="omnibar-section-header">
                <span>Quick Actions</span>
              </div>
              <div className="omnibar-section-content">
                {quickActions.map((action) => (
                  <ActionItem
                    key={action.label}
                    action={action}
                    onRun={() => {
                      action.run();
                      close();
                    }}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Search Results */
          <div className="omnibar-section" id="omnibar-results">
            <div className="omnibar-section-content" ref={resultsListRef}>
              {results.length === 0 ? (
                <div
                  className="omnibar-item empty"
                  style={{
                    justifyContent: "center",
                    color: "var(--text-tertiary)",
                    fontStyle: "italic",
                  }}
                >
                  No results found
                </div>
              ) : (
                results.map((cmd, idx) => (
                  <ResultItem
                    key={idx}
                    cmd={cmd}
                    index={idx}
                    isActive={idx === activeIndex}
                    onSelect={() => executeResult(cmd)}
                    onHover={() => setActiveIndex(idx)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* Tips Footer */}
        <div className="omnibar-tips">
          <span className="tip">
            <kbd>{">"}</kbd> commands
          </span>
          <span className="tip">
            <kbd>@</kbd> folders
          </span>
          <span className="tip">
            <kbd>#</kbd> tags
          </span>
          <span className="tip">
            <kbd>↑↓</kbd> navigate
          </span>
          <span className="tip">
            <kbd>Enter</kbd> select
          </span>
        </div>
      </div>
    </div>
  );
}
