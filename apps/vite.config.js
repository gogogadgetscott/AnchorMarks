import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, ".env") });

// Get backend port from environment or default to 3000
const BACKEND_PORT = process.env.PORT || 3000;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// https://vitejs.dev/config/
export default defineConfig({
  root: path.resolve(__dirname, "public"),
  base: "/",
  publicDir: "images", // Relative to root
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "public/index.html"),
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
      "@": path.resolve(__dirname, "public/js"),
      "@modules": path.resolve(__dirname, "public/js/modules"),
      "@styles": path.resolve(__dirname, "public/css"),
    },
  },
});
