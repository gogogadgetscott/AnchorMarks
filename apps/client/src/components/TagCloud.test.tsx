import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import {
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
} from "../test-utils.tsx";
import { TagCloud } from "./TagCloud.tsx";
import * as state from "@features/state.ts";
import { useUI } from "../contexts/UIContext";
import { useBookmarks } from "../contexts/BookmarksContext";

function ContextProbe({
  onChange,
}: {
  onChange: (snapshot: { currentView: string; filterTags: string[] }) => void;
}) {
  const { currentView } = useUI();
  const { filterConfig } = useBookmarks();

  React.useEffect(() => {
    onChange({
      currentView,
      filterTags: filterConfig.tags || [],
    });
  }, [currentView, filterConfig, onChange]);

  return null;
}

function TagCloudSeed({
  metadata,
}: {
  metadata: Record<string, { count: number; color?: string }>;
}) {
  const { setTagMetadata, setFilterConfig } = useBookmarks();

  React.useEffect(() => {
    setTagMetadata(metadata);
    setFilterConfig({
      sort: "recently_added",
      tags: [],
      tagSort: "count_desc",
      tagMode: "OR",
    });
  }, [metadata, setTagMetadata, setFilterConfig]);

  return null;
}

describe("TagCloud (React)", () => {
  beforeEach(() => {
    localStorage.removeItem("anchormarks_tag_cloud_show_all");
    state.setTagMetadata({});
    state.setFilterConfig({
      sort: "recently_added",
      tags: [],
      tagSort: "count_desc",
      tagMode: "OR",
    });
    document.body.classList.remove("tag-cloud-active", "analytics-active");
  });

  it("renders empty state when there are no tags", () => {
    renderWithProviders(<TagCloud />);

    expect(screen.getByText("No Tags Yet")).toBeTruthy();
    expect(
      screen.getByText(/Try organizing your bookmarks with/i),
    ).toBeTruthy();
  });

  it("clicking a tag switches to all view and sets tag filter", async () => {
    const snapshots: Array<{ currentView: string; filterTags: string[] }> = [];

    renderWithProviders(
      <>
        <TagCloudSeed
          metadata={{
            foo: { count: 3, color: "#f59e0b" },
            bar: { count: 1, color: "#10b981" },
          }}
        />
        <TagCloud />
        <ContextProbe onChange={(snapshot) => snapshots.push(snapshot)} />
      </>,
    );

    const fooTagButton = await screen.findByRole("button", { name: /foo/i });
    fireEvent.click(fooTagButton);

    await waitFor(() => {
      const latest = snapshots[snapshots.length - 1];
      expect(latest.currentView).toBe("all");
      expect(latest.filterTags).toEqual(["foo"]);
    });
  });

  it("toggle persists show-all preference to localStorage", async () => {
    renderWithProviders(
      <>
        <TagCloudSeed
          metadata={{
            alpha: { count: 4 },
            beta: { count: 3 },
            gamma: { count: 2 },
          }}
        />
        <TagCloud />
      </>,
    );

    const toggleBtn = await screen.findByRole("button", { name: "Show All" });
    fireEvent.click(toggleBtn);

    expect(localStorage.getItem("anchormarks_tag_cloud_show_all")).toBe("true");
    expect(screen.getByRole("button", { name: "Show Top" })).toBeTruthy();
  });
});
