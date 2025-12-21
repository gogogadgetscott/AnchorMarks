# DEPRECATED HTML Fragments

⚠️ **These HTML fragments are deprecated and should not be modified.**

The application has been migrated to React components. These files are kept temporarily for reference only.

## React Replacements

- `auth-screen.html` → `src/layouts/AuthScreen.tsx`
- `sidebar.html` → `src/layouts/Sidebar.tsx`  
- `bookmark-modal.html` → `src/layouts/BookmarkModal.tsx`
- `tag-modal.html` → `src/layouts/TagsView.tsx` (inline editing)
- `folder-modal.html` → `src/layouts/FoldersView.tsx` (inline editing)
- `settings-modal.html` → `src/layouts/SettingsView.tsx`
- `toast.html` → `src/layouts/Toast.tsx`
- `empty-state.html` → `src/components/EmptyState.tsx`
- `bulk-bar.html` → `src/components/Header.tsx` (selection UI)
- `main-content.html` → `src/layouts/` (Dashboard, BookmarksView, etc.)
- `filter-sidebar.html` → Integrated into BookmarksView filtering
- `shortcuts-popup.html` → To be migrated
- `quick-launch.html` → `src/components/Omnibar.tsx`
- `onboarding-tour.html` → To be migrated

## Migration Status

✅ Core layouts migrated to React
✅ Authentication flow migrated
✅ Dashboard migrated
✅ Bookmarks view migrated
✅ Folders view migrated
✅ Tags view migrated
✅ Settings view migrated

🔄 Pending:
- Shortcuts popup
- Onboarding tour
- Filter sidebar (will be integrated into views)

These files will be removed in a future release once all features are fully migrated and tested.
