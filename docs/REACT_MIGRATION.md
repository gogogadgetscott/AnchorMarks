# React Migration Plan

## Overview

The current client is vanilla TypeScript with string-based components, manual DOM rendering, and imperative state management. This document outlines a phased migration to React.

### Pain points React solves

- Manual re-render calls everywhere (`renderBookmarks()`, `renderDashboard()`, etc.)
- Event re-attachment after every `innerHTML` replacement
- State sync bugs — DOM and `state.ts` can drift
- `_listenerAttached` flags to prevent duplicate handlers

---

## Phase 0: Setup (1 day)

Install dependencies and configure tooling — no code changes yet.

```bash
npm install react react-dom
npm install -D @types/react @types/react-dom @vitejs/plugin-react
```

- **vite.config.js:** Add `react()` plugin, keep all existing aliases
- **tsconfig.json:** Add `"jsx": "react-jsx"`
- Rename `*.ts` → `*.tsx` only as you touch files in later phases

---

## Phase 1: State Layer (2–3 days)

**Goal:** Replace `features/state.ts` with React Context + `useReducer`.

The current state module has ~70 variables. Group them into domain slices:

| Slice              | Key state                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `AuthContext`      | `authToken`, `csrfToken`, `currentUser`, `isAuthenticated`                                |
| `BookmarksContext` | `bookmarks[]`, `renderedBookmarks[]`, `filterConfig`, `displayedCount`, `isLoading`       |
| `UIContext`        | `currentView`, `viewMode`, `hideFavicons`, `hideSidebar`, `selectedBookmarks`, `bulkMode` |
| `FoldersContext`   | `folders[]`, `currentFolder`                                                              |
| `DashboardContext` | `dashboardConfig`, `widgets[]`, `widgetOrder`, `dashboardHasUnsavedChanges`               |

Keep the existing `state.ts` in place during migration — contexts will gradually absorb it slice by slice.

---

## Phase 2: Leaf Components (3–4 days)

These are pure functions returning HTML strings today — trivial to port. Do these first because they have no state dependencies.

| Current file                 | New file                      | Complexity |
| ---------------------------- | ----------------------------- | ---------- |
| `components/Button.ts`       | `components/Button.tsx`       | Trivial    |
| `components/Badge.ts`        | `components/Badge.tsx`        | Trivial    |
| `components/Icon.ts`         | `components/Icon.tsx`         | Trivial    |
| `components/Tag.ts`          | `components/Tag.tsx`          | Trivial    |
| `components/SkeletonCard.ts` | `components/SkeletonCard.tsx` | Trivial    |
| `components/ViewToggle.ts`   | `components/ViewToggle.tsx`   | Simple     |
| `components/UserProfile.ts`  | `components/UserProfile.tsx`  | Simple     |

These are pure props → JSX transforms with no state or side effects.

---

## Phase 3: BookmarkCard Components (2–3 days)

`BookmarkCard` and `RichBookmarkCard` are the most-rendered components. They use `data-action` attributes for event delegation — replace with explicit `onClick` props.

**Current pattern:**

```typescript
// String template with data attributes
`<button data-action="open-bookmark" data-url="${url}">Open</button>`;
// Global delegated handler catches this
```

**React pattern:**

```tsx
// Explicit callbacks as props
<BookmarkCard
  bookmark={b}
  onOpen={() => window.open(b.url)}
  onEdit={() => openEditModal(b.id)}
  onDelete={() => deleteBookmark(b.id)}
  isSelected={selectedBookmarks.has(b.id)}
  onSelect={() => toggleSelection(b.id)}
/>
```

Drop the `data-action` delegation pattern entirely for these components.

---

## Phase 4: BookmarksList (2 days)

The main list renderer currently calls `innerHTML` on the grid container. Replace with a React component that maps `bookmarks[]` from context:

```tsx
function BookmarksList() {
  const { bookmarks, viewMode, isLoading } = useBookmarks();

  if (isLoading) return <SkeletonGrid />;
  if (!bookmarks.length) return <EmptyState />;

  return (
    <div className={`bookmarks-${viewMode}`}>
      {bookmarks.map((b) => (
        <BookmarkCard key={b.id} bookmark={b} />
      ))}
    </div>
  );
}
```

This eliminates `renderBookmarks()`, `renderSkeletons()`, and scroll-based `loadMore` imperative calls — replace the latter with an `IntersectionObserver` hook.

---

## Phase 5: Omnibar (2–3 days)

The omnibar is self-contained with its own local state. Use `useState` for:

- `isOpen`, `activeIndex`, `currentItems`, `query`

Replace the manual section rendering (`omnibar-recent-list`, `omnibar-results-list` via `innerHTML`) with conditional JSX sections.

---

## Phase 6: Header & Navigation (2 days)

The `Header` component currently re-renders as a full `innerHTML` string swap on every view change. In React:

```tsx
function Header() {
  const { currentView } = useUI();
  return (
    <header>
      <ViewTitle view={currentView} />
      <Omnibar />
      <ViewControls view={currentView} />
    </header>
  );
}
```

Navigation sidebar: Replace `_navViewListenerAttached` flag pattern with `onClick` handlers.

---

## Phase 7: Modals & Forms (3–4 days)

The modal system currently uses raw HTML fragments (`bookmark-modal.html`, etc.) injected via `innerHTML`. Port each to a React component controlled by an `isOpen` boolean from context:

- Bookmark add/edit modal
- Tag modal
- Folder modal
- Filter sidebar
- Settings modal
- Onboarding tour

Use a single `<ModalPortal>` rendered at the app root via `ReactDOM.createPortal`.

---

## Phase 8: Dashboard (4–5 days)

The most complex piece — drag/drop, widget picker, resizing, saved views. Tackle last.

- Replace `widget-picker.ts` and `dashboard.ts` with React components
- Use a library for drag-and-drop (e.g. `@dnd-kit/core`) rather than reimplementing
- Dashboard state becomes `DashboardContext`

---

## Phase 9: App Shell & Entrypoint (1 day)

Replace `layouts/loader.ts` (the manual DOM construction) with:

```tsx
// main.tsx
ReactDOM.createRoot(document.getElementById("app")!).render(
  <AppProviders>
    <App />
  </AppProviders>,
);

// App.tsx
function App() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <MainLayout /> : <AuthScreen />;
}
```

---

## Phase 10: Tests (ongoing alongside each phase)

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

## Estimated timeline

~3–4 weeks working roughly in phase order. Each phase is independently shippable — the app continues to work after each phase if you keep the old code running in parallel until the React version is ready to swap in.

**Recommended order:** Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9, with Phase 10 tests written alongside each.
