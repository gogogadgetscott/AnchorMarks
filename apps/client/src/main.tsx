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
const SW_FIX_TOKEN = `${import.meta.env.VITE_APP_VERSION || "dev"}-ctx-fix-1`;

async function resetStaleServiceWorkerCachesOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const resetKey = "anchormarks_sw_fix_token";
  if (localStorage.getItem(resetKey) === SW_FIX_TOKEN) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );

    if ("caches" in window) {
      const keys = await caches.keys();
      const anchormarksKeys = keys.filter((key) =>
        key.startsWith("anchormarks-"),
      );
      await Promise.all(anchormarksKeys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn("Service Worker reset failed:", error);
  } finally {
    localStorage.setItem(resetKey, SW_FIX_TOKEN);
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    resetStaleServiceWorkerCachesOnce()
      .then(() => navigator.serviceWorker.register("/sw.js"))
      .then((registration) => {
        console.log("Service Worker registered:", registration.scope);
      })
      .catch((error) => {
        console.warn("Service Worker registration failed:", error);
      });
  });
}
