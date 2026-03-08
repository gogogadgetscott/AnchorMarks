import "@assets/styles.css";

import React from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "./contexts/AppProviders";
import { App } from "./App";
import { initGlobalErrorHandlers } from "@utils/error-handler.ts";

initGlobalErrorHandlers();

const appRoot = document.getElementById("app");
if (appRoot) {
  createRoot(appRoot).render(
    <React.StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </React.StrictMode>,
  );
}

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
