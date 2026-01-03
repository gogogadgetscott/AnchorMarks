import { Icon } from "./Icon.ts";

interface ButtonOptions {
  id?: string;
  className?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "icon" | string;
  icon?: string;
  title?: string;
  type?: "button" | "submit" | "reset";
  data?: Record<string, string | number | boolean>;
}

/**
 * Component for rendering buttons.
 * @param {string} text - The button text.
 * @param {object} options - Optional parameters:
 * @param {string} options.id - Button ID.
 * @param {string} options.className - Additional CSS classes.
 * @param {string} options.variant - 'primary', 'secondary', 'danger', 'ghost', 'icon'.
 * @param {string} options.icon - Icon name from Icon component.
 * @param {string} options.title - Tooltip title.
 * @param {string} options.type - 'button', 'submit'.
 * @param {object} options.data - Data attributes.
 * @returns {string} - HTML string of the button.
 */
export function Button(text: string, options: ButtonOptions = {}): string {
  const {
    id = "",
    className = "",
    variant = "primary",
    icon = "",
    title = "",
    type = "button",
    data = {},
  } = options;

  const variantClass = variant === "icon" ? "btn-icon" : `btn btn-${variant}`;
  const idAttr = id ? `id="${id}"` : "";
  const titleAttr = title ? `title="${title}"` : "";

  const dataAttrs = Object.entries(data)
    .map(([key, value]) => `data-${key}="${value}"`)
    .join(" ");

  const iconHtml = icon
    ? Icon(icon, { size: variant === "icon" ? 20 : 16 })
    : "";
  const textHtml = text ? `<span>${text}</span>` : "";

  return `
    <button type="${type}" ${idAttr} class="${variantClass} ${className}" ${titleAttr} ${dataAttrs}>
      ${iconHtml}
      ${textHtml}
    </button>
  `;
}
