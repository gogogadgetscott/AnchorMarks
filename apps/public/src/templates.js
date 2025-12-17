/**
 * HTML Template Loader for Vite Migration
 * 
 * Professional approach: Instead of rewriting the entire 2001-line HTML file,
 * we keep the structure but load it dynamically. This allows:
 * - Vite's fast HMR during development
 * - Code splitting and optimization in production
 * - Easier maintenance of complex UI sections
 * - Backward compatibility with existing JS modules
 */

// Import the full HTML structure as a string (Vite can handle this with ?raw)
// For now, we'll build it programmatically

/**
 * Initialize the application HTML structure
 * Called once on page load before app.js initializes
 */
export function initializeHTML() {
  const app = document.getElementById('app');
  if (!app) {
    console.error('App root element not found');
    return;
  }

  // Build and inject the complete app structure
  app.innerHTML = buildCompleteAppStructure();
}

/**
 * Build the complete app structure
 * This includes auth screen, main app, and all modals
 */
function buildCompleteAppStructure() {
  // For the initial Vite migration, we load from the existing HTML
  // In the future, this can be split into smaller template functions
  
  return `
    <!-- Auth Screen -->
    <div id="auth-screen" class="auth-screen">
      ${buildAuthScreen()}
    </div>

    <!-- Main App -->
    <div id="main-app" class="main-app hidden">
      ${buildMainAppStructure()}
    </div>
  `;
}

/**
 * Auth Screen Component
 */
function buildAuthScreen() {
  return `
    <div class="auth-container">
      <div id="server-status-banner" class="status-banner error hidden">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span id="server-status-message">Server Unavailable</span>
      </div>
      
      <div class="auth-header">
        <div class="logo">
          <div class="logo-icon">
            <img src="/icon.png" alt="AnchorMarks Logo" />
          </div>
          <span class="logo-text">AnchorMarks</span>
        </div>
        <p class="auth-subtitle">Your bookmarks, beautifully organized</p>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">Login</button>
        <button class="auth-tab" data-tab="register">Register</button>
      </div>

      <form id="login-form" class="auth-form">
        <div class="form-group">
          <label for="login-email">Email</label>
          <input type="email" id="login-email" required placeholder="you@example.com" autocomplete="username" />
        </div>
        <div class="form-group">
          <label for="login-password">Password</label>
          <input type="password" id="login-password" required placeholder="••••••••" autocomplete="current-password" />
        </div>
        <button type="submit" class="btn btn-primary btn-full">
          <span>Sign In</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>

      <form id="register-form" class="auth-form hidden">
        <div class="form-group">
          <label for="register-email">Email</label>
          <input type="email" id="register-email" required placeholder="you@example.com" autocomplete="username" />
        </div>
        <div class="form-group">
          <label for="register-password">Password</label>
          <input type="password" id="register-password" required placeholder="••••••••" minlength="6" autocomplete="new-password" />
        </div>
        <button type="submit" class="btn btn-primary btn-full">
          <span>Create Account</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </form>

      <div class="auth-features">
        <div class="feature">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Secure & Private</span>
        </div>
        <div class="feature">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          <span>Browser Sync</span>
        </div>
        <div class="feature">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
          <span>API Access</span>
        </div>
      </div>
    </div>

    <div class="auth-bg">
      <div class="bg-gradient"></div>
      <div class="bg-pattern"></div>
    </div>
  `;
}

/**
 * Main App Structure
 * For the initial migration, we use a placeholder
 * The actual content will be loaded from the existing index.html
 */
function buildMainAppStructure() {
  // This is a placeholder - in practice, for a 30-year pro doing this migration,
  // you'd either:
  // 1. Import the HTML as a string from a separate file
  // 2. Fetch it dynamically
  // 3. Keep it in the main index.html initially
  
  // For now, we'll return a marker that tells our app to load from elsewhere
  return `<div data-load-main-app="true"></div>`;
}
