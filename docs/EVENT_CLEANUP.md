# Event Cleanup System - Usage Guide

## Overview

The event cleanup system prevents memory leaks by automatically removing event listeners when views change. It uses the `AbortController` API to manage listener lifecycle.

## Architecture

### Two Levels of Cleanup

1. **Global Cleanup** - For app-level listeners (document, window)
2. **View Cleanup** - For view-specific listeners (dashboard, bookmarks, settings, etc.)

### Automatic Cleanup

When changing views via `state.setCurrentView()`, the system automatically cleans up the previous view's listeners.

## Usage

### 1. Global App-Level Listeners

Use for listeners on `document` or `window` that persist across views:

```typescript
import { registerGlobalCleanup } from "@utils/event-cleanup.ts";

// Initialize once in App.ts
const globalController = registerGlobalCleanup();

// Add listeners with signal
document.addEventListener("keydown", handleKeyboard, {
  signal: globalController.signal,
});

window.addEventListener("focus", handler, {
  signal: globalController.signal,
});
```

### 2. View-Specific Listeners

Use for listeners that should be removed when leaving a view:

```typescript
import {
  registerViewCleanup,
  addManagedListener,
} from "@utils/event-cleanup.ts";

function initDashboardView() {
  // Register cleanup for this view
  const controller = registerViewCleanup("dashboard");

  // Option A: Direct addEventListener with signal
  document
    .getElementById("add-widget-btn")
    ?.addEventListener("click", handleAddWidget, {
      signal: controller.signal,
    });

  // Option B: Use helper function
  const addBtn = document.getElementById("add-widget-btn");
  addManagedListener(addBtn, "click", handleAddWidget, controller.signal);
}
```

### 3. Component-Level Event Listeners

For dynamically rendered components that add their own listeners:

```typescript
import { getViewSignal } from "@utils/event-cleanup.ts";

function renderBookmarkCards() {
  const signal = getViewSignal("bookmarks");

  bookmarks.forEach((bookmark) => {
    const card = createBookmarkCard(bookmark);

    if (signal) {
      card.addEventListener("click", () => openBookmark(bookmark.id), {
        signal,
      });
    }
  });
}
```

### 4. Manual Cleanup

For special cases where you need manual control:

```typescript
import { cleanupView, cleanupAllViews } from "@utils/event-cleanup.ts";

// Clean up specific view
cleanupView("dashboard");

// Clean up all views (use sparingly, e.g., on logout)
cleanupAllViews();
```

## Examples

### Example 1: Modal with Auto-Cleanup

```typescript
import { registerViewCleanup } from "@utils/event-cleanup.ts";

function openSettingsModal() {
  const modal = document.getElementById("settings-modal");
  const controller = registerViewCleanup("settings-modal");

  // All these listeners auto-cleanup when view changes
  modal.querySelector(".close-btn")?.addEventListener("click", closeModal, {
    signal: controller.signal,
  });

  modal.querySelector("form")?.addEventListener("submit", saveSettings, {
    signal: controller.signal,
  });

  document.addEventListener("keydown", handleModalKeyboard, {
    signal: controller.signal,
  });
}
```

### Example 2: Dashboard Widget Listeners

```typescript
import {
  registerViewCleanup,
  addManagedListener,
} from "@utils/event-cleanup.ts";

export function initDashboardInteractions() {
  const controller = registerViewCleanup("dashboard");
  const signal = controller.signal;

  // Widget drag & drop
  const widgetContainer = document.getElementById("dashboard-widgets");
  addManagedListener(widgetContainer, "dragstart", handleDragStart, signal);
  addManagedListener(widgetContainer, "dragover", handleDragOver, signal);
  addManagedListener(widgetContainer, "drop", handleDrop, signal);

  // Widget picker
  const pickerBtn = document.getElementById("dashboard-add-widget-btn");
  addManagedListener(pickerBtn, "click", toggleWidgetPicker, signal);
}
```

### Example 3: Form Validation with Cleanup

```typescript
import { registerViewCleanup } from "@utils/event-cleanup.ts";

function initBookmarkForm() {
  const controller = registerViewCleanup("bookmark-form");

  const urlInput = document.getElementById("bookmark-url");
  urlInput?.addEventListener("input", validateUrl, {
    signal: controller.signal,
  });

  const form = document.getElementById("bookmark-form");
  form?.addEventListener("submit", handleSubmit, {
    signal: controller.signal,
  });

  // Auto-cleanup when form closes or view changes
}
```

## Debugging

The cleanup system exposes debug utilities in development mode:

```javascript
// In browser console (DEV mode only)
__eventCleanupDebug.getStats();
// Returns: { registeredViews: ["dashboard", "bookmarks"], viewCount: 2, hasGlobal: true }

__eventCleanupDebug.cleanupView("dashboard");
// Manually cleanup a specific view

__eventCleanupDebug.cleanupAllViews();
// Clear all view cleanups
```

## Best Practices

### ✅ DO

- Use `registerViewCleanup()` at the start of view initialization
- Pass `{ signal }` to all `addEventListener` calls
- Use descriptive view names ("dashboard", "bookmark-form", "settings-modal")
- Let the system handle cleanup automatically via `setCurrentView()`

### ❌ DON'T

- Don't manually call `removeEventListener` if using AbortSignal
- Don't reuse AbortController instances across different views
- Don't forget to pass the signal option to addEventListener
- Don't call `cleanupAllViews()` unless absolutely necessary (logout, app reset)

## Migration Guide

### Before (Old Pattern)

```typescript
function initView() {
  const btn = document.getElementById("my-btn");
  btn?.addEventListener("click", handler);

  // No cleanup - memory leak!
}
```

### After (With Cleanup)

```typescript
import { registerViewCleanup } from "@utils/event-cleanup.ts";

function initView() {
  const controller = registerViewCleanup("my-view");

  const btn = document.getElementById("my-btn");
  btn?.addEventListener("click", handler, {
    signal: controller.signal,
  });

  // Auto-cleanup when leaving view!
}
```

## Testing Cleanup

To verify listeners are properly cleaned up:

```typescript
// In your test
import {
  getCleanupStats,
  registerViewCleanup,
  cleanupView,
} from "@utils/event-cleanup.ts";

test("view cleanup removes listeners", () => {
  registerViewCleanup("test-view");

  const stats = getCleanupStats();
  expect(stats.viewCount).toBe(1);
  expect(stats.registeredViews).toContain("test-view");

  cleanupView("test-view");

  const statsAfter = getCleanupStats();
  expect(statsAfter.viewCount).toBe(0);
});
```

## Performance Impact

- **Memory**: Minimal overhead (~100 bytes per AbortController)
- **CPU**: Negligible (cleanup is O(1) per listener)
- **Browser Support**: All modern browsers (Chrome 66+, Firefox 57+, Safari 12.1+)

## Related APIs

- [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [`addEventListener` signal option](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)
