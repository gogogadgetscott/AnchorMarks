import { useState, useEffect, useCallback } from "react";
import { api } from "@services/api";

export interface SmartInsightsData {
  total_bookmarks: number;
  total_tags: number;
  top_domains?: Array<{
    domain: string;
    count: number;
    percentage?: number;
  }>;
  top_tags?: Array<{
    tag: string;
    count: number;
  }>;
  recent_activity?: {
    bookmarks_this_week: number;
    bookmarks_this_month: number;
  };
  engagement?: {
    total_clicks: number;
    avg_clicks_per_bookmark?: number;
  };
  suggestions?: {
    create_these_collections?: string[];
    tags_to_cleanup?: string[];
  };
}

interface UseSmartInsightsResult {
  insights: SmartInsightsData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Custom hook for fetching smart insights about bookmarks
 * @param enabled - Whether to automatically fetch (default: true)
 */
export function useSmartInsights(enabled = true): UseSmartInsightsResult {
  const [insights, setInsights] = useState<SmartInsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api<SmartInsightsData>("/smart-insights");

      if (response) {
        setInsights(response);
      } else {
        setInsights(null);
      }
    } catch (err) {
      console.error("Failed to fetch smart insights:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch insights");
      setInsights(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      fetchInsights();
    }
  }, [enabled, fetchInsights]);

  return {
    insights,
    isLoading,
    error,
    refetch: fetchInsights,
  };
}
