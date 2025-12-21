# AnchorMarks API Documentation

Complete API reference for AnchorMarks REST API endpoints.

**Base URL**: `/api`  
**Authentication**: JWT via HTTP-only cookie or API key via `X-API-Key` header  
**Content-Type**: `application/json`  
**CSRF Protection**: Required for state-changing operations (POST/PUT/DELETE) via `X-CSRF-Token` header

---

## Table of Contents

- [Authentication](#authentication)
- [Bookmarks](#bookmarks)
- [Folders](#folders)
- [Tags](#tags)
- [Collections](#collections)
- [Dashboard](#dashboard)
- [Settings](#settings)
- [Sync](#sync)
- [Import/Export](#importexport)
- [Maintenance](#maintenance)
- [Health](#health)

---

## Authentication

### Register

Create a new user account.

**Endpoint**: `POST /api/auth/register`  
**Auth Required**: No  
**CSRF Required**: No

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response** (200 OK):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "api_key": "lv_xxxxxxxxxxxxxxxx"
  },
  "csrfToken": "csrf-token-string"
}
```

**Error Responses**:
- `400` - Missing fields or password too short (< 6 characters)
- `400` - User already exists
- `500` - Server error

---

### Login

Authenticate and receive JWT token.

**Endpoint**: `POST /api/auth/login`  
**Auth Required**: No  
**CSRF Required**: No

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response** (200 OK):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "api_key": "lv_xxxxxxxxxxxxxxxx"
  },
  "csrfToken": "csrf-token-string"
}
```

**Cookies Set**:
- `token` (httpOnly) - JWT authentication token
- `csrfToken` - CSRF protection token

**Error Responses**:
- `400` - Invalid credentials
- `500` - Server error

---

### Get Current User

Get authenticated user information.

**Endpoint**: `GET /api/auth/me`  
**Auth Required**: Yes (JWT or API Key)

**Response** (200 OK):
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "api_key": "lv_xxxxxxxxxxxxxxxx"
  },
  "csrfToken": "csrf-token-string"
}
```

**Error Responses**:
- `401` - Not authenticated

---

### Logout

Invalidate current session.

**Endpoint**: `POST /api/auth/logout`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Response** (200 OK):
```json
{
  "success": true
}
```

---

### Regenerate API Key

Generate a new API key (invalidates old key).

**Endpoint**: `POST /api/auth/regenerate-key`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Response** (200 OK):
```json
{
  "api_key": "lv_new_xxxxxxxxxxxxxxxx"
}
```

---

## Bookmarks

### List Bookmarks

Get paginated list of bookmarks with filtering options.

**Endpoint**: `GET /api/bookmarks`  
**Auth Required**: Yes

**Query Parameters**:
- `folder_id` (string, optional) - Filter by folder ID
- `search` (string, optional) - Search in title/URL/description
- `favorites` (boolean, optional) - Filter favorites only
- `tags` (string, optional) - Comma-separated tag names
- `sort` (string, optional) - Sort order: `recently_added`, `recently_updated`, `title_asc`, `title_desc`, `click_count_desc`
- `limit` (number, optional) - Results per page (default: all)
- `offset` (number, optional) - Pagination offset (default: 0)
- `archived` (boolean, optional) - Include archived bookmarks

**Response** (200 OK):
```json
{
  "bookmarks": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "folder_id": "uuid",
      "title": "Example Bookmark",
      "url": "https://example.com",
      "description": "Bookmark description",
      "favicon": "/favicons/example.com.png",
      "favicon_local": "/favicons/example.com.png",
      "is_favorite": 0,
      "click_count": 5,
      "last_clicked": "2024-01-01T00:00:00.000Z",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z",
      "tags_detailed": [
        {
          "id": "uuid",
          "name": "tag-name",
          "color": "#f59e0b",
          "icon": "tag"
        }
      ]
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

**Error Responses**:
- `401` - Not authenticated
- `500` - Server error

---

### Create Bookmark

Create a new bookmark.

**Endpoint**: `POST /api/bookmarks`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Request Body**:
```json
{
  "url": "https://example.com",
  "title": "Example Bookmark",
  "description": "Optional description",
  "folder_id": "uuid",
  "tags": "tag1,tag2",
  "color": "#6366f1",
  "is_favorite": false
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "folder_id": "uuid",
  "title": "Example Bookmark",
  "url": "https://example.com",
  "description": "Optional description",
  "favicon": "/favicons/example.com.png",
  "is_favorite": 0,
  "click_count": 0,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses**:
- `400` - Invalid URL or missing required fields
- `401` - Not authenticated
- `403` - CSRF token invalid
- `500` - Server error

---

### Update Bookmark

Update an existing bookmark.

**Endpoint**: `PUT /api/bookmarks/:id`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Path Parameters**:
- `id` (string) - Bookmark ID

**Request Body** (all fields optional):
```json
{
  "title": "Updated Title",
  "url": "https://updated.com",
  "description": "Updated description",
  "folder_id": "uuid",
  "tags": "tag1,tag2",
  "is_favorite": true
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "title": "Updated Title",
  "url": "https://updated.com",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses**:
- `400` - Invalid data
- `401` - Not authenticated
- `403` - Not authorized or CSRF token invalid
- `404` - Bookmark not found
- `500` - Server error

---

### Delete Bookmark

Delete a bookmark.

**Endpoint**: `DELETE /api/bookmarks/:id`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Path Parameters**:
- `id` (string) - Bookmark ID

**Response** (200 OK):
```json
{
  "success": true
}
```

**Error Responses**:
- `401` - Not authenticated
- `403` - Not authorized or CSRF token invalid
- `404` - Bookmark not found
- `500` - Server error

---

### Fetch Metadata

Fetch metadata (title, description, favicon) from a URL.

**Endpoint**: `POST /api/bookmarks/fetch-metadata`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Request Body**:
```json
{
  "url": "https://example.com"
}
```

**Response** (200 OK):
```json
{
  "title": "Example Site",
  "description": "Site description",
  "favicon": "https://example.com/favicon.ico"
}
```

**Error Responses**:
- `400` - Invalid URL
- `403` - SSRF protection (private IP blocked in production)
- `500` - Server error

---

### Refresh Favicon

Manually refresh favicon for a bookmark.

**Endpoint**: `POST /api/bookmarks/:id/refresh-favicon`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Path Parameters**:
- `id` (string) - Bookmark ID

**Response** (200 OK):
```json
{
  "favicon": "/favicons/example.com.png"
}
```

---

### Track Click

Increment click count for a bookmark.

**Endpoint**: `POST /api/bookmarks/:id/track-click`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Path Parameters**:
- `id` (string) - Bookmark ID

**Response** (200 OK):
```json
{
  "click_count": 6
}
```

---

## Folders

### List Folders

Get all folders for the authenticated user.

**Endpoint**: `GET /api/folders`  
**Auth Required**: Yes

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "parent_id": null,
    "name": "My Bookmarks",
    "color": "#6366f1",
    "icon": "folder",
    "position": 0,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### Create Folder

Create a new folder.

**Endpoint**: `POST /api/folders`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Request Body**:
```json
{
  "name": "New Folder",
  "color": "#6366f1",
  "icon": "folder",
  "parent_id": "uuid"
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "parent_id": "uuid",
  "name": "New Folder",
  "color": "#6366f1",
  "icon": "folder",
  "position": 0,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

---

### Update Folder

Update folder properties.

**Endpoint**: `PUT /api/folders/:id`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Path Parameters**:
- `id` (string) - Folder ID

**Request Body** (all fields optional):
```json
{
  "name": "Updated Folder",
  "color": "#f59e0b",
  "icon": "bookmark",
  "parent_id": "uuid",
  "position": 1
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "name": "Updated Folder",
  "color": "#f59e0b",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

---

### Delete Folder

Delete a folder (bookmarks are moved to parent or root).

**Endpoint**: `DELETE /api/folders/:id`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Path Parameters**:
- `id` (string) - Folder ID

**Response** (200 OK):
```json
{
  "success": true
}
```

---

## Tags

### List Tags

Get all tags for the authenticated user.

**Endpoint**: `GET /api/tags`  
**Auth Required**: Yes

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "tag-name",
    "color": "#f59e0b",
    "icon": "tag",
    "position": 0,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### Create Tag

Create a new tag.

**Endpoint**: `POST /api/tags`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Request Body**:
```json
{
  "name": "new-tag",
  "color": "#f59e0b",
  "icon": "tag"
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "name": "new-tag",
  "color": "#f59e0b",
  "icon": "tag",
  "position": 0,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

---

### Update Tag

Update tag properties.

**Endpoint**: `PUT /api/tags/:id`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Path Parameters**:
- `id` (string) - Tag ID

**Request Body** (all fields optional):
```json
{
  "name": "updated-tag",
  "color": "#6366f1",
  "icon": "bookmark"
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "name": "updated-tag",
  "color": "#6366f1",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

---

### Delete Tag

Delete a tag (removes from all bookmarks).

**Endpoint**: `DELETE /api/tags/:id`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Path Parameters**:
- `id` (string) - Tag ID

**Response** (200 OK):
```json
{
  "success": true
}
```

---

### Rename Tag

Rename a tag across all bookmarks.

**Endpoint**: `POST /api/tags/rename`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Request Body**:
```json
{
  "from": "old-tag-name",
  "to": "new-tag-name"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "updated_count": 10
}
```

---

## Collections

### List Collections

Get all smart collections.

**Endpoint**: `GET /api/collections`  
**Auth Required**: Yes

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "Development",
    "icon": "filter",
    "color": "#6366f1",
    "filters": {
      "tags": ["dev", "programming"],
      "folder_id": null
    },
    "position": 0,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### Create Collection

Create a new smart collection.

**Endpoint**: `POST /api/collections`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Request Body**:
```json
{
  "name": "Development",
  "icon": "filter",
  "color": "#6366f1",
  "filters": {
    "tags": ["dev", "programming"],
    "folder_id": null
  }
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "name": "Development",
  "filters": {
    "tags": ["dev", "programming"]
  },
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

---

### Update Collection

Update collection properties.

**Endpoint**: `PUT /api/collections/:id`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Path Parameters**:
- `id` (string) - Collection ID

**Request Body** (all fields optional):
```json
{
  "name": "Updated Collection",
  "filters": {
    "tags": ["updated-tag"]
  },
  "position": 1
}
```

---

### Delete Collection

Delete a smart collection.

**Endpoint**: `DELETE /api/collections/:id`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Path Parameters**:
- `id` (string) - Collection ID

**Response** (200 OK):
```json
{
  "success": true
}
```

---

## Dashboard

### List Dashboard Views

Get all saved dashboard views.

**Endpoint**: `GET /api/dashboard/views`  
**Auth Required**: Yes

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "My Dashboard",
    "config": {
      "mode": "folder",
      "tags": [],
      "bookmarkSort": "recently_added"
    },
    "position": 0,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### Create Dashboard View

Create a new dashboard view.

**Endpoint**: `POST /api/dashboard/views`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Request Body**:
```json
{
  "name": "My Dashboard",
  "config": {
    "mode": "folder",
    "tags": [],
    "bookmarkSort": "recently_added"
  }
}
```

---

### Update Dashboard View

Update dashboard view configuration.

**Endpoint**: `PUT /api/dashboard/views/:id`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Path Parameters**:
- `id` (string) - Dashboard view ID

**Request Body**:
```json
{
  "name": "Updated Dashboard",
  "config": {
    "mode": "tags",
    "tags": ["dev"]
  },
  "position": 1
}
```

---

### Delete Dashboard View

Delete a dashboard view.

**Endpoint**: `DELETE /api/dashboard/views/:id`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Path Parameters**:
- `id` (string) - Dashboard view ID

---

## Settings

### Get Settings

Get user settings.

**Endpoint**: `GET /api/settings`  
**Auth Required**: Yes

**Response** (200 OK):
```json
{
  "view_mode": "grid",
  "hide_favicons": false,
  "hide_sidebar": false,
  "ai_suggestions_enabled": true,
  "theme": "dark",
  "dashboard_mode": "folder",
  "dashboard_tags": [],
  "dashboard_sort": "updated_desc",
  "widget_order": {},
  "collapsed_sections": [],
  "include_child_bookmarks": false,
  "current_view": "all",
  "snap_to_grid": true,
  "tour_completed": false
}
```

---

### Update Settings

Update user settings.

**Endpoint**: `PUT /api/settings`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Request Body** (all fields optional):
```json
{
  "view_mode": "list",
  "theme": "light",
  "hide_favicons": true
}
```

**Response** (200 OK):
```json
{
  "success": true
}
```

---

## Sync

### Get Sync Status

Get browser sync status.

**Endpoint**: `GET /api/sync/status`  
**Auth Required**: Yes

**Response** (200 OK):
```json
{
  "last_sync": "2024-01-01T00:00:00.000Z",
  "bookmarks_count": 100,
  "folders_count": 10
}
```

---

### Push Sync Data

Push bookmarks and folders for browser sync.

**Endpoint**: `POST /api/sync/push`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Request Body**:
```json
{
  "bookmarks": [
    {
      "id": "uuid",
      "url": "https://example.com",
      "title": "Example",
      "folder_id": "uuid",
      "tags": "tag1,tag2"
    }
  ],
  "folders": [
    {
      "id": "uuid",
      "name": "Folder",
      "parent_id": null
    }
  ]
}
```

**Response** (200 OK):
```json
{
  "bookmarks_created": 5,
  "bookmarks_updated": 10,
  "folders_created": 2,
  "folders_updated": 3
}
```

---

### Pull Sync Data

Pull all bookmarks and folders for browser sync.

**Endpoint**: `GET /api/sync/pull`  
**Auth Required**: Yes

**Response** (200 OK):
```json
{
  "bookmarks": [
    {
      "id": "uuid",
      "url": "https://example.com",
      "title": "Example",
      "tags_detailed": []
    }
  ],
  "folders": [
    {
      "id": "uuid",
      "name": "Folder",
      "parent_id": null
    }
  ]
}
```

---

## Import/Export

### Export JSON

Export all bookmarks as JSON.

**Endpoint**: `GET /api/export/json`  
**Auth Required**: Yes

**Response** (200 OK):
```json
{
  "bookmarks": [],
  "folders": [],
  "exported_at": "2024-01-01T00:00:00.000Z"
}
```

---

### Export HTML

Export bookmarks as Netscape HTML format.

**Endpoint**: `GET /api/export/html`  
**Auth Required**: Yes

**Response** (200 OK):
Content-Type: `text/html`

---

### Import HTML

Import bookmarks from Netscape HTML format.

**Endpoint**: `POST /api/import/html`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Request Body** (multipart/form-data):
- `file` - HTML file

**Response** (200 OK):
```json
{
  "imported": 50,
  "skipped": 2
}
```

---

## Maintenance

### Find Duplicates

Find duplicate bookmarks.

**Endpoint**: `GET /api/maintenance/duplicates`  
**Auth Required**: Yes

**Response** (200 OK):
```json
{
  "duplicates": [
    {
      "url": "https://example.com",
      "count": 3,
      "bookmark_ids": ["uuid1", "uuid2", "uuid3"]
    }
  ]
}
```

---

### Check Dead Links

Check bookmarks for dead/broken links.

**Endpoint**: `POST /api/maintenance/check-dead-links`  
**Auth Required**: Yes  
**CSRF Required**: Yes

**Request Body**:
```json
{
  "bookmark_ids": ["uuid1", "uuid2"]
}
```

**Response** (200 OK):
```json
{
  "checked": 10,
  "dead": 2,
  "results": [
    {
      "id": "uuid",
      "url": "https://example.com",
      "status": 404
    }
  ]
}
```

---

## Health

### Health Check

Check API health status.

**Endpoint**: `GET /api/health`  
**Auth Required**: No

**Response** (200 OK):
```json
{
  "status": "ok",
  "version": "1.0.0",
  "environment": "production",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Error Responses

All endpoints may return the following error responses:

- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Authentication required or invalid
- `403 Forbidden` - CSRF token invalid or insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

Error response format:
```json
{
  "error": "Error message description"
}
```

---

## Authentication Methods

### JWT Authentication (Web UI)

1. Login via `POST /api/auth/login`
2. Server sets `token` cookie (httpOnly)
3. Include `X-CSRF-Token` header for state-changing requests
4. Cookie is automatically sent with requests

### API Key Authentication (Programmatic Access)

1. Include `X-API-Key` header with API key value
2. API keys are read-only by default (whitelisted endpoints only)
3. No CSRF token required for API key requests

**Example**:
```bash
curl -H "X-API-Key: lv_xxxxxxxxxxxxxxxx" \
  https://your-instance.com/api/bookmarks
```

---

## Rate Limiting

- Rate limit: 100 requests per minute per IP address
- Only enforced in production environment
- Returns `429 Too Many Requests` when exceeded

---

## CSRF Protection

- Required for: `POST`, `PUT`, `DELETE`, `PATCH` requests
- Not required for: `GET`, `HEAD`, `OPTIONS` requests
- Token obtained from login/register response
- Include in `X-CSRF-Token` header
- API key authentication bypasses CSRF checks

---

## User Isolation

All endpoints automatically filter data by the authenticated user's `user_id`. Users cannot access or modify data belonging to other users.

---

## SSRF Protection

- Favicon and metadata fetching endpoints check for private IP addresses
- In production, private IPs (10.x.x.x, 192.168.x.x, 127.x.x.x) are blocked
- Returns `403 Forbidden` for blocked URLs

