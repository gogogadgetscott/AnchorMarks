/**
 * AnchorMarks - Tag Input Module
 * Handles tag input with badges and autocomplete
 */

import * as state from "@features/state.js";
import { escapeHtml } from "@utils/index.js";

let selectedTags = [];
let autocompleteIndex = -1;

// Initialize tag input
export function initTagInput() {
  const container = document.getElementById("tags-input-container");
  const input = document.getElementById("bookmark-tags-input");
  const hiddenInput = document.getElementById("bookmark-tags");
  const autocomplete = document.getElementById("tag-autocomplete");

  if (!container || !input || !hiddenInput || !autocomplete) {
    console.warn("Tag input elements not found");
    return;
  }

  // Click on container to focus input
  container.addEventListener("click", () => {
    input.focus();
  });

  // Input event - show autocomplete
  input.addEventListener("input", (e) => {
    const value = e.target.value.trim();
    if (value.length > 0) {
      showAutocomplete(value, autocomplete);
    } else {
      hideAutocomplete(autocomplete);
    }
  });

  // Keyboard navigation
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const activeItem = autocomplete.querySelector(
        ".tag-autocomplete-item.active",
      );
      if (activeItem) {
        const tagName = activeItem.dataset.tag;
        addTag(tagName);
      } else if (input.value.trim()) {
        addTag(input.value.trim());
      }
    } else if (
      e.key === "Backspace" &&
      input.value === "" &&
      selectedTags.length > 0
    ) {
      // Remove last tag on backspace if input is empty
      removeTag(selectedTags[selectedTags.length - 1]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      navigateAutocomplete(1, autocomplete);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      navigateAutocomplete(-1, autocomplete);
    } else if (e.key === "Escape") {
      hideAutocomplete(autocomplete);
    } else if (e.key === "," || e.key === "Tab") {
      e.preventDefault();
      if (input.value.trim()) {
        addTag(input.value.trim());
      }
    }
  });

  // Click outside to close autocomplete
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target) && !autocomplete.contains(e.target)) {
      hideAutocomplete(autocomplete);
    }
  });
}

// Load tags from input value
export function loadTagsFromInput(tagsString) {
  selectedTags = [];
  if (tagsString) {
    const tags = tagsString
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);
    tags.forEach((tag) => addTag(tag, false));
  }
  renderSelectedTags();
}

// Add a tag
function addTag(tagName, updateInput = true) {
  const normalizedTag = tagName.trim();
  if (!normalizedTag || selectedTags.includes(normalizedTag)) {
    return;
  }

  selectedTags.push(normalizedTag);
  renderSelectedTags();

  if (updateInput) {
    const input = document.getElementById("bookmark-tags-input");
    if (input) {
      input.value = "";
      input.focus();
    }
    const autocomplete = document.getElementById("tag-autocomplete");
    if (autocomplete) {
      hideAutocomplete(autocomplete);
    }
  }

  updateHiddenInput();
}

// Remove a tag
function removeTag(tagName) {
  selectedTags = selectedTags.filter((t) => t !== tagName);
  renderSelectedTags();
  updateHiddenInput();
}

// Render selected tags as badges
function renderSelectedTags() {
  const container = document.getElementById("selected-tags");
  if (!container) return;

  container.innerHTML = selectedTags
    .map((tag) => {
      const tagMeta = state.tagMetadata[tag] || {};
      const tagColor = tagMeta.color || "#f59e0b";
      return `
        <span class="selected-tag" style="--tag-color: ${tagColor}">
          <span class="selected-tag-name">${escapeHtml(tag)}</span>
          <button type="button" class="selected-tag-remove" data-tag="${escapeHtml(tag)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 10px; height: 10px;">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </span>
      `;
    })
    .join("");

  // Add remove listeners
  container.querySelectorAll(".selected-tag-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeTag(btn.dataset.tag);
    });
  });
}

// Update hidden input with comma-separated tags
function updateHiddenInput() {
  const hiddenInput = document.getElementById("bookmark-tags");
  if (hiddenInput) {
    hiddenInput.value = selectedTags.join(", ");
  }
}

// Show autocomplete suggestions
function showAutocomplete(searchTerm, autocomplete) {
  if (!autocomplete) return;

  // Get all tags from tagMetadata
  const allTags = Object.keys(state.tagMetadata || {});

  // Filter by search term
  const matches = allTags
    .filter((tag) => {
      return (
        tag.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !selectedTags.includes(tag)
      );
    })
    .slice(0, 10); // Limit to 10 suggestions

  if (matches.length === 0) {
    autocomplete.innerHTML =
      '<div class="tag-autocomplete-empty">No matching tags</div>';
    autocomplete.style.display = "block";
    autocompleteIndex = -1;
    return;
  }

  autocomplete.innerHTML = matches
    .map((tag, index) => {
      const tagMeta = state.tagMetadata[tag];
      return `
        <div class="tag-autocomplete-item ${index === 0 ? "active" : ""}" data-tag="${escapeHtml(tag)}">
          <span class="tag-autocomplete-name">${escapeHtml(tag)}</span>
          <span class="tag-autocomplete-count">${tagMeta.count || 0}</span>
        </div>
      `;
    })
    .join("");

  autocomplete.style.display = "block";
  autocompleteIndex = 0;

  // Add click listeners
  autocomplete.querySelectorAll(".tag-autocomplete-item").forEach((item) => {
    item.addEventListener("click", () => {
      addTag(item.dataset.tag);
    });
  });
}

// Hide autocomplete
function hideAutocomplete(autocomplete) {
  if (autocomplete) {
    autocomplete.style.display = "none";
    autocompleteIndex = -1;
  }
}

// Navigate autocomplete with keyboard
function navigateAutocomplete(direction, autocomplete) {
  const items = autocomplete.querySelectorAll(".tag-autocomplete-item");
  if (items.length === 0) return;

  // Remove active from current
  items.forEach((item) => item.classList.remove("active"));

  // Update index
  autocompleteIndex += direction;
  if (autocompleteIndex < 0) autocompleteIndex = items.length - 1;
  if (autocompleteIndex >= items.length) autocompleteIndex = 0;

  // Add active to new
  items[autocompleteIndex].classList.add("active");

  // Scroll into view
  items[autocompleteIndex].scrollIntoView({ block: "nearest" });
}

export default {
  initTagInput,
  loadTagsFromInput,
};
