import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

// Get backend port from environment or default to 3000
const BACKEND_PORT = process.env.PORT || 3000;

// Project root directory (one level up from apps/client)
const projectRoot = path.resolve(__dirname, "..", "..");

// Expose app version from root package.json for use in index.html via %VITE_APP_VERSION%
const { version: APP_VERSION } = JSON.parse(
  fs.readFileSync(path.resolve(projectRoot, "package.json"), "utf-8"),
);
process.env.VITE_APP_VERSION = APP_VERSION;

// Detect if SSL is enabled by checking if SSL_KEY and SSL_CERT are set AND files exist
// This matches the Express server fallback behavior in apps/server/index.js
// Resolve relative paths from project root, not from Vite's client directory
const sslKeyPath = process.env.SSL_KEY;
const sslCertPath = process.env.SSL_CERT;

const resolveSslPath = (sslPath) => {
  if (!sslPath) return null;
  // If it's already an absolute path, use it directly
  if (path.isAbsolute(sslPath)) return sslPath;
  // Otherwise resolve relative to project root
  return path.resolve(projectRoot, sslPath);
};

const resolvedKeyPath = resolveSslPath(sslKeyPath);
const resolvedCertPath = resolveSslPath(sslCertPath);

const SSL_ENABLED =
  process.env.SSL_ENABLED === "true" &&
  resolvedKeyPath &&
  resolvedCertPath &&
  fs.existsSync(resolvedKeyPath) &&
  fs.existsSync(resolvedCertPath);

const BACKEND_PROTOCOL = SSL_ENABLED ? "https" : "http";
const BACKEND_URL = `${BACKEND_PROTOCOL}://localhost:${BACKEND_PORT}`;

// Vite plugin to create HTTP → HTTPS redirect server when SSL is enabled
const httpRedirectPlugin = () => ({
  name: "http-to-https-redirect",
  configureServer(server) {
    if (!SSL_ENABLED) return;

    const http = require("http");
    const vitePort = parseInt(process.env.VITE_PORT) || 5173;
    const httpRedirectPort = vitePort - 1; // Use port 5172 for HTTP redirect

    const httpServer = http.createServer((req, res) => {
      const host =
        req.headers.host?.replace(`:${httpRedirectPort}`, `:${vitePort}`) ||
        `localhost:${vitePort}`;
      const redirectUrl = `https://${host}${req.url}`;
      res.writeHead(301, { Location: redirectUrl });
      res.end();
    });

    httpServer
      .listen(httpRedirectPort, () => {
        console.log(
          `\n  ➜  HTTP redirect: http://localhost:${httpRedirectPort}/ → https://localhost:${vitePort}/`,
        );
      })
      .on("error", (err) => {
        if (err.code === "EADDRINUSE" || err.code === "EACCES") {
          console.log(
            `  ℹ️  HTTP redirect port ${httpRedirectPort} not available, skipping`,
          );
        }
      });
  },
});

// Vite plugin to inject APP_VERSION into public/sw.js
const swVersionPlugin = () => ({
  name: "sw-version",
  // Dev: intercept /sw.js requests and replace the version placeholder
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== "/sw.js") return next();
      const src = fs.readFileSync(
        path.resolve(__dirname, "public", "sw.js"),
        "utf-8",
      );
      const processed = src.replace(
        /anchormarks-v[\d.]+/g,
        `anchormarks-v${APP_VERSION}`,
      );
      res.setHeader("Content-Type", "application/javascript");
      res.end(processed);
    });
  },
  // Build: rewrite the copied sw.js in dist after Vite copies public/
  closeBundle() {
    const swDist = path.resolve(__dirname, "dist", "sw.js");
    if (!fs.existsSync(swDist)) return;
    const src = fs.readFileSync(swDist, "utf-8");
    fs.writeFileSync(
      swDist,
      src.replace(/anchormarks-v[\d.]+/g, `anchormarks-v${APP_VERSION}`),
    );
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  root: __dirname,
  base: "/",
  publicDir: "public",
  plugins: [httpRedirectPlugin(), swVersionPlugin()],
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      output: {
        manualChunks: {
          auth: ["src/features/auth/auth.ts"],
          bookmarks: [
            "src/features/bookmarks/bookmarks.ts",
            "src/features/bookmarks/folders.ts",
            "src/features/bookmarks/search.ts",
            "src/features/bookmarks/bulk-ops.ts",
            "src/features/bookmarks/filters.ts",
            "src/features/bookmarks/tag-input.ts",
          ],
          dashboard: ["src/features/bookmarks/dashboard.ts"],
          commands: ["src/features/bookmarks/commands.ts"],
          features: [
            "src/features/keyboard/handler.ts",
            "src/features/ui/navigation.ts",
            "src/features/ui/forms.ts",
            "src/features/ui/omnibar.ts",
            "src/features/ui/interactions.ts",
            "src/features/ui/tags.ts",
            "src/features/ui/confirm-dialog.ts",
            "src/features/maintenance.ts",
          ],
          utils: [
            "src/utils/index.ts",
            "src/utils/logger.ts",
            "src/utils/error-handler.ts",
            "src/utils/event-cleanup.ts",
            "src/utils/keyboard-shortcuts.ts",
          ],
          plugins: [
            "src/features/bookmarks/import-export.ts",
            "src/features/bookmarks/tour.ts",
            "src/features/bookmarks/widget-picker.ts",
            "src/features/bookmarks/smart-organization-ui.ts",
            "src/features/bookmarks/tag-cloud.ts",
          ],
          ui: [
            "src/utils/ui-helpers.ts",
            "src/layouts/loader.ts",
            "src/components/index.ts",
          ],
        },
      },
    },
    // Generate source maps for easier debugging
    sourcemap: true,
    reportCompressedSize: true,
  },
  server: {
    host: "0.0.0.0",
    port: parseInt(process.env.VITE_PORT) || 5173,
    strictPort: true,
    allowedHosts: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",")
          .map((h) => h.replace(/^https?:\/\/|[\/]$/g, "").trim())
          .filter(Boolean)
      : [],
    // Enable HTTPS when SSL certificates are available
    https: SSL_ENABLED
      ? {
          key: fs.readFileSync(resolvedKeyPath),
          cert: fs.readFileSync(resolvedCertPath),
        }
      : false,
    // Proxy API requests to Express backend
    proxy: {
      "/api": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      "/icon.png": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      "/icon-192.png": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      "/icon-512.png": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      "/help.html": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      "/help.js": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      "/help.css": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      "/favicons": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
      "/thumbnails": {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@features": path.resolve(__dirname, "src/features"),
      "@services": path.resolve(__dirname, "src/services"),
      "@utils": path.resolve(__dirname, "src/utils"),
      "@assets": path.resolve(__dirname, "src/assets"),
      "@layouts": path.resolve(__dirname, "src/layouts"),
      "@components": path.resolve(__dirname, "src/components"),
    },
  },
});
