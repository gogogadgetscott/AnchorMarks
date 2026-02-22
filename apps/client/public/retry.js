/**
 * Minimal script for offline.html - attaches retry button handler.
 * Kept separate for CSP compliance (no inline handlers).
 */
document.addEventListener("DOMContentLoaded", function () {
  var btn = document.querySelector("[data-action='retry-connection']");
  if (btn) {
    btn.addEventListener("click", function () {
      window.location.reload();
    });
  }
});
