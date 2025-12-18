/**
 * AnchorMarks - Utils Module
 * Common utility functions
 */

// Escape HTML to prevent XSS
export function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Extract hostname from URL
export function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// Extract base URL (origin) from a URL, e.g. https://example.com
export function getBaseUrl(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

// Parse comma-separated tag input
export function parseTagInput(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// Download blob as file
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default {
  escapeHtml,
  getHostname,
  getBaseUrl,
  parseTagInput,
  downloadBlob,
};
