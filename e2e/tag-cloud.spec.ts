import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Tag Cloud Feature
 * Verifies that:
 * 1. Tag cloud renders with tags
 * 2. Clicking a tag filters bookmarks and updates the header
 * 3. Bookmark cards render in the main view
 * 4. UI state is properly updated after tag selection
 */

test.describe("Tag Cloud", () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto("/");

    // Check if already logged in by looking for the main content
    const mainViewOutlet = page.locator("#main-view-outlet");
    const isLoggedIn = await mainViewOutlet.isVisible().catch(() => false);

    if (!isLoggedIn) {
      // If not logged in, register a test account
      const registerBtn = page.locator('button:has-text("Create Account")');
      const isRegisterAvailable = await registerBtn
        .isVisible()
        .catch(() => false);

      if (isRegisterAvailable) {
        await registerBtn.click();
        await page.fill('input[placeholder*="email"]', "test@example.com");
        await page.fill('input[placeholder*="password"]', "testpass123");
        await page.fill('input[placeholder*="confirm"]', "testpass123");
        await page.click('button:has-text("Create Account")');
        await page.waitForNavigation();
      }
    }

    await page.waitForLoadState("networkidle");
  });

  test("should render tag cloud view", async ({ page }) => {
    // Navigate to tag cloud view
    await page.click('a[href*="tag-cloud"], button:has-text("Tag Cloud")');

    // Wait for tag cloud to render
    const tagCloudContainer = page.locator(".tag-cloud-container");
    await expect(tagCloudContainer).toBeVisible();

    // Check for tag cloud elements
    const tagCloud = page.locator(".tag-cloud-canvas");
    await expect(tagCloud).toBeVisible();

    // Check for legend
    const legend = page.locator(".tag-cloud-legend");
    await expect(legend).toBeVisible();
  });

  test("should display tags in tag cloud", async ({ page }) => {
    // Navigate to tag cloud
    await page.click('a[href*="tag-cloud"], button:has-text("Tag Cloud")');

    // Wait for tag cloud canvas
    const tagCloudCanvas = page.locator(".tag-cloud-canvas");
    await expect(tagCloudCanvas).toBeVisible();

    // Check for tag buttons
    const tagButtons = page.locator(".tag-cloud-tag");
    const tagCount = await tagButtons.count();

    // If there are tags, verify they have expected attributes
    if (tagCount > 0) {
      const firstTag = tagButtons.nth(0);

      // Verify tag has data attributes
      const tagName = await firstTag.getAttribute("data-tag");
      const tagCountAttr = await firstTag.getAttribute("data-count");

      expect(tagName).toBeTruthy();
      expect(tagCountAttr).toBeTruthy();

      // Verify tag is visible and clickable
      await expect(firstTag).toBeVisible();
    }
  });

  test("should filter bookmarks when clicking a tag", async ({ page }) => {
    // Navigate to tag cloud
    await page.click('a[href*="tag-cloud"], button:has-text("Tag Cloud")');

    // Wait for tag cloud to render
    const tagCloudCanvas = page.locator(".tag-cloud-canvas");
    await expect(tagCloudCanvas).toBeVisible();

    // Get the first tag
    const tagButtons = page.locator(".tag-cloud-tag");
    const firstTagCount = await tagButtons.count();

    if (firstTagCount === 0) {
      test.skip();
      return;
    }

    const firstTag = tagButtons.nth(0);
    const tagName = await firstTag.getAttribute("data-tag");

    // Click the first tag
    await firstTag.click();

    // Wait for navigation/update
    await page.waitForLoadState("networkidle");

    // Verify view changed to bookmarks view
    const mainViewOutlet = page.locator("#main-view-outlet");
    await expect(mainViewOutlet).toBeVisible();

    // Verify header was updated with tag name
    const viewTitle = page.locator("#view-title");
    const titleText = await viewTitle.textContent();
    expect(titleText).toContain(tagName || "");

    // Verify bookmarks are rendered
    const bookmarkItems = page.locator(
      ".bookmark-item, [data-testid='bookmark-card']",
    );
    const bookmarkCount = await bookmarkItems.count();

    // Should have at least one bookmark if tag exists
    expect(bookmarkCount).toBeGreaterThan(0);
  });

  test("should update header when tag is selected", async ({ page }) => {
    // Navigate to tag cloud
    await page.click('a[href*="tag-cloud"], button:has-text("Tag Cloud")');

    // Wait for tag cloud
    const tagCloudCanvas = page.locator(".tag-cloud-canvas");
    await expect(tagCloudCanvas).toBeVisible();

    // Get first tag
    const tagButtons = page.locator(".tag-cloud-tag");
    const firstTagCount = await tagButtons.count();

    if (firstTagCount === 0) {
      test.skip();
      return;
    }

    const firstTag = tagButtons.nth(0);
    const tagName = await firstTag.getAttribute("data-tag");

    // Click tag
    await firstTag.click();
    await page.waitForLoadState("networkidle");

    // Check view title
    const viewTitle = page.locator("#view-title");
    await expect(viewTitle).toContainText("Tag:");
    const titleText = await viewTitle.textContent();
    expect(titleText).toContain(tagName || "");

    // Check that the tag filter is visible in active filters
    const activeFilters = page.locator(".active-filter, .filter-tag");
    const filterCount = await activeFilters.count();
    expect(filterCount).toBeGreaterThan(0);
  });

  test("should render bookmark cards in grid/list format", async ({ page }) => {
    // Navigate to tag cloud
    await page.click('a[href*="tag-cloud"], button:has-text("Tag Cloud")');

    // Wait for tag cloud
    const tagCloudCanvas = page.locator(".tag-cloud-canvas");
    await expect(tagCloudCanvas).toBeVisible();

    // Click first tag
    const tagButtons = page.locator(".tag-cloud-tag");
    const firstTagCount = await tagButtons.count();

    if (firstTagCount === 0) {
      test.skip();
      return;
    }

    await tagButtons.nth(0).click();
    await page.waitForLoadState("networkidle");

    // Wait for bookmarks to render
    const bookmarkItems = page.locator(".bookmark-item, .bookmark-grid-item");
    const itemCount = await bookmarkItems.count();

    if (itemCount > 0) {
      // Verify bookmark structure
      const firstBookmark = bookmarkItems.nth(0);

      // Check for typical bookmark elements
      const titleElement = firstBookmark.locator(
        ".bookmark-title, [class*='title']",
      );
      const urlElement = firstBookmark.locator(".bookmark-url, [class*='url']");

      // At least one of these should exist
      const titleVisible = await titleElement.isVisible().catch(() => false);
      const urlVisible = await urlElement.isVisible().catch(() => false);

      expect(titleVisible || urlVisible).toBeTruthy();
    }
  });

  test("should show legend on tag cloud", async ({ page }) => {
    // Navigate to tag cloud
    await page.click('a[href*="tag-cloud"], button:has-text("Tag Cloud")');

    // Wait for tag cloud
    const tagCloudView = page.locator(".tag-cloud-view");
    await expect(tagCloudView).toBeVisible();

    // Check for legend
    const legend = page.locator(".tag-cloud-legend");
    await expect(legend).toBeVisible();

    // Check legend items
    const legendItems = page.locator(".legend-item");
    const itemCount = await legendItems.count();
    expect(itemCount).toBeGreaterThanOrEqual(2);

    // Check for gradient
    const legendGradient = page.locator(".legend-gradient");
    await expect(legendGradient).toBeVisible();
  });

  test("should handle dynamic legend height calculation", async ({ page }) => {
    // Navigate to tag cloud
    await page.click('a[href*="tag-cloud"], button:has-text("Tag Cloud")');

    // Wait for tag cloud
    const tagCloudView = page.locator(".tag-cloud-view");
    await expect(tagCloudView).toBeVisible();

    // Get legend bounding box
    const legend = page.locator(".tag-cloud-legend");
    const legendBox = await legend.boundingBox();

    expect(legendBox).toBeTruthy();
    expect(legendBox?.height).toBeGreaterThan(0);

    // Get canvas bounding box
    const canvas = page.locator(".tag-cloud-canvas");
    const canvasBox = await canvas.boundingBox();

    expect(canvasBox).toBeTruthy();
    expect(canvasBox?.height).toBeGreaterThan(0);

    // Verify canvas has reasonable height relative to window
    const windowHeight = await page.evaluate(() => window.innerHeight);
    expect(canvasBox!.height).toBeLessThan(windowHeight);
  });

  test("should toggle between showing top tags and all tags", async ({
    page,
  }) => {
    // Navigate to tag cloud
    await page.click('a[href*="tag-cloud"], button:has-text("Tag Cloud")');

    // Wait for tag cloud
    const tagCloudCanvas = page.locator(".tag-cloud-canvas");
    await expect(tagCloudCanvas).toBeVisible();

    // Count initial tags
    const initialTags = await page.locator(".tag-cloud-tag").count();

    // Find and click toggle button
    const toggleBtn = page.locator("#tag-cloud-toggle");
    const toggleExists = await toggleBtn.isVisible().catch(() => false);

    if (toggleExists) {
      // Get initial button text
      const initialButtonText = await toggleBtn.textContent();

      // Click toggle
      await toggleBtn.click();
      await page.waitForLoadState("networkidle");

      // Get new button text
      const newButtonText = await toggleBtn.textContent();

      // Should have toggled
      expect(initialButtonText).not.toEqual(newButtonText);

      // Tag count may change depending on toggle
      const newTagCount = await page.locator(".tag-cloud-tag").count();
      expect(newTagCount).toBeGreaterThan(0);
    }
  });

  test("should maintain responsive layout on resize", async ({ page }) => {
    // Set initial viewport
    await page.setViewportSize({ width: 1200, height: 800 });

    // Navigate to tag cloud
    await page.click('a[href*="tag-cloud"], button:has-text("Tag Cloud")');

    // Wait for render
    const canvas = page.locator(".tag-cloud-canvas");
    await expect(canvas).toBeVisible();

    // Get initial canvas height
    const initialBox = await canvas.boundingBox();

    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);

    // Get new canvas height
    const mobileBox = await canvas.boundingBox();

    expect(mobileBox).toBeTruthy();
    expect(mobileBox?.height).toBeGreaterThan(0);

    // Heights should be different (mobile viewport is narrower)
    expect(initialBox?.height).not.toEqual(mobileBox?.height);
  });
});
