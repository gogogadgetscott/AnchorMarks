/**
 * Component for rendering a skeleton card placeholder.
 * @returns {string} - HTML string of the skeleton card.
 */
export function SkeletonCard(): string {
    return `
    <div class="bookmark-card skeleton-card">
      <div class="bookmark-header">
        <div class="bookmark-favicon">
          <div class="skeleton skeleton-favicon"></div>
        </div>
        <div class="bookmark-info">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-url"></div>
        </div>
      </div>
      <div class="bookmark-tags">
        <div class="skeleton skeleton-tag"></div>
        <div class="skeleton skeleton-tag"></div>
      </div>
      <div class="bookmark-actions" style="opacity: 0.5; pointer-events: none;">
        <div class="skeleton" style="width: 60px; height: 32px; border-radius: 4px;"></div>
        <div class="skeleton" style="width: 60px; height: 32px; border-radius: 4px;"></div>
      </div>
    </div>
  `;
}
