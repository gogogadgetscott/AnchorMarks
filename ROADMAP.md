# AnchorMarks Feature Roadmap

## Current State (v1.0)
- ✅ Web application with dark/light mode
- ✅ Bookmark CRUD operations
- ✅ Folder organization
- ✅ Tag-based organization
- ✅ Dashboard view (folder/tag modes)
- ✅ Import/Export (HTML, JSON)
- ✅ Basic search
- ✅ API access with authentication
- ✅ Favorites system

---

## Phase 1: Core Foundations (Priority: HIGH)

### 1.1 Enhanced Import/Export ✅
- [x] Import from browser HTML exports
- [x] Auto-create folders from import structure
- [ ] Import from Raindrop.io JSON
- [ ] Import from Pocket export
- [ ] Import from Pinboard
- [ ] Export to CSV format

### 1.2 Advanced Search
- [x] Full-text search across titles, URLs, descriptions, tags
- [x] Filter by domain (API endpoint: `/api/bookmarks/by-domain`)
- [ ] Filter by date range (UI pending)
- [x] Filter by type (auto-detect: article, video, PDF, tweet)
- [ ] Natural language search (future AI integration)

### 1.3 Health Tools for Library ✅
- [x] Duplicate detection (`GET /api/health/duplicates`)
- [x] Duplicate cleanup (`POST /api/health/duplicates/cleanup`)
- [x] Dead link checker (`GET /api/health/deadlinks?check=true`)
- [ ] Redirect detection
- [ ] Cleanup wizard UI

---

## Phase 2: Organization & Cleanup (Priority: HIGH)

### 2.1 Smart Collections / Saved Filters ✅
- [x] Save filter combinations as "Smart Collections"
- [x] Auto-updating collections based on rules
- [ ] Predefined collections: "Unread", "Recent", "Most Visited"

### 2.2 Better Tagging
- [ ] Tag suggestions based on URL/domain
- [ ] Bulk tagging operations
- [ ] Tag merge/rename
- [ ] Tag hierarchy (nested tags)

### 2.3 Multiple Layout Options ✅
- [x] Grid view
- [x] List view
- [x] Masonry view
- [x] Compact list view
- [x] Visual boards (Pinterest-style)

---

## Phase 3: Intelligence & Recommendations (Priority: MEDIUM)

### 3.1 Auto-Classification ✅
- [x] Auto-detect content type (article, video, PDF, etc.)
- [ ] Auto-suggest tags based on domain patterns
- [x] Domain-based categorization (Board view)

### 3.2 AI Features (Future)
- [ ] AI-generated summaries
- [ ] Smart tag suggestions
- [ ] Related bookmark suggestions
- [ ] Knowledge graph visualization

---

## Phase 4: Reading Experience (Priority: MEDIUM)

### 4.1 Enhanced Previews
- [ ] Rich link previews with images
- [ ] Video thumbnails
- [ ] PDF previews
- [ ] Tweet embeds

### 4.2 Offline & Archival
- [ ] Full-page snapshot saving
- [ ] PDF export of pages
- [ ] Offline access to saved content

---

## Phase 5: Collaboration (Priority: LOW - Future)

### 5.1 Sharing
- [ ] Shareable collection links
- [ ] Public profile pages
- [ ] Embed collections

### 5.2 Teams
- [ ] Shared workspaces
- [ ] Comments and reactions
- [ ] Role-based permissions

---

## Phase 6: Cross-Platform (Priority: MEDIUM - Future)

### 6.1 Browser Extensions
- [ ] Chrome extension
- [ ] Firefox extension
- [ ] Safari extension
- [ ] Edge extension

### 6.2 Mobile Apps
- [ ] Progressive Web App (PWA)
- [ ] iOS app
- [ ] Android app

---

## Implementation Priority for This Session

1. **Health Tools** - Duplicate detection, dead link checker
2. **Advanced Search** - Domain and date filters
3. **Smart Collections** - Saved filters system
4. **Content Type Detection** - Auto-detect article/video/PDF
5. **Masonry Layout** - Additional view option
