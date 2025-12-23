/**
 * AnchorMarks - Tour Module
 * Handles onboarding tour functionality
 */

import * as state from "@features/state.ts";
import { showToast } from "@utils/ui-helpers.ts";

// Save tour completed state to server
async function saveTourCompleted(): Promise<void> {
  try {
    const { saveSettings } = await import("@features/bookmarks/settings.ts");
    await saveSettings({ tour_completed: true });
    state.setTourCompleted(true);
  } catch (err) {
    console.error("Failed to save tour completed state:", err);
  }
}

// Check if welcome tour should be shown
export function checkWelcomeTour(): void {
  if (!state.isInitialLoad) return;

  // Check server-side setting (synced across devices)
  if (state.tourCompleted) return;

  // Also check localStorage for backward compatibility
  const dismissed = localStorage.getItem("anchormarks_tour_dismissed");
  if (dismissed) {
    // Migrate localStorage setting to server
    saveTourCompleted();
    return;
  }

  // Show tour for new users (fewer than 20 bookmarks)
  if (state.bookmarks.length < 20) {
    setTimeout(() => {
      startTour();
    }, 800);
  }

  state.setIsInitialLoad(false);
}

// Start tour
export function startTour(): void {
  if (state.tourState.active) return;

  state.tourState.active = true;
  state.tourState.currentStep = 0;
  showTourStep();
}

// Show current tour step
export function showTourStep(): void {
  const step = state.tourState.steps[state.tourState.currentStep];
  if (!step) return;

  const overlay = document.getElementById("tour-overlay");
  const popover = document.getElementById("tour-popover");
  const titleEl = document.getElementById("tour-title");
  const descEl = document.getElementById("tour-description");
  const nextBtn = document.getElementById("tour-next-btn");

  if (!overlay || !popover) return;

  // Update content
  if (titleEl) titleEl.textContent = step.title;
  if (descEl) descEl.textContent = step.description;

  // Update step indicators
  document.querySelectorAll(".tour-step").forEach((el, i) => {
    el.classList.toggle("active", i === state.tourState.currentStep);
  });

  // Update button text
  const isLastStep =
    state.tourState.currentStep === state.tourState.steps.length - 1;
  if (nextBtn) nextBtn.textContent = isLastStep ? "Got it!" : "Next";

  // Position popover near target element
  const targetEl = document.getElementById(step.target);
  if (targetEl) {
    positionPopover(popover, targetEl, step.position);
    targetEl.classList.add("tour-highlight");
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Show overlay and popover
  overlay.classList.remove("hidden");
  popover.classList.remove("hidden");
}

// Position popover
function positionPopover(
  popover: HTMLElement,
  target: HTMLElement,
  position: string,
): void {
  const rect = target.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const gap = 16;
  let top, left;

  if (position === "bottom") {
    top = rect.bottom + gap;
    left = rect.left + rect.width / 2 - popoverRect.width / 2;
  } else if (position === "top") {
    top = rect.top - popoverRect.height - gap;
    left = rect.left + rect.width / 2 - popoverRect.width / 2;
  } else if (position === "right") {
    top = rect.top + rect.height / 2 - popoverRect.height / 2;
    left = rect.right + gap;
  } else {
    top = rect.top + rect.height / 2 - popoverRect.height / 2;
    left = rect.left - popoverRect.width - gap;
  }

  // Keep within viewport
  const minPadding = 16;
  left = Math.max(
    minPadding,
    Math.min(left, window.innerWidth - popoverRect.width - minPadding),
  );
  top = Math.max(
    minPadding,
    Math.min(top, window.innerHeight - popoverRect.height - minPadding),
  );

  popover.style.left = left + "px";
  popover.style.top = top + "px";
}

// Next tour step
export function nextTourStep(): void {
  // Remove highlight from current target
  const currentStep = state.tourState.steps[state.tourState.currentStep];
  const targetEl = document.getElementById(currentStep?.target);
  if (targetEl) {
    targetEl.classList.remove("tour-highlight");
  }

  state.tourState.currentStep++;

  if (state.tourState.currentStep >= state.tourState.steps.length) {
    endTour();
  } else {
    showTourStep();
  }
}

// End tour
export function endTour(): void {
  const overlay = document.getElementById("tour-overlay");
  const popover = document.getElementById("tour-popover");

  // Remove highlight
  document.querySelectorAll(".tour-highlight").forEach((el) => {
    el.classList.remove("tour-highlight");
  });

  // Hide elements
  if (overlay) overlay.classList.add("hidden");
  if (popover) popover.classList.add("hidden");

  state.tourState.active = false;

  // Save to server (also keeps localStorage for backward compatibility)
  saveTourCompleted();
  localStorage.setItem("anchormarks_tour_dismissed", "true");

  showToast("🎉 Tour complete! Happy bookmarking!");
}

// Skip tour
export function skipTour(): void {
  const overlay = document.getElementById("tour-overlay");
  const popover = document.getElementById("tour-popover");

  // Remove highlight
  document.querySelectorAll(".tour-highlight").forEach((el) => {
    el.classList.remove("tour-highlight");
  });

  // Hide elements
  if (overlay) overlay.classList.add("hidden");
  if (popover) popover.classList.add("hidden");

  state.tourState.active = false;

  // Save to server (also keeps localStorage for backward compatibility)
  saveTourCompleted();
  localStorage.setItem("anchormarks_tour_dismissed", "true");

  showToast("Tour skipped. You can restart it from Settings anytime!");
}

export default {
  checkWelcomeTour,
  startTour,
  showTourStep,
  nextTourStep,
  endTour,
  skipTour,
};
