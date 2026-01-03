import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// Get backend port from environment or default to 3000
const BACKEND_PORT = process.env.PORT || 3000;

// Project root directory (one level up from apps/client)
const projectRoot = path.resolve(__dirname, "..", "..");

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

// https://vitejs.dev/config/
export default defineConfig({
  root: __dirname,
  base: "/",
  publicDir: "public",
  plugins: [httpRedirectPlugin()],
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
      },
      output: {
        manualChunks: {
          auth: ["src/features/auth/auth.js"],
          bookmarks: [
            "src/features/bookmarks/bookmarks.js",
            "src/features/bookmarks/folders.js",
            "src/features/bookmarks/search.js",
            "src/features/bookmarks/bulk-ops.js",
          ],
          dashboard: ["src/features/bookmarks/dashboard.js"],
          commands: ["src/features/bookmarks/commands.js"],
          extras: [
            "src/features/bookmarks/import-export.js",
            "src/features/bookmarks/tour.js",
            "src/features/bookmarks/widget-picker.js",
          ],
          ui: [
            "src/utils/ui-helpers.js",
            "src/layouts/loader.js",
            "src/components/index.js",
          ],
        },
      },
    },
    // Generate source maps for easier debugging
    sourcemap: true,
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
