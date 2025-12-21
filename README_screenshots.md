# AnchorMarks Screenshot Pipeline

This directory contains an automated screenshot pipeline using Playwright to generate UI screenshots for various themes, states, and viewports.

## Prerequisites

- Node.js (>=18.0.0)
- NPM

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```

## Running the Screenshot Generator

1. Ensure the Vite dev server is running:
   ```bash
   npm run dev:vite
   ```

2. In a separate terminal, run the screenshot script:
   ```bash
   npm run screenshots
   ```

   To generate a limited number of screenshots (e.g., 10):
   ```bash
   npm run screenshots -- 10
   ```

## Customization

You can customize the following in `scripts/capture-screenshots.js`:

- **Themes**: Add or remove theme names in the `themes` array.
- **Viewports**: Add or remove viewport presets in the `viewports` array.
- **States**: Add or remove app routes/query parameters in the `states` array.

## Output

Screenshots are saved to the `screenshots/` directory with the following naming convention:
`<timestamp>_<theme>_<viewportLabel>_<stateLabel>.png`

## Theme Detection

The script switches themes by setting the `data-theme` attribute on the `html` element and updating `localStorage.anchormarks_theme`. This matches how the application currently handles theme persistence and application.
