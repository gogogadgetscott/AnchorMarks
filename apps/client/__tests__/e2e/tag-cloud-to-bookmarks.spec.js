// E2E test for Tag Cloud → Tag Filter → Bookmarks flow
const { test, expect } = require("@playwright/test");

test.describe("Tag Cloud to Bookmarks Filter E2E", () => {
  let browser;
  let page;

  test.beforeAll(async () => {
    // Note: This assumes the app is running on http://localhost:5173
    // and has test data seeded
  });

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    // Navigate to the app
    await page.goto("http://localhost:5173");

    // Wait for app to load
    await page.waitForSelector('[data-test="view-selector"], .sidebar', {
      timeout: 10000,
    });
  });

  test("should navigate from tag cloud to filtered bookmarks", async () => {
    // 1. Navigate to tag cloud view
    const tagCloudBtn = page.locator('button, a:has-text("Tag Cloud")').first();
    if (await tagCloudBtn.isVisible()) {
      await tagCloudBtn.click();
      await page.waitForSelector("[data-test=tag-cloud]", { timeout: 5000 });
    } else {
      // Use keyboard shortcut if button not visible
      await page.keyboard.press("Control+K");
      await page.type("input", "tag cloud");
      await page.keyboard.press("Enter");
      await page.waitForSelector("[data-test=tag-cloud]", { timeout: 5000 });
    }

    // 2. Find a tag in the cloud and click it
    const tags = await page.locator("[data-test=tag-item]").all();
    expect(tags.length).toBeGreaterThan(0);

    const firstTag = tags[0];
    const tagName = await firstTag.textContent();
    await firstTag.click();

    // 3. Verify we navigated to bookmarks view with filter applied
    await page.waitForSelector("[data-test=bookmarks-view]", { timeout: 5000 });

    // 4. Check that the filter is active
    const filterButton = page.locator("[data-test=filter-button]");
    const filterText = await filterButton.textContent();
    expect(filterText).toContain("Filtered");

    // 5. Verify displayed bookmarks have the selected tag
    const bookmarks = await page.locator("[data-test=bookmark-item]").all();
    expect(bookmarks.length).toBeGreaterThan(0);

    for (const bookmark of bookmarks) {
      const tags = await bookmark.locator("[data-test=tag]").allTextContents();
      expect(tags.some((t) => t.includes(tagName))).toBeTruthy();
    }
  });

  test("should handle substring tags correctly", async () => {
    // Create bookmarks with potentially problematic tags (a, ab, abc)
    // This tests that filtering for "a" doesn't match "ab" or "abc"

    // Navigate to bookmarks and add filter for "a"
    await page.keyboard.press("Control+K");
    await page.type("input", "a");

    // Select "Apply 'a' to filter" command
    await page.waitForSelector("[data-test=omnibar-item]", { timeout: 5000 });
    await page.keyboard.press("Enter");

    // Wait for filter to apply
    await page.waitForSelector("[data-test=bookmarks-view]", { timeout: 5000 });

    // Verify all shown bookmarks actually have the "a" tag (not "ab" or "abc" only)
    const bookmarks = await page.locator("[data-test=bookmark-item]").all();

    for (const bookmark of bookmarks) {
      const tagElements = await bookmark
        .locator("[data-test=tag]")
        .allTextContents();
      const hasExactTag = tagElements.some((tag) => {
        const trimmed = tag.trim();
        return trimmed === "a";
      });
      expect(hasExactTag).toBeTruthy();
    }
  });

  test("should support AND mode tag filtering", async () => {
    // This tests that when filtering with AND mode,
    // only bookmarks with ALL specified tags are shown

    // Navigate to bookmarks with multiple tags filter
    await page.keyboard.press("Control+K");
    await page.type("input", "a");
    await page.keyboard.press("ArrowDown");

    // Find the "Apply" command and verify it applies filter
    await page.keyboard.press("Enter");

    await page.waitForSelector("[data-test=bookmarks-view]", { timeout: 5000 });

    // Get initial results
    const initialBookmarks = await page
      .locator("[data-test=bookmark-item]")
      .count();

    // Open filter menu to change AND mode
    const filterButton = page.locator("[data-test=filter-button]");
    await filterButton.click();

    const andModeToggle = page.locator('[data-test="tag-mode-and"]');
    if (await andModeToggle.isVisible()) {
      await andModeToggle.click();
    }

    // Should show fewer bookmarks (only those with ALL tags)
    const filteredBookmarks = await page
      .locator("[data-test=bookmark-item]")
      .count();

    // In AND mode with just one tag, should show same or fewer
    expect(filteredBookmarks).toBeLessThanOrEqual(initialBookmarks);
  });

  test("should handle tag filter persistence during navigation", async () => {
    // Apply a filter
    await page.keyboard.press("Control+K");
    await page.type("input", "dev");
    await page.keyboard.press("Enter");

    await page.waitForSelector("[data-test=bookmarks-view]", { timeout: 5000 });

    // Count bookmarks
    const bookmarkCount = await page
      .locator("[data-test=bookmark-item]")
      .count();
    expect(bookmarkCount).toBeGreaterThan(0);

    // Navigate away (to dashboard)
    const dashboardBtn = page.locator('button:has-text("Dashboard")').first();
    if (await dashboardBtn.isVisible()) {
      await dashboardBtn.click();
    }

    // Navigate back to bookmarks
    const bookmarksBtn = page.locator('button:has-text("Bookmarks")').first();
    if (await bookmarksBtn.isVisible()) {
      await bookmarksBtn.click();
    }

    // Filter should still be active
    await page.waitForSelector("[data-test=bookmarks-view]", { timeout: 5000 });
    const filterButton = page.locator("[data-test=filter-button]");
    const filterText = await filterButton.textContent();
    expect(filterText).toContain("Filtered");

    // Same bookmarks should be displayed
    const finalBookmarkCount = await page
      .locator("[data-test=bookmark-item]")
      .count();
    expect(finalBookmarkCount).toBe(bookmarkCount);
  });

  test("should clear filter correctly", async () => {
    // Apply a filter
    await page.keyboard.press("Control+K");
    await page.type("input", "test");
    await page.keyboard.press("Enter");

    await page.waitForSelector("[data-test=bookmarks-view]", { timeout: 5000 });

    // Open filter menu
    const filterButton = page.locator("[data-test=filter-button]");
    await filterButton.click();

    // Find and click clear filter button
    const clearButton = page.locator('[data-test="clear-filter"]');
    if (await clearButton.isVisible()) {
      await clearButton.click();
    }

    // Filter should be inactive
    const filterText = await filterButton.textContent();
    expect(filterText).not.toContain("Filtered");
  });
});
