/**
 * AnchorMarks - Utils Module
 * Common utility functions
 */

// Escape HTML to prevent XSS
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Extract hostname from URL
export function getHostname(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

// Parse comma-separated tag input
export function parseTagInput(value) {
    if (!value) return [];
    return value.split(',').map(t => t.trim()).filter(Boolean);
}

// Download blob as file
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export default {
    escapeHtml,
    getHostname,
    parseTagInput,
    downloadBlob
};
