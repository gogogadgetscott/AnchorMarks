import { useState } from "react";
import { useModal } from "@contexts/ModalContext";
import { useBookmarks } from "@contexts/BookmarksContext";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "recently_added", label: "Recently Added" },
  { value: "oldest_first", label: "Oldest First" },
  { value: "most_visited", label: "Most Visited" },
  { value: "a_z", label: "A – Z" },
  { value: "z_a", label: "Z – A" },
];

const TAG_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "count_desc", label: "Most Used First" },
  { value: "count_asc", label: "Least Used First" },
  { value: "name_asc", label: "A → Z" },
];

export function FilterSidebar() {
  const { closeModal } = useModal();
  const { filterConfig, setFilterConfig, tagMetadata } = useBookmarks();
  const [tagSearch, setTagSearch] = useState("");

  const allTags = Object.keys(tagMetadata || {});
  const filteredTags = tagSearch
    ? allTags.filter((t) => t.toLowerCase().includes(tagSearch.toLowerCase()))
    : allTags;

  const activeTags = filterConfig.tags;

  const handleSortChange = (sort: string) => {
    setFilterConfig({ ...filterConfig, sort });
  };

  const handleTagSortChange = (tagSort: string) => {
    setFilterConfig({ ...filterConfig, tagSort });
  };

  const toggleTag = (tag: string) => {
    const next = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag];
    setFilterConfig({ ...filterConfig, tags: next });
  };

  const removeTag = (tag: string) => {
    setFilterConfig({
      ...filterConfig,
      tags: activeTags.filter((t) => t !== tag),
    });
  };

  return (
    <div
      className="filter-sidebar"
      id="filter-sidebar"
      role="complementary"
      aria-label="Filters and sort"
    >
      <div className="filter-header">
        <h3>Filters &amp; Sort</h3>
        <button
          className="btn-icon"
          id="close-filter-sidebar"
          onClick={closeModal}
          aria-label="Close filter sidebar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="filter-content">
        {/* Sort Bookmarks */}
        <div className="filter-section">
          <h4>Sort Bookmarks</h4>
          <select
            id="filter-sort"
            className="form-input"
            value={filterConfig.sort}
            onChange={(e) => handleSortChange(e.target.value)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Tags */}
        <div className="filter-section">
          <h4>Sort Tags</h4>
          <select
            id="filter-tag-sort"
            className="form-input"
            title="Sort tags by how often they're used"
            value={filterConfig.tagSort}
            onChange={(e) => handleTagSortChange(e.target.value)}
          >
            {TAG_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Active Filters */}
        <div className="filter-section">
          <h4>Active Filters</h4>
          <div className="selected-tags" id="filter-selected-tags">
            {activeTags.length === 0 ? (
              <span
                className="text-tertiary"
                style={{ fontSize: "0.875rem", fontStyle: "italic" }}
                id="filter-no-tags"
              >
                No filters active
              </span>
            ) : (
              activeTags.map((tag) => (
                <span key={tag} className="tag-badge tag-active">
                  {tag}
                  <button
                    type="button"
                    className="tag-remove"
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove filter ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Filter by Tag */}
        <div className="filter-section">
          <h4>Filter by Tag</h4>
          <input
            type="text"
            id="filter-tag-search"
            className="form-input"
            placeholder="Search tags…"
            style={{ marginBottom: "0.75rem" }}
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
          />
          {filteredTags.length === 0 ? (
            <div id="filter-tags-empty" className="tags-empty-state">
              <p>No tags yet</p>
              <p className="text-tertiary">
                Try organizing your bookmarks with{" "}
                <kbd
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "2px 6px",
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "4px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    margin: "0 2px",
                  }}
                >
                  #tags
                </kbd>{" "}
                when adding or editing them.
              </p>
            </div>
          ) : (
            <div id="filter-available-tags" className="available-tags-list">
              {filteredTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-filter-item ${activeTags.includes(tag) ? "active" : ""}`}
                  onClick={() => toggleTag(tag)}
                  data-tag={tag}
                >
                  <span className="tag-name">{tag}</span>
                  {tagMetadata[tag]?.count !== undefined && (
                    <span className="tag-count">{tagMetadata[tag].count}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
