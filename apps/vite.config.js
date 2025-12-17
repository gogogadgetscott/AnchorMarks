import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    port: 5173,
    strictPort: false,
    // Proxy API requests to Express backend
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
      "/favicons": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
      "/thumbnails": {
        target: "http://localhost:3000",
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
