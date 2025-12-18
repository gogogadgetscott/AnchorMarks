export interface User {
    id: string;
    username: string;
    email: string;
    role: string;
    api_key?: string;
    settings?: Record<string, any>;
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
}

export interface Folder {
    id: string;
    name: string;
    parent_id?: string;
    color?: string;
    bookmark_count?: number;
}

export interface Tag {
    id: string;
    name: string;
    color?: string;
    color_override?: string;
    count?: number;
}

export interface DashboardWidget {
    id: string;
    type: 'folder' | 'tag' | 'recent' | 'favorites' | 'stats';
    title: string;
    config: Record<string, any>;
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface FilterConfig {
    sort: string;
    tags: string[];
    tagSort: string;
    tagMode: 'AND' | 'OR';
    search?: string;
    folder?: string | null;
}

export interface TourStep {
    title: string;
    description: string;
    target: string;
    position: 'top' | 'bottom' | 'left' | 'right';
}

export interface Command {
    label: string;
    action: () => void;
}
