/**
 * AnchorMarks - Auth Module
 * Handles authentication (login, register, logout, checkAuth)
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import { showToast, closeModals } from "@utils/ui-helpers.ts";
import {
  handleApiError,
  hideServerStatusBanner,
} from "@utils/error-handler.ts";
import { logger } from "@utils/logger.ts";
import type { User } from "@types";

// Auth form HTML templates
const LOGIN_FORM_HTML = `
  <form id="login-form" class="auth-form" method="post" autocomplete="on">
    <div class="form-group">
      <label for="login-email">Email</label>
      <input
        type="email"
        id="login-email"
        name="email"
        required
        placeholder="you@example.com"
        autocomplete="email"
      />
    </div>
    <div class="form-group">
      <label for="login-password">Password</label>
      <input
        type="password"
        id="login-password"
        name="password"
        required
        placeholder="••••••••"
        autocomplete="current-password"
      />
    </div>
    <button type="submit" class="btn btn-primary btn-full">
      <span>Sign In</span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </button>
  </form>
`;

const REGISTER_FORM_HTML = `
  <form id="register-form" class="auth-form hidden" method="post" autocomplete="on">
    <div class="form-group">
      <label for="register-email">Email</label>
      <input
        type="email"
        id="register-email"
        name="email"
        required
        placeholder="you@example.com"
        autocomplete="email"
      />
    </div>
    <div class="form-group">
      <label for="register-password">Password</label>
      <input
        type="password"
        id="register-password"
        name="password"
        required
        placeholder="••••••••"
        minlength="6"
        autocomplete="new-password"
      />
    </div>
    <button type="submit" class="btn btn-primary btn-full">
      <span>Create Account</span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </button>
  </form>
`;

// Show auth screen
export function showAuthScreen(): void {
  closeModals();
  const authScreen = document.getElementById("auth-screen");
  const mainApp = document.getElementById("main-app");

  if (authScreen) {
    authScreen.classList.remove("hidden");

    // Inject forms dynamically only when showing auth screen
    const formsContainer = document.getElementById("auth-forms-container");
    if (formsContainer && !document.getElementById("login-form")) {
      formsContainer.innerHTML = LOGIN_FORM_HTML + REGISTER_FORM_HTML;

      // Re-attach form listeners after injecting new forms
      import("@features/ui/forms.ts").then(({ initFormListeners }) => {
        initFormListeners();
      });
    }
  }
  if (mainApp) mainApp.classList.add("hidden");
}

// Show main app
export function showMainApp(): void {
  const authScreen = document.getElementById("auth-screen");
  const mainApp = document.getElementById("main-app");
  if (authScreen) {
    authScreen.classList.add("hidden");

    // Remove forms completely when hiding auth screen to prevent password manager detection
    const formsContainer = document.getElementById("auth-forms-container");
    if (formsContainer) {
      formsContainer.innerHTML = "";
    }
  }
  if (mainApp) mainApp.classList.remove("hidden");
}

// Login
export async function login(email: string, password: string): Promise<boolean> {
  try {
    const data = await api<{
      csrfToken: string;
      user: User;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    state.setCsrfToken(data.csrfToken);
    state.setCurrentUser(data.user);
    state.setIsAuthenticated(true);
    // Refresh header/profile display immediately after login
    updateUserInfo();
    showMainApp();
    showToast("Welcome back!", "success");
    return true;
  } catch (err) {
    logger.error("Login failed", err);
    const errorMessage = handleApiError(err, true);
    showToast(errorMessage, "error");
    return false;
  }
}

// Register
export async function register(
  email: string,
  password: string,
): Promise<boolean> {
  try {
    const data = await api<{
      csrfToken: string;
      user: User;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    state.setCsrfToken(data.csrfToken);
    state.setCurrentUser(data.user);
    state.setIsAuthenticated(true);
    showMainApp();
    showToast("Account created successfully!", "success");
    return true;
  } catch (err) {
    logger.error("Register failed", err);
    const errorMessage = handleApiError(err, true);
    showToast(errorMessage, "error");
    return false;
  }
}

// Logout
export function logout(): void {
  api("/auth/logout", { method: "POST" })
    .catch((err) => {
      // Log logout errors but don't block logout process
      logger.error("Logout failed", err);
    })
    .finally(() => {
      state.setCsrfToken(null);
      state.setCurrentUser(null);
      state.setIsAuthenticated(false);
      showAuthScreen();
    });
}

// Check authentication status
export async function checkAuth(): Promise<boolean> {
  try {
    const data = await api<{
      user: User;
      csrfToken: string;
    }>("/auth/me");
    state.setCurrentUser(data.user);
    state.setCsrfToken(data.csrfToken);
    state.setIsAuthenticated(true);
    // Clear any previous error banner
    hideServerStatusBanner();
    return true;
  } catch (err) {
    logger.error("Auth check failed", err);
    state.setCsrfToken(null);
    state.setCurrentUser(null);
    state.setIsAuthenticated(false);
    showAuthScreen();

    // Handle server/connection errors
    handleApiError(err, true);

    return false;
  }
}

// Update user info display
export function updateUserInfo(): void {
  if (state.currentUser) {
    const userNames = document.querySelectorAll(".header-user-name");
    const userAvatars = document.querySelectorAll(".header-user-avatar");
    const userAvatarsLarge = document.querySelectorAll(
      ".header-user-avatar-large",
    );
    const apiKeyValue = document.getElementById("api-key-value");

    // Use username if available, otherwise fall back to email
    const displayName =
      state.currentUser.username || state.currentUser.email || "User";
    const initials = displayName.charAt(0).toUpperCase();

    userNames.forEach((el) => (el.textContent = displayName));
    userAvatars.forEach((el) => (el.textContent = initials));
    userAvatarsLarge.forEach((el) => (el.textContent = initials));
    if (apiKeyValue) apiKeyValue.textContent = state.currentUser.api_key || "";
  }
}

// Regenerate API key
export async function regenerateApiKey(): Promise<void> {
  if (!confirm("Regenerate API key? Old keys will stop working.")) return;

  try {
    const data = await api<{ api_key: string }>("/auth/regenerate-key", {
      method: "POST",
    });
    if (state.currentUser) {
      state.currentUser.api_key = data.api_key;
    }
    const apiKeyValue = document.getElementById("api-key-value");
    if (apiKeyValue) apiKeyValue.textContent = data.api_key;
    showToast("API key regenerated!", "success");
  } catch (err) {
    logger.error("Regenerate API key failed", err);
    const errorMessage = handleApiError(err, false);
    showToast(errorMessage, "error");
  }
}

// Copy API key
export function copyApiKey(): void {
  if (!state.currentUser?.api_key) return;
  navigator.clipboard.writeText(state.currentUser.api_key);
  showToast("API key copied!", "success");
}

// Update profile (email)
export async function updateProfile(email: string): Promise<boolean> {
  try {
    const data = await api<{ email: string }>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify({ email }),
    });
    if (state.currentUser) state.currentUser.email = data.email;
    updateUserInfo();
    showToast("Profile updated!", "success");
    return true;
  } catch (err) {
    logger.error("Update profile failed", err);
    const errorMessage = handleApiError(err, false);
    showToast(errorMessage, "error");
    return false;
  }
}

// Update password
export async function updatePassword(
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  try {
    await api("/auth/password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    showToast("Password updated successfully!", "success");
    return true;
  } catch (err) {
    logger.error("Update password failed", err);
    const errorMessage = handleApiError(err, false);
    showToast(errorMessage, "error");
    return false;
  }
}

export default {
  showAuthScreen,
  showMainApp,
  login,
  register,
  logout,
  checkAuth,
  updateUserInfo,
  regenerateApiKey,
  copyApiKey,
  updateProfile,
  updatePassword,
};
