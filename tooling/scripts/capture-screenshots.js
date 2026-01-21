const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// Configuration
const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");
const WAIT_AFTER_ANIMATION = 1000; // 1 second

const themes = ["light", "dark", "ocean", "sunset", "midnight"];

const viewports = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "tablet", width: 1024, height: 768 },
  { label: "mobile", width: 390, height: 844 },
];

const states = [
  { label: "home", selector: '.nav-item[data-view="dashboard"]' },
  {
    label: "grid-view",
    selector: '.nav-item[data-view="all"]',
    subSelector: '.view-btn[data-view-mode="grid"]',
  },
  {
    label: "list-view",
    selector: '.nav-item[data-view="all"]',
    subSelector: '.view-btn[data-view-mode="list"]',
  },
  { label: "favorites", selector: '.nav-item[data-view="favorites"]' },
  { label: "recent", selector: '.nav-item[data-view="recent"]' },
];

async function captureScreenshots(limit = Infinity) {
  // Ensure screenshot directory exists
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let count = 0;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  // Generate random credentials
  const randomId = Math.random().toString(36).substring(7);
  const email = `temp_${randomId}@example.com`;
  const password = "password123";

  try {
    console.log(`Creating temporary user: ${email}`);
    await page.goto(`${BASE_URL}/`);

    // Switch to register tab
    await page.click('.auth-tab[data-tab="register"]');

    // Fill register form
    await page.fill("#register-email", email);
    await page.fill("#register-password", password);
    await page.click('#register-form button[type="submit"]');

    // Wait for app to load and verify we are truly logged in
    await page.waitForSelector("#main-app", { state: "visible" });

    // Extra verification
    const isLoggedIn = await page.evaluate(() => {
      const logoutBtn = document.getElementById("logout-btn");
      return !!logoutBtn;
    });

    if (!isLoggedIn) {
      throw new Error(
        "Registration appeared successful but logout button not found. Login may have failed.",
      );
    }

    console.log("Logged in successfully as temporary user.");

    // Dismiss the onboarding tour if it appears
    try {
      const tourSkip = await page.waitForSelector(".tour-skip", {
        timeout: 5000,
      });
      if (tourSkip) {
        console.log("Dismissing onboarding tour...");
        await tourSkip.click();
        await page.waitForSelector("#tour-popover", { state: "hidden" });
      }
    } catch (e) {
      console.log("Onboarding tour not detected or already dismissed.");
    }

    for (const theme of themes) {
      // Set theme once per theme group
      await page.evaluate((t) => {
        document.documentElement.setAttribute("data-theme", t);
        localStorage.setItem("anchormarks_theme", t);
      }, theme);

      for (const viewport of viewports) {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        for (const state of states) {
          if (count >= limit) break;

          console.log(
            `[${count + 1}] Capturing: Theme=${theme}, Viewport=${viewport.label}, State=${state.label}`,
          );

          // Use UI interaction
          await page.click(state.selector);
          if (state.subSelector) {
            await page.click(state.subSelector);
          }

          // Wait for app to be ready and settled
          await page.waitForSelector("#main-app", { state: "visible" });
          await page.waitForTimeout(WAIT_AFTER_ANIMATION);

          const filename = `${timestamp}_${theme}_${viewport.label}_${state.label}.png`;
          const filePath = path.join(SCREENSHOT_DIR, filename);

          await page.screenshot({ path: filePath, fullPage: true });
          count++;
        }
        if (count >= limit) break;
      }
      if (count >= limit) break;
    }
  } catch (error) {
    console.error("Error during screenshot capture:", error);
  } finally {
    try {
      console.log(`Cleaning up: Deleting temporary user ${email}`);
      await page.evaluate(async () => {
        const getCookie = (name) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop().split(";").shift();
        };
        const csrfToken = getCookie("csrfToken");

        await fetch("/api/auth/me", {
          method: "DELETE",
          headers: {
            "X-CSRF-Token": csrfToken,
          },
        });
      });
      console.log("Cleanup complete.");
    } catch (cleanupError) {
      console.error("Error during cleanup:", cleanupError);
    }

    await browser.close();
    console.log(
      `Finished! Generated ${count} screenshots in ${SCREENSHOT_DIR}`,
    );
  }
}

// Handle CLI arguments
const limitArg = process.argv[2];
const limit = limitArg ? parseInt(limitArg, 10) : Infinity;

captureScreenshots(limit);
