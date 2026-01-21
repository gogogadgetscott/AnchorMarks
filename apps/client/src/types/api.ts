/**
 * AnchorMarks - API Response Types
 * Type definitions for API responses
 */

import type { User, Bookmark, Folder, Tag } from "./index.ts";

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

/**
 * Authentication API responses
 */
export interface LoginResponse {
  csrfToken: string;
  user: User;
}

export interface RegisterResponse {
  csrfToken: string;
  user: User;
}

export interface MeResponse {
  user: User;
  csrfToken: string;
}

export interface RegenerateApiKeyResponse {
  api_key: string;
}

export interface UpdateProfileResponse {
  email: string;
}

/**
 * Bookmark API responses
 */
export interface BookmarkResponse extends Bookmark {}

export interface BookmarksListResponse {
  bookmarks: Bookmark[];
  total?: number;
}

export interface FetchMetadataResponse {
  title?: string;
  description?: string;
  favicon?: string;
}

export interface RefreshFaviconResponse {
  favicon: string;
}

/**
 * Folder API responses
 */
export interface FolderResponse extends Folder {}

export interface FoldersListResponse {
  folders: Folder[];
}

/**
 * Tag API responses
 */
export interface TagResponse extends Tag {}

export interface TagsListResponse {
  tags: Tag[];
}

export interface TagStatsResponse {
  name: string;
  count: number;
  color?: string;
}

/**
 * Dashboard API responses
 */
export interface DashboardViewResponse {
  id: string;
  name: string;
  config: Record<string, unknown>;
}

export interface DashboardViewsListResponse {
  views: DashboardViewResponse[];
}

/**
 * Bookmark View API responses
 */
export interface BookmarkViewResponse {
  id: string;
  name: string;
  config: {
    search_query?: string;
    filter_tags?: string[];
    filter_folder?: string | null;
    sort_order?: string;
    tag_sort?: string;
    tag_mode?: "AND" | "OR";
  };
}

export interface RestoreBookmarkViewResponse {
  config: BookmarkViewResponse["config"];
}

/**
 * Stats API responses
 */
export interface StatsResponse {
  total_bookmarks: number;
  total_folders: number;
  total_tags: number;
  favorite_count: number;
  recent_count: number;
}

/**
 * Quick Search API responses
 */
export interface QuickSearchItem {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  click_count?: number;
}

export interface QuickSearchResponse {
  items: QuickSearchItem[];
}

/**
 * Import/Export API responses
 */
export interface ImportResponse {
  bookmarks_created: number;
  folders_created: number;
}

/**
 * Sync API responses
 */
export interface SyncPushResponse {
  bookmarks_created: number;
  bookmarks_updated: number;
  folders_created: number;
}

export interface SyncPullResponse {
  bookmarks: Bookmark[];
  folders: Folder[];
}

/**
 * Smart Organization API responses
 */
export interface SuggestTagsResponse {
  tags: string[];
}

/**
 * Health/Maintenance API responses
 */
export interface HealthResponse {
  status: "ok" | "error";
  message?: string;
}

export interface DuplicateBookmarksResponse {
  duplicates: Array<{
    url: string;
    bookmarks: Bookmark[];
  }>;
}
