# Accessibility Implementation Guide

## Overview

AnchorMarks implements WCAG 2.1 Level AA accessibility standards through comprehensive ARIA attributes, keyboard navigation, and focus management. This document describes the accessibility features and testing guidelines.

## Implemented Features

### 1. ARIA Landmarks & Roles

#### Header Component

- **Role**: `banner` - Identifies main header
- **ARIA Label**: Added to all icon-only buttons (e.g., "Toggle sidebar", "Open filters")
- **ARIA Expanded**: Toggle sidebar button indicates sidebar visibility state
- **ARIA Haspopup**: Filter button indicates dropdown menu

```typescript
<header class="content-header" role="banner">
  <button aria-label="Toggle sidebar" aria-expanded="false">...</button>
  <button aria-label="Open filters" aria-haspopup="true">...</button>
</header>
```

#### Omnibar (Search Component)

- **Role**: `combobox` - Search input with autocomplete
- **Role**: `listbox` - Dropdown suggestions panel
- **ARIA Label**: "Search bookmarks or enter commands"
- **ARIA Autocomplete**: `list` - Indicates dropdown suggestions
- **ARIA Expanded**: Dynamically updated (`true` when open, `false` when closed)
- **ARIA Controls**: Links input to dropdown panel (`omnibar-panel`)

```typescript
<input
  role="combobox"
  aria-label="Search bookmarks or enter commands"
  aria-autocomplete="list"
  aria-expanded="false"
  aria-controls="omnibar-panel"
/>
<div id="omnibar-panel" role="listbox" aria-label="Search suggestions and quick actions">
```

#### Modal Dialogs

- **Role**: `dialog` - Semantic modal container
- **ARIA Modal**: `true` - Indicates modal behavior (traps focus)
- **ARIA Labelledby**: Links to modal title for context
- **Focus Trap**: Automatic keyboard focus management

```typescript
<div
  class="modal"
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title-id"
>
```

### 2. Keyboard Navigation

#### Global Shortcuts

- **Ctrl+K / Cmd+K**: Open omnibar search
- **Escape**: Close modals, omnibar, dropdowns
- **Tab / Shift+Tab**: Navigate focusable elements
- **Enter / Space**: Activate buttons and links

#### Focus Trap System

Location: `apps/client/src/utils/focus-trap.ts`

**Features**:

- Traps keyboard focus within modals
- Tab wraps from last to first element
- Shift+Tab wraps from first to last element
- Escape key closes modal (if onEscape provided)
- Returns focus to trigger element on close

**Usage**:

```typescript
import { createFocusTrap, removeFocusTrap } from "@utils/focus-trap.ts";

// Create trap
const trap = createFocusTrap("modal-id", {
  initialFocus: true,
  onEscape: () => closeModal(),
  returnFocusElement: triggerButton,
});

// Remove trap
removeFocusTrap("modal-id");
```

#### Omnibar Navigation

- **Arrow Up/Down**: Navigate suggestions
- **Enter**: Select active suggestion
- **Escape**: Close omnibar
- **Tab**: Move to next suggestion

### 3. Focus Management

#### Auto-Focus Patterns

1. **Modal Opens**: First focusable element receives focus
2. **Modal Closes**: Focus returns to trigger button
3. **Omnibar Opens**: Search input receives focus
4. **Dropdown Opens**: First option receives visual highlight

#### Visual Focus Indicators

- All interactive elements have visible `:focus` styles
- Keyboard focus distinct from mouse hover
- High contrast focus rings for visibility

### 4. Screen Reader Support

#### Semantic HTML

- Proper heading hierarchy (`h1` → `h2` → `h3`)
- Lists use `<ul>` / `<ol>` elements
- Buttons use `<button>` (not `<div>` with click handlers)
- Links use `<a href>` for navigation

#### Dynamic Content Announcements

- Modal title announced when opened
- Search results count announced
- Error messages announced with `aria-live` regions
- Loading states indicated with `aria-busy`

#### Alternative Text

- Icon-only buttons have `aria-label`
- Images have descriptive `alt` text
- Favicon fallbacks maintain accessibility

## Testing Guidelines

### Keyboard-Only Testing

1. **Tab Navigation**

   ```
   ✓ Can reach all interactive elements
   ✓ Focus order matches visual order
   ✓ No keyboard traps (except modals)
   ✓ Skip links work correctly
   ```

2. **Modal Dialogs**

   ```
   ✓ Opens with Ctrl+K or button click
   ✓ Focus trapped within modal
   ✓ Tab wraps at boundaries
   ✓ Escape closes modal
   ✓ Focus returns to trigger
   ```

3. **Omnibar Search**
   ```
   ✓ Arrow keys navigate suggestions
   ✓ Enter selects suggestion
   ✓ Escape closes omnibar
   ✓ Tab moves to next UI element
   ```

### Screen Reader Testing

#### NVDA (Windows)

```bash
# Test with NVDA + Firefox
1. Launch NVDA
2. Open AnchorMarks in Firefox
3. Navigate with Tab and Arrow keys
4. Verify announcements for:
   - Page structure (headings, landmarks)
   - Interactive elements (buttons, links)
   - Modal dialogs
   - Form fields
   - Error messages
```

#### VoiceOver (macOS)

```bash
# Test with VoiceOver + Safari
1. Cmd+F5 to enable VoiceOver
2. Ctrl+Alt+A to start reading
3. Ctrl+Alt+Arrow to navigate
4. Verify:
   - Rotor navigation (Ctrl+Alt+U)
   - Form controls announced
   - Modal behavior
   - Link descriptions
```

#### JAWS (Windows)

```bash
# Test with JAWS + Chrome
1. Launch JAWS
2. Open AnchorMarks in Chrome
3. Use virtual cursor mode
4. Test:
   - Heading navigation (H key)
   - Link list (Insert+F7)
   - Form fields (F key)
   - Button list (B key)
```

### Automated Testing Tools

#### axe DevTools

```javascript
// In browser console
axe
  .run(document, {
    rules: {
      "color-contrast": { enabled: true },
      "button-name": { enabled: true },
      "aria-required-attr": { enabled: true },
    },
  })
  .then((results) => {
    console.log("Violations:", results.violations);
    console.log("Passes:", results.passes.length);
  });
```

#### Lighthouse Audit

```bash
# Run Lighthouse accessibility audit
npm install -g @lhci/cli
lhci autorun --collect.url=http://localhost:3000
```

#### Pa11y

```bash
# Automated accessibility testing
npm install -g pa11y
pa11y http://localhost:3000 --standard WCAG2AA
```

### Manual Inspection Checklist

#### Visual Elements

- [ ] Color contrast ratio ≥ 4.5:1 for text
- [ ] Color contrast ratio ≥ 3:1 for UI components
- [ ] Focus indicators visible on all elements
- [ ] No information conveyed by color alone

#### Interactive Elements

- [ ] All buttons have accessible names
- [ ] Form inputs have associated labels
- [ ] Error messages clearly associated with fields
- [ ] Loading states indicated

#### Navigation

- [ ] Logical tab order
- [ ] Skip navigation available
- [ ] Breadcrumbs accessible
- [ ] No keyboard traps

#### Dynamic Content

- [ ] ARIA live regions for updates
- [ ] Modal focus trapped
- [ ] Dropdown keyboard accessible
- [ ] Infinite scroll announced

## Common Issues & Solutions

### Issue: Focus Lost After Action

**Solution**: Store reference to trigger element, restore focus after async operations

```typescript
const triggerButton = document.activeElement as HTMLElement;
await performAction();
triggerButton?.focus();
```

### Issue: Screen Reader Announces Too Much

**Solution**: Use `aria-hidden="true"` for decorative elements

```typescript
<span aria-hidden="true">${Icon('decorative')}</span>
<span class="sr-only">Descriptive text</span>
```

### Issue: Dynamic Content Not Announced

**Solution**: Add ARIA live region

```typescript
<div role="status" aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

### Issue: Modal Background Still Focusable

**Solution**: Add `inert` attribute to main content when modal open

```typescript
function openModal(id: string): void {
  document.getElementById("main-content")?.setAttribute("inert", "");
  // ... open modal
}
```

## Browser Compatibility

| Browser | Version | ARIA Support | Focus Trap | Notes          |
| ------- | ------- | ------------ | ---------- | -------------- |
| Chrome  | 90+     | ✅ Full      | ✅ Yes     | Recommended    |
| Firefox | 88+     | ✅ Full      | ✅ Yes     | Excellent      |
| Safari  | 14+     | ✅ Full      | ✅ Yes     | Good           |
| Edge    | 90+     | ✅ Full      | ✅ Yes     | Chromium-based |

## Resources

### Standards

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

### Testing Tools

- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Pa11y](https://pa11y.org/)

### Screen Readers

- [NVDA (Free, Windows)](https://www.nvaccess.org/)
- [JAWS (Commercial, Windows)](https://www.freedomscientific.com/products/software/jaws/)
- [VoiceOver (Built-in, macOS/iOS)](https://www.apple.com/accessibility/voiceover/)
- [TalkBack (Built-in, Android)](https://support.google.com/accessibility/android/answer/6283677)

## Future Enhancements

### Planned Improvements

1. **High Contrast Mode**: Dedicated high contrast theme
2. **Reduced Motion**: Respect `prefers-reduced-motion` media query
3. **Font Scaling**: Support for browser font size adjustments
4. **Touch Targets**: Ensure 44x44px minimum size (mobile)
5. **Voice Commands**: Speech recognition for search
6. **ARIA Live Announcements**: More dynamic content updates

### Nice-to-Have

- Skip to search functionality
- Landmark navigation shortcuts
- Customizable keyboard shortcuts
- Screen reader verbosity settings
- Focus debugging mode (development)

## Changelog

### v1.1.0 (Current)

- ✅ Added ARIA roles to Header, Omnibar, Modals
- ✅ Implemented focus trap system
- ✅ Added keyboard navigation to omnibar
- ✅ aria-expanded management for dropdowns
- ✅ aria-labelledby for modal dialogs
- ✅ Comprehensive testing documentation

### Future Versions

- [ ] ARIA live regions for toast notifications
- [ ] Screen reader mode toggle
- [ ] Keyboard shortcut customization
- [ ] Touch gesture support
