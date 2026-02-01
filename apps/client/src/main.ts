// Import styles first (Vite will process and inject them)
import "@assets/styles.css";

// Import the component loader
import { loadComponents } from "@layouts/loader.ts";

// Initialize global error handlers before anything else
import { initGlobalErrorHandlers } from "@utils/error-handler.ts";
initGlobalErrorHandlers();

// Initialize components immediately
loadComponents();

// Register Service Worker for offline support and caching
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered:", registration.scope);
      })
      .catch((error) => {
        console.warn("Service Worker registration failed:", error);
      });
  });
}

// Import the main app module which will initialize everything
// Now that components are in the DOM, App.js can find them
import "./App.ts";
