import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "@services/api.ts";

export interface SmartTagSuggestion {
  tag: string;
  score: number;
  source: "domain" | "activity" | "similar";
  reason: string;
}

interface DomainInfo {
  domain: string;
  bookmarkCount?: number;
  bookmark_count?: number;
  category?: string;
}

interface SmartTagsResult {
  suggestions: SmartTagSuggestion[];
  domainInfo?: DomainInfo;
}

interface AITagsResult {
  suggestions: Array<string | { tag: string }>;
}

/**
 * Hook for fetching smart and AI tag suggestions for a URL
 */
export function useSmartTags(url: string, enabled = true) {
  const [smartSuggestions, setSmartSuggestions] = useState<
    SmartTagSuggestion[]
  >([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [domainInfo, setDomainInfo] = useState<DomainInfo | undefined>();
  const [isLoadingSmart, setIsLoadingSmart] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceRef = useRef(0);

  const fetchSuggestions = useCallback(
    async (urlToFetch: string) => {
      if (!urlToFetch || !enabled) {
        setSmartSuggestions([]);
        setAiSuggestions([]);
        setDomainInfo(undefined);
        return;
      }

      const currentSeq = ++sequenceRef.current;
      setError(null);
      setIsLoadingSmart(true);

      try {
        // Fetch smart suggestions
        const smartResponse = await api<SmartTagsResult>(
          `/tags/suggest-smart?url=${encodeURIComponent(urlToFetch)}&limit=8`,
        );

        // Only update if this is still the latest request
        if (currentSeq === sequenceRef.current) {
          setSmartSuggestions(smartResponse.suggestions || []);
          setDomainInfo(smartResponse.domainInfo);
          setIsLoadingSmart(false);

          // Try AI suggestions (optional)
          setIsLoadingAI(true);
          try {
            const aiResponse = await api<AITagsResult>(
              `/tags/suggest-ai?url=${encodeURIComponent(urlToFetch)}&limit=6`,
            );

            if (currentSeq === sequenceRef.current && aiResponse.suggestions) {
              const tags = aiResponse.suggestions.map((s) =>
                typeof s === "string" ? s : s.tag,
              );
              setAiSuggestions(tags);
            }
          } catch (aiErr) {
            // AI suggestions are optional, don't treat as error
            console.debug("AI suggestions not available:", aiErr);
          } finally {
            if (currentSeq === sequenceRef.current) {
              setIsLoadingAI(false);
            }
          }
        }
      } catch (err) {
        if (currentSeq === sequenceRef.current) {
          console.error("Smart tag suggestions failed:", err);
          setError(
            err instanceof Error ? err.message : "Failed to fetch suggestions",
          );
          setSmartSuggestions([]);
          setIsLoadingSmart(false);
          setIsLoadingAI(false);
        }
      }
    },
    [enabled],
  );

  const debouncedFetch = useCallback(
    (urlToFetch: string) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        fetchSuggestions(urlToFetch);
      }, 400);
    },
    [fetchSuggestions],
  );

  useEffect(() => {
    debouncedFetch(url);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [url, debouncedFetch]);

  return {
    smartSuggestions,
    aiSuggestions,
    domainInfo,
    isLoadingSmart,
    isLoadingAI,
    isLoading: isLoadingSmart || isLoadingAI,
    error,
    refetch: () => fetchSuggestions(url),
  };
}
