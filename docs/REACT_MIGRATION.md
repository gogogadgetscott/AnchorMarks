# React Migration Plan

## Current Status (Updated March 8, 2026)

**✅ Migration is ~80% complete!** Most of the app now runs on React.

### What's Working
- ✅ React setup complete (Vite + React 19)
- ✅ All Context providers (Auth, Bookmarks, UI, Folders, Dashboard, etc.)
- ✅ App shell and layout (App.tsx, AppShell.tsx, main.tsx)
- ✅ All leaf components migrated (Button, Badge, Icon, Tag, etc.)
- ✅ BookmarkCard and RichBookmarkCard components
- ✅ BookmarksList with IntersectionObserver for infinite scroll
- ✅ Omnibar (React component + legacy bridge)
- ✅ Header & Navigation
- ✅ All modals (BookmarkModal, TagModal, FolderModal, SettingsModal, etc.)
- ✅ Dashboard with drag-and-drop (@dnd-kit)
- ✅ Tag Cloud visualization
- ✅ Filter sidebar
- ✅ Smart collections and insights
- ✅ Context bridge for legacy code integration

### What's Left
- ⚠️ Some legacy `*.ts` files still exist alongside `*.tsx` versions
- ⚠️ The old `features/state.ts` module still exists (being phased out)
- ⚠️ A few tests may reference old file paths
- 🐛 2 minor unused variable warnings in TypeScript

### Migration Strategy Used

**Bridge Pattern:** Instead of a "big bang" rewrite, we kept legacy code working alongside React:

1. **Context Bridge** (`contexts/context-bridge.ts`): Non-React code (like `api.ts`, `auth.ts`) can access React context via imperative getters/setters
2. **Parallel Files**: Some components exist as both `.ts` (legacy) and `.tsx` (React) during transition
3. **Gradual Cutover**: Features switched to React one at a time, keeping the app functional throughout

---

## Cleanup Tasks (1-2 days)

To finish the migration and get back to feature work:

### 1. Remove Unused Legacy Files (30 min)

Search for duplicate `.ts` files that have `.tsx` equivalents:

### 1. Remove Unused Legacy Files (30 min)

Search for duplicate `.ts` files that have `.tsx` equivalents:

```bash
# Find components that exist as both .ts and .tsx
find apps/client/src/components -name '*.ts' ! -name '*.test.ts' ! -name '*.d.ts' | while read f; do
  tsx="${f%.ts}.tsx"
  [ -f "$tsx" ] && echo "Duplicate: $f (has .tsx version)"
done
```

**Action:** Delete the `.ts` versions if the `.tsx` versions are fully functional.

### 2. Fix Test Imports (30 min)

Some tests import from old file paths (e.g., `../omnibar` instead of `../omnibar-controller`).

```bash
# Find tests that might have stale imports
grep -r "from.*omnibar['\"]" apps/client --include="*.test.ts" --include="*.test.tsx"
```

**Action:** Update imports to point to the correct files.

### 3. Remove or Archive `features/state.ts` (1 hour)

The old global state module is no longer needed. All state is now in React contexts.

**Check what still imports it:**

```bash
grep -r "from.*features/state" apps/client/src --include="*.ts" --include="*.tsx" | grep -v "state.ts:"
```

**Action:**  
- If only a few files import it, migrate those to use context bridge  
- If nothing imports it, delete or move to `__legacy__/` folder

### 4. Clean Up Unused Variables (5 min)

Fix the 2 TypeScript warnings:

- [Icon.test.tsx](apps/client/src/components/Icon.test.tsx#L2): Remove unused `screen` import
- [FoldersContext.tsx](apps/client/src/contexts/FoldersContext.tsx#L107): Remove unused `closeModal` variable

---

## Architecture Overview

### React Components

All UI is now React components in `apps/client/src/components/`:

- **Leaf components**: Button, Badge, Icon, Tag, SkeletonCard, etc.
- **Cards**: BookmarkCard, RichBookmarkCard
- **Lists**: BookmarksList (with infinite scroll)
- **Layout**: Header, Sidebar, AppShell
- **Views**: BookmarkViews, Dashboard, TagCloud, AnalyticsView
- **Modals**: BookmarkModal, TagModal, FolderModal, SettingsModal

### State Management

State is managed using React Context + useReducer in `apps/client/src/contexts/`:

| Context              | Manages                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `AuthContext`        | `currentUser`, `csrfToken`, `isAuthenticated`, login/logout       |
| `BookmarksContext`   | `bookmarks[]`, `filterConfig`, `selectedBookmarks`, bulk actions  |
| `UIContext`          | `currentView`, `viewMode`, `hideFavicons`, `hideSidebar`, sidebar |
| `FoldersContext`     | `folders[]`, `currentFolder`, folder CRUD                         |
| `DashboardContext`   | `widgets[]`, `widgetOrder`, dashboard config, drag-and-drop       |
| `ModalContext`       | Modal open/close state, current modal                             |
| `ToastContext`       | Toast notifications                                               |
| `ConfirmContext`     | Confirmation dialogs                                              |

### Context Bridge

Non-React code (e.g., `api.ts`, legacy event handlers) accesses React state via **context-bridge.ts**:

```typescript
import { getAuthBridge, getBookmarksBridge } from "@contexts/context-bridge";

// Example: Get current user in non-React code
const currentUser = getAuthBridge().getCurrentUser();

// Example: Update bookmarks
getBookmarksBridge().loadBookmarks();
```

This bridge pattern allowed incremental migration without breaking existing code.

---

## Key Files

- **Entry point**: [main.tsx](apps/client/src/main.tsx) → renders `<App />`
- **Root component**: [App.tsx](apps/client/src/App.tsx) → handles auth check and loads data
- **Shell**: [AppShell.tsx](apps/client/src/AppShell.tsx) → layout with header, sidebar, content area
- **Providers**: [contexts/AppProviders.tsx](apps/client/src/contexts/AppProviders.tsx) → wraps all contexts
- **Bridge**: [contexts/context-bridge.ts](apps/client/src/contexts/context-bridge.ts) → legacy code integration

---

## Testing

| Current                       | React replacement                       |
| ----------------------------- | --------------------------------------- |
| Component string-output tests | `@testing-library/react` render + query |
| `jsdom` (already installed)   | Keep — RTL uses it                      |
| Manual DOM event tests        | `fireEvent` / `userEvent`               |

Add to devDependencies: `@testing-library/react`, `@testing-library/user-event`.

Existing Vitest setup needs no changes.

---

## What to keep as-is

| Module            | Notes                              |
| ----------------- | ---------------------------------- |
| `services/api.ts` | Pure HTTP layer, no changes needed |
| `utils/`          | All utilities stay as-is           |
| `types/`          | All types stay as-is               |
| `styles.css`      | No changes                         |
| `apps/server/`    | Completely untouched               |

---

## Completed

- Phase 0: React setup (vite, tsconfig, dependencies)
- Phase 1: State Layer - Contexts created (AuthContext, BookmarksContext, UIContext, FoldersContext, DashboardContext, ModalContext, ToastContext, ConfirmContext)
- Phase 2: Leaf Components - All converted to .tsx
- Phase 3: BookmarkCard Components - Converted
- Phase 4: BookmarksList - Converted
- Phase 5: Omnibar - Converted
- Phase 6: Header & Navigation - Converted
- Phase 7: Modals & Forms - All converted
- Phase 8: Dashboard - Converted
- Phase 9: App Shell - Converted (main.tsx, App.tsx)
- Phase 10: Tests - Many .test.tsx files added
- Phase 11: Feature Migration to Contexts (In Progress)
  - ✅ Auth methods migrated to AuthContext (login, register, logout, checkAuth, updateProfile, updatePassword, regenerateApiKey, copyApiKey)
  - ✅ Folder CRUD migrated to FoldersContext (createFolder, updateFolder, deleteFolder, getRecursiveBookmarkCount)
  - ✅ Tag management migrated to BookmarksContext (fetchTagStats, renameTag, deleteTag, updateTag, createTag)
  - ✅ Components updated to use context methods (AuthScreen, ProfileSettings, ApiSettings, FolderModal, WidgetPicker, TagSettings, TagModal)
  - ⏳ Settings, import/export, bulk operations pending
  - ⏳ Keyboard shortcuts need React context integration
- WebSocket: useWebSocket hook created, services/websocket.ts removed
- Auth: auth.ts integrated with React context

### Remaining Legacy Code

- Some `features/*.ts` modules still exist and are used by legacy keyboard handlers
- Legacy `.ts` component files (Badge.ts, Icon.ts, Tag.ts) still exist for backwards compatibility with legacy feature files
- Settings, import/export, and bulk operations still use imperative functions
- Keyboard shortcuts still call some legacy render functions (e.g., renderDashboard)
- Some data-action event delegation patterns remain in maintenance.ts and legacy features

---

## Common Patterns & Best Practices

### 1. useEffect Dependencies

Be careful with exhaustive deps - ESLint will warn about missing dependencies:

```tsx
// ❌ BAD: Missing dependency
useEffect(() => {
  loadData(userId);
}, []);

// ✅ GOOD: Include all dependencies
useEffect(() => {
  loadData(userId);
}, [userId, loadData]);
```

### 2. Callback Memoization

Use `useCallback` for functions passed to child components to prevent unnecessary re-renders:

```tsx
const handleDelete = useCallback((id: string) => {
  deleteBookmark(id);
}, [deleteBookmark]);
```

### 3. Context Consumers

Most state access goes through custom hooks:

```tsx
import { useAuth } from "@contexts/AuthContext";
import { useBookmarks } from "@contexts/BookmarksContext";

function MyComponent() {
  const { currentUser } = useAuth();
  const { bookmarks, loadBookmarks } = useBookmarks();
  // ...
}
```

### 4. Legacy Bridge Access

When legacy code needs React state:

```tsx
import { getAuthBridge } from "@contexts/context-bridge";

// In non-React code:
const user = getAuthBridge().getCurrentUser();
```

---

## Troubleshooting

### "Cannot find module" errors

Check import paths - files may have been renamed or moved during migration.

```bash
# Find what imports a specific file
grep -r "from.*filename" apps/client/src
```

### "Context not initialized" errors

Ensure `AppProviders` wraps your component:

```tsx
// main.tsx
<AppProviders>
  <App />
</AppProviders>
```

### State not updating

React state is immutable. Always create new objects/arrays:

```tsx
// ❌ BAD: Mutates state
bookmarks.push(newBookmark);
setBookmarks(bookmarks);

// ✅ GOOD: Creates new array
setBookmarks([...bookmarks, newBookmark]);
```

---

## Quick Wins for Getting Back to Features

If you just want to get the app working and move on:

1. **Run type check**: `cd apps/client && npx tsc --noEmit 2>&1 | head -20`
2. **Fix any remaining import errors**: Update paths as needed
3. **Run tests**: `make test` - should be mostly passing
4. **Start dev server**: `make start-local` - app should work!
5. **Archive legacy files**: Move unused `.ts` files to `__legacy__/` folder for reference

The migration is ~80% complete. The remaining work is primarily cleanup and removing legacy code.

---

## Pattern Comparison: Before vs After

### Before (Vanilla TS)

```typescript
// Manual re-rendering everywhere
function addBookmark(bookmark) {
  state.bookmarks.push(bookmark);
  renderBookmarks();  // Full re-render
  updateStats();      // Full re-render
  renderFolders();    // Full re-render
}

// Event delegation with data-attributes
container.innerHTML = `<button data-action="delete" data-id="${id}">Delete</button>`;
document.addEventListener('click', (e) => {
  if (e.target.dataset.action === 'delete') {
    // handle delete
  }
});
```

### After (React)

```tsx
// Declarative state updates
function useBookmarkActions() {
  const { bookmarks, setBookmarks } = useBookmarks();
  
  const addBookmark = useCallback((bookmark: Bookmark) => {
    setBookmarks([...bookmarks, bookmark]);
    // Stats and folders auto-update via their own contexts
  }, [bookmarks, setBookmarks]);
  
  return { addBookmark };
}

// Explicit event handlers
<button onClick={() => deleteBookmark(id)}>Delete</button>
```

React handles:
- **Re-rendering**: Only affected components update
- **Event handling**: Direct callbacks, no delegation needed
- **State sync**: Single source of truth in context

---

## Next Steps After Cleanup

Once cleanup is done, you can:

1. **Remove legacy state.ts entirely** - all state should be in contexts now
2. **Delete legacy `.ts` component files** - keep only `.tsx` versions  
3. **Update CHANGELOG.md** - document the React migration completion
4. **Get back to feature development!** 🎉

---

## Original Plan (For Reference)

The migration followed these phases:
