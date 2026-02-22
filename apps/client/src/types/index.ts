export interface UserSettings {
  theme:
    | "light"
    | "dark"
    | "system"
    | "ocean"
    | "sunset"
    | "midnight"
    | "high-contrast";
  view_mode?: string;
  hide_favicons?: boolean;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  api_key?: string;
  settings?: Record<string, unknown>;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  description?: string;
  favicon?: string;
  tags?: string;
  tags_detailed?: Tag[];
  folder_id?: string;
  is_favorite?: boolean;
  click_count?: number;
  created_at?: string;
  updated_at?: string;
  color?: string;
  is_archived?: number;
  og_image?: string;
  thumbnail_local?: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id?: string;
  color?: string;
  bookmark_count?: number;
  type?: "folder"; // Optional discriminator for drag/drop operations
  created_at?: string;
  updated_at?: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  color_override?: string;
  count?: number;
  type?: "tag"; // Optional discriminator for drag/drop operations
}

export interface DashboardWidget {
  id: string;
  type: "folder" | "tag" | "tag-analytics" | "recent" | "favorites" | "stats";
  title: string;
  config: Record<string, unknown>;
  x: number;
  y: number;
  w: number;
  h: number;
  sort?: "a-z" | "z-a" | "recent" | "most_visited";
  color?: string;
  settings?: TagAnalyticsSettings;
}

export interface FilterConfig {
  sort: string;
  tags: string[];
  tagSort: string;
  tagMode: "AND" | "OR";
  search?: string;
  folder?: string | null;
}

export interface TourStep {
  title: string;
  description: string;
  target: string;
  position: "top" | "bottom" | "left" | "right";
}

export interface Command {
  label: string;
  action: () => void;
  icon?: string;
  category?: "command" | "folder" | "bookmark" | "tag" | "view";
  description?: string;
  url?: string;
  favicon?: string;
}

export interface Collection {
  id: string;
  name: string;
  color?: string;
  position?: number;
  rules?: unknown;
}

export interface TagAnalyticsItem {
  name: string;
  count: number;
  click_count_sum?: number;
  favorite_count_sum?: number;
}

export interface CooccurrenceItem {
  tag_name_a: string;
  tag_name_b: string;
  count: number;
}

export interface TagAnalyticsSettings {
  metric?: string;
  limit?: number;
  pairSort?: string;
  colors?: {
    usage?: string;
    clicks?: string;
    favorites?: string;
    pairs?: string;
  };
}

export interface ConfirmDialogOptions {
  title?: string;
  confirmText?: string;
  destructive?: boolean;
  placeholder?: string;
}

export interface HeaderConfig {
  id: string;
  className: string;
  title?: string;
  countId?: string;
  countSuffix?: string;
  centerContent?: string;
  rightContent?: string;
  showFilterButton?: boolean;
  showViewToggle?: boolean;
  showAddButton?: boolean;
  bulkActions?: ("archive" | "unarchive" | "move" | "tag" | "delete")[];
}

export interface ActiveFilterItem {
  type: "folder" | "tag" | "collection" | "search";
  label: string;
  id: string;
}

export interface SmartTagSuggestion {
  tag: string;
  source: string;
  reason: string;
  score: number;
}

export interface SmartInsights {
  total_bookmarks: number;
  total_tags: number;
  engagement: { total_clicks: number };
  top_domains: Array<{
    domain: string;
    percentage: number;
    count: number;
  }>;
  top_tags: Array<{ tag: string; count: number }>;
  recent_activity?: {
    bookmarks_this_week?: number;
    bookmarks_this_month?: number;
  } | null;
}

export interface DomainStats {
  domain: string;
  count: number;
  bookmarks: Bookmark[];
  bookmark_count?: number;
  recentBookmarks?: number;
  category?: string;
}
