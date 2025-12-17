# Vite Migration Guide

## Overview

The AnchorMarks frontend has been successfully migrated to use Vite as the build tool. This migration provides:

- ⚡ **Lightning-fast HMR (Hot Module Replacement)** during development
- 📦 **Optimized production builds** with automatic code splitting
- 🔧 **Modern tooling** with native ES modules support
- 🚀 **Improved developer experience** with instant server start

## What Changed

### 1. Build System

**Before:**
- Direct serving of static HTML/CSS/JS files
- Manual dependency management
- No build step

**After:**
- Vite dev server for development (port 5173)
- Production builds to `apps/dist/` directory
- Automatic asset optimization and bundling

### 2. File Structure

```
apps/
├── public/                 # Source files
│   ├── index.html         # Main HTML (2001 lines - working on splitting)
│   ├── js/
│   │   ├── main.js        # ✨ NEW: Entry point that imports CSS & app.js
│   │   ├── app.js         # Main application logic
│   │   └── modules/       # Feature modules (unchanged)
│   ├── css/
│   │   └── styles.css     # All styles
│   ├── src/               # ✨ NEW: Component templates (for future use)
│   │   ├── components/    # Reusable HTML components
│   │   └── templates.js   # Template builder functions
│   └── images/            # Static assets
├── dist/                  # ✨ NEW: Production build output (gitignored)
│   ├── index.html
│   └── assets/
│       ├── main-[hash].js
│       └── main-[hash].css
├── server/                # Backend (unchanged)
└── vite.config.js         # ✨ NEW: Vite configuration
```

### 3. Import Paths

All asset paths now use absolute paths from the public root:

```html
<!-- Before -->
<img src="icon.png" />
<link rel="stylesheet" href="css/styles.css" />
<script src="js/app.js"></script>

<!-- After -->
<img src="/icon.png" />
<!-- CSS imported via JS -->
<script type="module" src="/js/main.js"></script>
```

### 4. Scripts

New npm scripts available:

```bash
# Development
npm run dev:vite          # Start Vite dev server (frontend only)
npm run dev               # Start Express server (backend only)
npm run dev:full          # Start both (requires concurrently)

# Production
npm run build             # Build frontend for production
npm run prod              # Start production server with built assets
npm run preview           # Preview production build locally
```

## Development Workflow

### Option 1: Vite Dev Server (Recommended for Frontend Work)

1. Start the Vite dev server:
   ```bash
   cd apps
   npm run dev:vite
   ```

2. In another terminal, start the Express API server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:5173 in your browser
   - Vite serves the frontend with HMR
   - API requests proxy to Express on port 3000

**Advantages:**
- Instant updates on file changes (HMR)
- Fast refresh without losing application state
- Better error messages

### Option 2: Express Server Only (Traditional)

1. Start the Express server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000 in your browser
   - Express serves files directly from `apps/public/`
   - Manual page refresh required for changes

**Use this when:**
- Testing server-side rendering
- Debugging API issues
- Working on backend-only features

## Production Deployment

### Build Process

1. Build the frontend:
   ```bash
   npm run build
   ```

   This creates optimized assets in `apps/dist/`:
   - Minified and bundled JavaScript
   - Minified CSS with unused code removed
   - Optimized images
   - Cache-busted filenames (e.g., `main-abc123.js`)

2. Set environment variables:
   ```bash
   export JWT_SECRET="your-strong-secret-key"
   export CORS_ORIGIN="https://yourdomain.com"
   export NODE_ENV="production"
   ```

3. Start the production server:
   ```bash
   npm run prod
   ```

   The server automatically detects and serves from `apps/dist/`.

### Docker

Docker builds now include the Vite build step:

```bash
npm run docker:build   # Builds with Vite optimization
npm run docker:up      # Starts production container
```

## Configuration

### Vite Config (`apps/vite.config.js`)

```javascript
export default defineConfig({
  root: path.resolve(__dirname, "public"),
  base: "/",
  build: {
    outDir: path.resolve(__dirname, "dist"),
    sourcemap: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      "/favicons": "http://localhost:3000",
      "/thumbnails": "http://localhost:3000",
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
```

### Express Server Config

The server now serves from different directories based on environment:

```javascript
// Development: serve from public/
// Production: serve from dist/
const staticDir = NODE_ENV === 'production' && fs.existsSync('dist')
  ? path.join(__dirname, '..', 'dist')
  : path.join(__dirname, '..', 'public');
```

## Future Improvements

The migration follows the "30-year pro" philosophy: pragmatic, incremental improvements.

### Phase 1: ✅ Complete
- Vite setup and configuration
- Build pipeline working
- Development and production modes

### Phase 2: Planned
- Split the 2001-line `index.html` into logical components
- Extract reusable HTML templates (auth, modals, headers)
- Create component library for repeated UI elements
- Optimize bundle size with code splitting

### Phase 3: Optional
- TypeScript migration for type safety
- Component framework (Vue/React) if complexity warrants it
- Advanced optimizations (lazy loading, preloading)

## Troubleshooting

### Build Warnings

You may see warnings about dynamic imports during build:

```
(!) module.js is dynamically imported but also statically imported
```

**This is normal** - it's just Vite informing you that it can't split these modules. Not an error.

### Port Already in Use

If port 5173 is taken:
```bash
cd apps
npx vite --port 5174
```

Or update `vite.config.js`:
```javascript
server: {
  port: 5174,
  strictPort: false, // auto-increment if taken
}
```

### Production Build Not Working

1. Check that build completed: `ls apps/dist/`
2. Verify `NODE_ENV=production` is set
3. Check server logs for "Serving frontend from: .../dist"

### CSS Not Loading in Dev

If styles don't load with Vite dev server:
1. Verify `js/main.js` imports: `import "../css/styles.css"`
2. Check browser console for errors
3. Try clearing Vite cache: `rm -rf apps/.vite`

## Migration Checklist for Other Projects

If you're migrating another project to Vite, follow these steps:

- [ ] Install Vite: `npm install --save-dev vite`
- [ ] Create `vite.config.js` with root and build paths
- [ ] Create entry point that imports CSS and main JS
- [ ] Update HTML script tag to new entry point
- [ ] Fix asset paths to use absolute paths from public root
- [ ] Add build scripts to package.json
- [ ] Update server to serve from dist/ in production
- [ ] Add dist/ to .gitignore
- [ ] Test dev server and production build
- [ ] Update documentation

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [Vite Migration Guide](https://vitejs.dev/guide/migration.html)
- [ES Modules in Browser](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)

## Questions?

If you encounter issues or have questions about the Vite setup:

1. Check this guide first
2. Review the Vite documentation
3. Check browser console for errors
4. Open an issue with:
   - Error message
   - Steps to reproduce
   - Expected vs actual behavior
