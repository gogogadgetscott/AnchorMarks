export interface UserSettings {
  theme: "system" | "light" | "dark";
  highContrast: boolean;
  // ...add other settings as needed
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  description?: string;
  favicon?: string;
  tags?: string;
  tags_detailed?: Array<{
    name: string;
    color?: string;
    color_override?: string;
  }>;
  folder_id?: string;
  color?: string;
  is_favorite?: boolean;
  is_archived?: boolean | number;
  click_count?: number;
  created_at?: string;
  og_image?: string; // Added for rich card support
  thumbnail_local?: string; // Added for Puppeteer-generated thumbnails
  [key: string]: any;
}

export interface Command {
  label: string;
  action: () => void;
  icon?: string;
  category?: "command" | "folder" | "bookmark" | "tag";
  description?: string;
  url?: string;
  favicon?: string;
}

// Add any other types as needed
