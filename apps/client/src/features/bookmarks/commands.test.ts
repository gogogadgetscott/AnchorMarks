/**
 * Quick Launch Search/Omnibar Tests
 * Tests the actual getOmnibarCommands function from commands.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the state module before importing commands
vi.mock("@features/state.ts", () => ({
  bookmarks: [],
  folders: [],
  omnibarActiveIndex: 0,
  setOmnibarOpen: vi.fn(),
  setOmnibarEntries: vi.fn(),
  setOmnibarActiveIndex: vi.fn(),
  API_BASE: "http://localhost:3000",
}));

// Mock UI helpers
vi.mock("@utils/ui-helpers.ts", () => ({
  openModal: vi.fn(),
  updateActiveNav: vi.fn(),
}));

// Mock escapeHtml
vi.mock("@utils/index.ts", () => ({
  escapeHtml: (str: string) => str,
}));

// Import the function after mocks are set up
import { getOmnibarCommands } from "./commands";
import * as state from "@features/state.ts";

// Test data
const mockBookmarks = [
  {
    id: "1",
    title: "GitHub - Code Hosting",
    url: "https://github.com",
    favicon: "/favicons/github.png",
    tags: "dev,code",
  },
  {
    id: "2",
    title: "Google Search",
    url: "https://google.com",
    favicon: "/favicons/google.png",
    tags: "search,tools",
  },
  {
    id: "3",
    title: "Stack Overflow",
    url: "https://stackoverflow.com",
    favicon: "",
    tags: "dev,programming",
  },
  {
    id: "4",
    title: "MDN Web Docs",
    url: "https://developer.mozilla.org",
    favicon: "",
    tags: "dev,docs,reference",
  },
  {
    id: "5",
    title: "Reddit - Front Page",
    url: "https://reddit.com",
    favicon: "",
    tags: "social,news",
  },
];

const mockFolders = [
  { id: "f1", name: "Work", parent_id: null },
  { id: "f2", name: "Personal", parent_id: null },
  { id: "f3", name: "Development", parent_id: null },
  { id: "f4", name: "Work Projects", parent_id: "f1" }, // Nested folder
];

describe("Quick Launch - getOmnibarCommands", () => {
  beforeEach(() => {
    // Reset mocks and set up test data
    vi.clearAllMocks();
    // @ts-ignore - mocking module state
    state.bookmarks = [...mockBookmarks];
    // @ts-ignore - mocking module state
    state.folders = [...mockFolders];
  });

  describe("Empty search (no filter)", () => {
    it("should return base commands when no filter text", () => {
      const results = getOmnibarCommands("");

      // Should include base commands
      expect(results.some((r) => r.label === "Add bookmark")).toBe(true);
      expect(results.some((r) => r.label === "Show dashboard")).toBe(true);
      expect(results.some((r) => r.label === "Open settings")).toBe(true);
    });

    it("should include top-level folders", () => {
      const results = getOmnibarCommands("");

      // Should include top-level folders (not nested ones)
      expect(
        results.some((r) => r.label === "Work" && r.category === "folder"),
      ).toBe(true);
      expect(
        results.some((r) => r.label === "Personal" && r.category === "folder"),
      ).toBe(true);
      expect(
        results.some(
          (r) => r.label === "Development" && r.category === "folder",
        ),
      ).toBe(true);
      // Nested folder should NOT be included
      expect(results.some((r) => r.label === "Work Projects")).toBe(false);
    });

    it("should include recent bookmarks", () => {
      const results = getOmnibarCommands("");

      // Should include some bookmarks
      const bookmarkResults = results.filter((r) => r.category === "bookmark");
      expect(bookmarkResults.length).toBeGreaterThan(0);
      expect(bookmarkResults.length).toBeLessThanOrEqual(5); // Limited to 5 recent
    });
  });

  describe("Bookmark search (no prefix)", () => {
    it("should match bookmarks by title", () => {
      const results = getOmnibarCommands("github");

      expect(results.length).toBeGreaterThan(0);
      expect(
        results.some((r) => r.label.toLowerCase().includes("github")),
      ).toBe(true);
    });

    it("should match bookmarks by URL", () => {
      const results = getOmnibarCommands("stackoverflow");

      expect(results.length).toBeGreaterThan(0);
      expect(
        results.some((r) => r.description?.includes("stackoverflow")),
      ).toBe(true);
    });

    it("should match partial strings", () => {
      const results = getOmnibarCommands("git");

      expect(results.some((r) => r.label.toLowerCase().includes("git"))).toBe(
        true,
      );
    });

    it("should be case insensitive", () => {
      const resultsLower = getOmnibarCommands("google");
      const resultsUpper = getOmnibarCommands("GOOGLE");
      const resultsMixed = getOmnibarCommands("GoOgLe");

      expect(resultsLower.length).toBe(resultsUpper.length);
      expect(resultsLower.length).toBe(resultsMixed.length);
      expect(resultsLower.length).toBeGreaterThan(0);
    });

    it("should return empty results for no matches", () => {
      const results = getOmnibarCommands("xyznonexistent123");

      expect(results.length).toBe(0);
    });

    it("should prioritize bookmarks over folders and commands in search", () => {
      // "dev" matches bookmark titles/tags and folder "Development"
      const results = getOmnibarCommands("dev");

      // First results should be bookmarks
      const firstBookmarkIndex = results.findIndex(
        (r) => r.category === "bookmark",
      );
      const firstFolderIndex = results.findIndex(
        (r) => r.category === "folder",
      );

      if (firstBookmarkIndex !== -1 && firstFolderIndex !== -1) {
        expect(firstBookmarkIndex).toBeLessThan(firstFolderIndex);
      }
    });

    it("should include bookmark favicons", () => {
      const results = getOmnibarCommands("github");

      const githubResult = results.find(
        (r) =>
          r.category === "bookmark" && r.label.toLowerCase().includes("github"),
      );
      expect(githubResult?.favicon).toBe("/favicons/github.png");
    });

    it("should mark view bookmarks with category 'view'", () => {
      // Add view bookmarks
      // @ts-ignore
      state.bookmarks = [
        {
          id: "v1",
          title: "Dashboard View",
          url: "view:dash1",
          favicon: "",
          tags: "",
        },
        {
          id: "v2",
          title: "Bookmark View",
          url: "bookmark-view:bmv1",
          favicon: "",
          tags: "",
        },
      ];

      const results = getOmnibarCommands("dash1");
      expect(results.some((r) => r.category === "view")).toBe(true);

      const results2 = getOmnibarCommands("bmv1");
      expect(results2.some((r) => r.category === "view")).toBe(true);
    });

    it("should limit bookmark results to 10", () => {
      // Add more bookmarks temporarily
      // @ts-ignore
      state.bookmarks = Array(20)
        .fill(null)
        .map((_, i) => ({
          id: `bm${i}`,
          title: `Test Bookmark ${i}`,
          url: `https://test${i}.com`,
          favicon: "",
          tags: "",
        }));

      const results = getOmnibarCommands("test");
      const bookmarkResults = results.filter((r) => r.category === "bookmark");

      expect(bookmarkResults.length).toBeLessThanOrEqual(10);
    });
  });

  describe("Command prefix (>)", () => {
    it("should only return commands with > prefix", () => {
      const results = getOmnibarCommands(">");

      expect(results.every((r) => r.category === "command")).toBe(true);
      expect(results.some((r) => r.label === "Add bookmark")).toBe(true);
    });

    it("should filter commands by search term", () => {
      const results = getOmnibarCommands(">dashboard");

      expect(
        results.some((r) => r.label.toLowerCase().includes("dashboard")),
      ).toBe(true);
    });

    it("should not include bookmarks or folders with > prefix", () => {
      const results = getOmnibarCommands(">github");

      expect(results.every((r) => r.category === "command")).toBe(true);
    });
  });

  describe("Folder prefix (@)", () => {
    it("should only return folders with @ prefix", () => {
      const results = getOmnibarCommands("@");

      expect(results.every((r) => r.category === "folder")).toBe(true);
      expect(results.length).toBe(3); // Only top-level folders
    });

    it("should filter folders by name", () => {
      const results = getOmnibarCommands("@work");

      expect(results.some((r) => r.label.toLowerCase().includes("work"))).toBe(
        true,
      );
      expect(results.every((r) => r.category === "folder")).toBe(true);
    });

    it("should not include bookmarks with @ prefix", () => {
      const results = getOmnibarCommands("@development");

      expect(results.every((r) => r.category === "folder")).toBe(true);
    });
  });

  describe("Tag prefix (#)", () => {
    it("should filter bookmarks by tag with # prefix", () => {
      const results = getOmnibarCommands("#dev");

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.category === "bookmark")).toBe(true);
    });

    it("should return empty for non-existent tag", () => {
      const results = getOmnibarCommands("#nonexistenttag");

      expect(results.length).toBe(0);
    });

    it("should match partial tag names", () => {
      const results = getOmnibarCommands("#prog");

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle whitespace-only input", () => {
      const results = getOmnibarCommands("   ");

      // Whitespace only should be treated as empty - return all commands
      expect(results.some((r) => r.category === "command")).toBe(true);
    });

    it("should handle whitespace around search terms", () => {
      const results = getOmnibarCommands("  github  ");

      expect(
        results.some((r) => r.label.toLowerCase().includes("github")),
      ).toBe(true);
    });

    it("should handle empty bookmarks array", () => {
      // @ts-ignore
      state.bookmarks = [];

      const results = getOmnibarCommands("test");

      // Should not throw, returns commands that match
      expect(Array.isArray(results)).toBe(true);
    });

    it("should handle empty folders array", () => {
      // @ts-ignore
      state.folders = [];

      const results = getOmnibarCommands("@test");

      // Should not throw, should return empty
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it("should handle bookmarks with missing properties", () => {
      // @ts-ignore
      state.bookmarks = [
        { id: "1", url: "https://notitle.com" }, // No title
        { id: "2", title: "No Tags", url: "https://notags.com" }, // No tags
      ];

      const results = getOmnibarCommands("notitle");

      // Should use URL as fallback for title
      expect(results.some((r) => r.description?.includes("notitle"))).toBe(
        true,
      );
    });
  });

  describe("Command structure", () => {
    it("should include all required command properties", () => {
      const results = getOmnibarCommands("");

      const command = results.find((r) => r.category === "command");
      expect(command).toBeDefined();
      expect(command?.label).toBeDefined();
      expect(command?.icon).toBeDefined();
      expect(command?.action).toBeTypeOf("function");
    });

    it("should include all required bookmark properties", () => {
      const results = getOmnibarCommands("github");

      const bookmark = results.find((r) => r.category === "bookmark");
      expect(bookmark).toBeDefined();
      expect(bookmark?.label).toBeDefined();
      expect(bookmark?.url).toBeDefined();
      expect(bookmark?.description).toBeDefined();
      expect(bookmark?.action).toBeTypeOf("function");
    });

    it("should include all required folder properties", () => {
      const results = getOmnibarCommands("@");

      const folder = results.find((r) => r.category === "folder");
      expect(folder).toBeDefined();
      expect(folder?.label).toBeDefined();
      expect(folder?.icon).toBe("📁");
      expect(folder?.action).toBeTypeOf("function");
    });
  });
});
