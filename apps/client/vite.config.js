import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

// Get backend port from environment or default to 3000
const BACKEND_PORT = process.env.PORT || 3000;
// Detect if SSL is enabled by checking if SSL_KEY and SSL_CERT are set
const SSL_ENABLED = process.env.SSL_KEY && process.env.SSL_CERT;
const BACKEND_PROTOCOL = SSL_ENABLED ? "https" : "http";
const BACKEND_URL = `${BACKEND_PROTOCOL}://localhost:${BACKEND_PORT}`;

// https://vitejs.dev/config/
export default defineConfig({
  root: __dirname,
  base: "/",
  publicDir: "public",
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
    port: parseInt(process.env.VITE_PORT) || 5173,
    strictPort: false,
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
