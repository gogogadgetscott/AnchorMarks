const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'screenshots');
const WAIT_AFTER_ANIMATION = 1000; // 1 second

const themes = ['light', 'dark', 'ocean', 'sunset', 'midnight'];

const viewports = [
    { label: 'desktop', width: 1440, height: 900 },
    { label: 'tablet', width: 1024, height: 768 },
    { label: 'mobile', width: 390, height: 844 }
];

const states = [
    { label: 'home', path: '/' },
    { label: 'grid-view', path: '/?view_mode=grid' },
    { label: 'list-view', path: '/?view_mode=list' },
    { label: 'favorites', path: '/?filter=starred' }, // Adjusting based on common patterns, may need refinement
    { label: 'recent', path: '/?filter=recent' }
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // We might need to login. For now, let's assume we can skip or handle it if needed.
    // If the app requires login, we can add a login helper here.

    try {
        for (const theme of themes) {
            for (const viewport of viewports) {
                await page.setViewportSize({ width: viewport.width, height: viewport.height });

                for (const state of states) {
                    if (count >= limit) break;

                    const url = `${BASE_URL}${state.path}`;
                    console.log(`[${count + 1}] Capturing: Theme=${theme}, Viewport=${viewport.label}, State=${state.label}`);

                    await page.goto(url, { waitUntil: 'networkidle' });

                    // Switch theme
                    await page.evaluate((t) => {
                        document.documentElement.setAttribute('data-theme', t);
                        localStorage.setItem('anchormarks_theme', t);
                    }, theme);

                    // Wait for animations/theme transitions
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
        console.error('Error during screenshot capture:', error);
    } finally {
        await browser.close();
        console.log(`Finished! Generated ${count} screenshots in ${SCREENSHOT_DIR}`);
    }
}

// Handle CLI arguments
const limitArg = process.argv[2];
const limit = limitArg ? parseInt(limitArg, 10) : Infinity;

captureScreenshots(limit);
