# Navigation Bar Testing Guide

## Dashboard Toolbar Button Functionality

This document describes the expected behavior for each button in the dashboard navigation toolbar.

### Visual Layout (Left to Right)

1. **Unsaved Indicator** - Appears when changes are pending
2. **View Name Badge** - Shows current dashboard view name (e.g., "ACE - Mobile")
3. **Save Button** - Saves dashboard state
4. **Views Button** - Opens bookmark views dropdown
5. **Add Widget Button** - Opens widget picker
6. **Layout Settings Button** - Opens layout configuration
7. **Fullscreen Button** - Toggles fullscreen mode
8. **User Avatar** - Opens user menu

---

## Button Functionality Tests

### 1. Unsaved Indicator
- **Triggers**: Appears automatically when dashboard layout is modified
- **Visual**: Orange dot with "Unsaved" text
- **Expected**: Should be visible when `hasUnsavedChanges` is true
- **Test**: 
  1. Navigate to Dashboard view
  2. Drag a widget to a new position
  3. Verify indicator appears

### 2. View Name Badge
- **Displays**: Current dashboard view name
- **Visual**: Blue rounded badge with view name
- **Expected**: Shows the active dashboard view (e.g., "Default", "Mobile View")
- **Test**:
  1. Navigate to Dashboard
  2. Verify badge shows current view name
  3. Switch views and verify name updates

### 3. Save Button
- **Action**: `handleSaveDashboard()` → `saveDashboardStateSnapshot()`
- **Location**: [Header.tsx](../apps/client/src/components/Header.tsx#L86-L90)
- **Expected**: 
  - Saves current dashboard layout
  - Disabled when no unsaved changes
  - Shows icon (save) + "Save" text
- **Test**:
  1. Make changes to dashboard layout
  2. Click Save button
  3. Verify success toast appears
  4. Verify Unsaved indicator disappears
  5. Refresh page and verify layout persists

### 4. Views Button
- **Action**: `handleViewsClick()` → Opens bookmark views dropdown
- **Location**: [Header.tsx](../apps/client/src/components/Header.tsx#L104-L113)
- **Expected**:
  - Fetches saved bookmark views from API
  - Opens dropdown showing all saved views
  - Allows restoring, deleting, or saving new views
- **Test**:
  1. Click Views button
  2. Verify dropdown opens with list of saved views
  3. Click a view to restore it
  4. Click "Save Current View" to save active filters
  5. Delete a view using trash icon

### 5. Add Widget Button
- **Action**: `setIsWidgetPickerOpen(!isWidgetPickerOpen)`
- **Location**: [Header.tsx](../apps/client/src/components/Header.tsx#L158)
- **Expected**:
  - Toggles widget picker panel
  - Shows available widgets to add
  - Icon (plus) + "Add Widget" text
- **Test**:
  1. Click Add Widget button
  2. Verify widget picker panel opens
  3. Select a widget type
  4. Verify widget is added to dashboard
  5. Click button again to close picker

### 6. Layout Settings Button
- **Action**: `handleLayoutSettings()` → `toggleLayoutSettings()`
- **Location**: [Header.tsx](../apps/client/src/components/Header.tsx#L98-L102)
- **Expected**:
  - Opens layout configuration modal
  - Shows options like grid size, margins, etc.
  - Icon (settings/gear)
- **Test**:
  1. Click Layout Settings button
  2. Verify settings panel/modal opens
  3. Modify layout settings
  4. Verify changes apply to dashboard

### 7. Fullscreen Button
- **Action**: `handleToggleFullscreen()` → `toggleFullscreen()`
- **Location**: [Header.tsx](../apps/client/src/components/Header.tsx#L92-L96)
- **Expected**:
  - Toggles fullscreen mode
  - Icon switches between expand/compress
  - Hides sidebar and other chrome
- **Test**:
  1. Click Fullscreen button
  2. Verify dashboard enters fullscreen mode
  3. Verify icon changes to exit-fullscreen
  4. Click again to exit fullscreen
  5. Verify normal layout restored

### 8. User Avatar (UserProfile Component)
- **Actions**: Opens user dropdown with:
  - Settings option
  - Logout option
- **Expected**:
  - Shows user's first initial in circle
  - Dropdown shows username and actions
- **Test**:
  1. Click user avatar
  2. Verify dropdown opens with username
  3. Click Settings → verify settings modal opens
  4. Click Logout → verify logout occurs

---

## Styling & Visual Polish

### CSS Enhancements Applied

1. **Consistent Spacing**: All buttons have uniform `0.5rem` gap
2. **Hover Effects**: Subtle lift on hover (`transform: translateY(-1px)`)
3. **Visual Feedback**: Box shadows on hover for depth
4. **Color Consistency**: Primary/secondary button styles follow design system
5. **Responsive Design**: Buttons adapt on mobile (hide text, show icons only)
6. **Disabled State**: Proper visual treatment for disabled Save button

### Button Sizes
- Small (`btn-sm`): 0.425rem × 0.75rem padding
- Regular: 0.5rem × 0.875rem padding

### Color Scheme
- **Primary Buttons**: Blue (#1967d2) → Darker on hover (#185abc)
- **Secondary Buttons**: Gray (#f8f9fa) → Darker on hover (#f1f3f4)
- **Warning Badge**: Orange (#f9ab00) with 10% opacity background

---

## Accessibility

All buttons include:
- ✅ `aria-label` attributes
- ✅ `title` tooltips
- ✅ Keyboard navigation support
- ✅ Focus indicators
- ✅ Semantic HTML (`<button>` elements)

---

## Manual Test Checklist

- [ ] All buttons are visible in dashboard view
- [ ] All buttons are properly aligned
- [ ] Save button is disabled when no changes
- [ ] Save button enables when changes are made
- [ ] Views button opens dropdown
- [ ] Add Widget button opens widget picker
- [ ] Layout Settings button opens settings
- [ ] Fullscreen button toggles fullscreen mode
- [ ] User avatar opens dropdown menu
- [ ] All hover effects work
- [ ] All icons are visible
- [ ] Responsive behavior works on mobile
- [ ] Keyboard navigation works for all buttons
- [ ] No console errors when clicking buttons

---

## Files Modified

1. [Header.tsx](../apps/client/src/components/Header.tsx) - Added `handleViewsClick` handler
2. [DashboardToolbar.tsx](../apps/client/src/components/DashboardToolbar.tsx) - Updated Views button with Icon component
3. [styles.css](../apps/client/src/assets/styles.css) - Added comprehensive dashboard-toolbar styles

---

## Development Server

Access the application at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

Navigate to the Dashboard view to test all toolbar buttons.
