import { useState, useEffect, useCallback } from "react";
import { api } from "@services/api";

export interface SmartCollection {
  id: string;
  name: string;
  description: string;
  count: number;
  tags?: string[];
  query?: string;
}

interface UseSmartCollectionsResult {
  collections: SmartCollection[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Custom hook for fetching smart collection suggestions
 * @param bookmarkId - Optional bookmark ID for context-aware suggestions
 * @param enabled - Whether to automatically fetch (default: true)
 */
export function useSmartCollections(
  bookmarkId?: string,
  enabled = true,
): UseSmartCollectionsResult {
  const [collections, setCollections] = useState<SmartCollection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (bookmarkId) {
        params.set("bookmarkId", bookmarkId);
      }

      const response = await api<{
        success: boolean;
        collections: SmartCollection[];
      }>(`/smart-collections/suggest?${params.toString()}`);

      if (response.success && Array.isArray(response.collections)) {
        setCollections(response.collections);
      } else {
        setCollections([]);
      }
    } catch (err) {
      console.error("Failed to fetch smart collections:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch collections",
      );
      setCollections([]);
    } finally {
      setIsLoading(false);
    }
  }, [bookmarkId, enabled]);

  useEffect(() => {
    if (enabled) {
      fetchCollections();
    }
  }, [enabled, fetchCollections]);

  return {
    collections,
    isLoading,
    error,
    refetch: fetchCollections,
  };
}
