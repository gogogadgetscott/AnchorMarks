/**
 * Component for rendering badges.
 * @param {string|number} content - The badge content.
 * @param {object} options - Optional parameters:
 *   @param {string} options.id - Badge ID.
 *   @param {string} options.className - Additional CSS classes.
 * @returns {string} - HTML string of the badge.
 */
export function Badge(content: string | number, options: { id?: string; className?: string } = {}): string {
    const { id = "", className = "" } = options;
    const idAttr = id ? `id="${id}"` : "";

    return `<span ${idAttr} class="badge ${className}">${content}</span>`;
}
