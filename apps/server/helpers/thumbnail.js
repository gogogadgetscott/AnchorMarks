/**
 * Thumbnail Screenshot Service
 * Uses Puppeteer to capture webpage screenshots for bookmark previews
 */

const path = require("path");
const fs = require("fs");
const config = require("../config");

let browser = null;
let browserInitializing = false;
const pendingBrowserPromises = [];

const THUMBNAILS_DIR = path.join(__dirname, "../public/thumbnails");

// Ensure thumbnails directory exists
if (!fs.existsSync(THUMBNAILS_DIR)) {
    fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

/**
 * Initialize or get existing Puppeteer browser instance
 * Uses lazy initialization to avoid startup overhead
 */
async function getBrowser() {
    if (browser) return browser;

    // If already initializing, wait for it
    if (browserInitializing) {
        return new Promise((resolve, reject) => {
            pendingBrowserPromises.push({ resolve, reject });
        });
    }

    browserInitializing = true;

    try {
        const puppeteer = require("puppeteer");
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu",
                "--window-size=1280,800",
            ],
            // Reduce memory usage
            defaultViewport: {
                width: config.THUMBNAIL_WIDTH,
                height: config.THUMBNAIL_HEIGHT,
            },
        });

        // Handle browser disconnect
        browser.on("disconnected", () => {
            browser = null;
        });

        // Resolve all pending promises
        pendingBrowserPromises.forEach(({ resolve }) => resolve(browser));
        pendingBrowserPromises.length = 0;

        return browser;
    } catch (err) {
        browserInitializing = false;
        pendingBrowserPromises.forEach(({ reject }) => reject(err));
        pendingBrowserPromises.length = 0;
        throw err;
    } finally {
        browserInitializing = false;
    }
}

/**
 * Capture a screenshot of a URL and save it as a thumbnail
 * @param {string} url - The URL to screenshot
 * @param {string} bookmarkId - The bookmark ID (used for filename)
 * @returns {Promise<{success: boolean, path?: string, error?: string}>}
 */
async function captureScreenshot(url, bookmarkId) {
    if (!config.THUMBNAIL_ENABLED) {
        return { success: false, error: "Thumbnail generation is disabled" };
    }

    const thumbnailPath = path.join(THUMBNAILS_DIR, `${bookmarkId}.jpg`);
    const relativePath = `/thumbnails/${bookmarkId}.jpg`;

    // Check if thumbnail already exists
    if (fs.existsSync(thumbnailPath)) {
        return { success: true, path: relativePath, cached: true };
    }

    let page = null;

    try {
        const browserInstance = await getBrowser();
        page = await browserInstance.newPage();

        // Set viewport
        await page.setViewport({
            width: config.THUMBNAIL_WIDTH,
            height: config.THUMBNAIL_HEIGHT,
        });

        // Block unnecessary resources for faster loading
        await page.setRequestInterception(true);
        page.on("request", (request) => {
            const resourceType = request.resourceType();
            const blockedTypes = ["media", "font"];
            const reqUrl = request.url();

            // Block tracking/analytics scripts
            const blockedPatterns = [
                "google-analytics",
                "googletagmanager",
                "facebook",
                "twitter",
                "analytics",
                "tracking",
                "doubleclick",
                "adservice",
            ];

            if (blockedTypes.includes(resourceType)) {
                request.abort();
            } else if (blockedPatterns.some((pattern) => reqUrl.includes(pattern))) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // Navigate to URL with timeout
        await page.goto(url, {
            waitUntil: "networkidle2",
            timeout: config.THUMBNAIL_TIMEOUT,
        });

        // Wait a bit for any lazy-loaded content
        await page.evaluate(
            () => new Promise((resolve) => setTimeout(resolve, 500)),
        );

        // Take screenshot
        await page.screenshot({
            path: thumbnailPath,
            type: "jpeg",
            quality: config.THUMBNAIL_QUALITY,
            fullPage: false,
        });

        return { success: true, path: relativePath };
    } catch (err) {
        console.error(`Failed to capture screenshot for ${url}:`, err.message);

        // Clean up partial file if exists
        if (fs.existsSync(thumbnailPath)) {
            try {
                fs.unlinkSync(thumbnailPath);
            } catch { }
        }

        return { success: false, error: err.message };
    } finally {
        if (page) {
            try {
                await page.close();
            } catch { }
        }
    }
}

/**
 * Close the browser instance (for graceful shutdown)
 */
async function closeBrowser() {
    if (browser) {
        try {
            await browser.close();
        } catch { }
        browser = null;
    }
}

/**
 * Delete a thumbnail file
 * @param {string} bookmarkId - The bookmark ID
 */
function deleteThumbnail(bookmarkId) {
    const thumbnailPath = path.join(THUMBNAILS_DIR, `${bookmarkId}.jpg`);
    if (fs.existsSync(thumbnailPath)) {
        try {
            fs.unlinkSync(thumbnailPath);
            return true;
        } catch {
            return false;
        }
    }
    return false;
}

/**
 * Check if a thumbnail exists for a bookmark
 * @param {string} bookmarkId - The bookmark ID
 * @returns {boolean}
 */
function thumbnailExists(bookmarkId) {
    const thumbnailPath = path.join(THUMBNAILS_DIR, `${bookmarkId}.jpg`);
    return fs.existsSync(thumbnailPath);
}

// Graceful shutdown handlers
process.on("SIGINT", closeBrowser);
process.on("SIGTERM", closeBrowser);
process.on("exit", closeBrowser);

module.exports = {
    captureScreenshot,
    closeBrowser,
    deleteThumbnail,
    thumbnailExists,
    THUMBNAILS_DIR,
};
