/**
 * AnchorMarks - Auth Module
 * Handles authentication (login, register, logout, checkAuth)
 */

import * as state from "@features/state.js";
import { api } from "@services/api.js";
import { showToast, closeModals } from "@utils/ui-helpers.js";

// Show auth screen
export function showAuthScreen() {
  closeModals();
  const authScreen = document.getElementById("auth-screen");
  const mainApp = document.getElementById("main-app");
  if (authScreen) authScreen.classList.remove("hidden");
  if (mainApp) mainApp.classList.add("hidden");
}

// Show main app
export function showMainApp() {
  const authScreen = document.getElementById("auth-screen");
  const mainApp = document.getElementById("main-app");
  if (authScreen) authScreen.classList.add("hidden");
  if (mainApp) mainApp.classList.remove("hidden");
}

// Login
export async function login(email, password) {
  try {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    state.setCsrfToken(data.csrfToken);
    state.setCurrentUser(data.user);
    state.setIsAuthenticated(true);
    showMainApp();
    showToast("Welcome back!", "success");
    return true;
  } catch (err) {
    showToast(err.message, "error");

    // Show server status banner for network errors
    if (
      err.message.includes("Failed to fetch") ||
      err.message.includes("NetworkError") ||
      err.message.includes("Unexpected token") ||
      err.message.match(/5\d\d/)
    ) {
      const banner = document.getElementById("server-status-banner");
      const message = document.getElementById("server-status-message");
      if (banner) {
        banner.classList.remove("hidden");
        if (message)
          message.textContent =
            "Server is unreachable. Please check your connection.";
      }
    }

    return false;
  }
}

// Register
export async function register(email, password) {
  try {
    const data = await api("/auth/register", {
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
    showToast(err.message, "error");

    // Show server status banner for network errors
    if (
      err.message.includes("Failed to fetch") ||
      err.message.includes("NetworkError") ||
      err.message.includes("Unexpected token") ||
      err.message.match(/5\d\d/)
    ) {
      const banner = document.getElementById("server-status-banner");
      const message = document.getElementById("server-status-message");
      if (banner) {
        banner.classList.remove("hidden");
        if (message)
          message.textContent =
            "Server is unreachable. Please check your connection.";
      }
    }

    return false;
  }
}

// Logout
export function logout() {
  api("/auth/logout", { method: "POST" })
    .catch(() => {})
    .finally(() => {
      state.setCsrfToken(null);
      state.setCurrentUser(null);
      state.setIsAuthenticated(false);
      showAuthScreen();
    });
}

// Check authentication status
export async function checkAuth() {
  try {
    const data = await api("/auth/me");
    state.setCurrentUser(data.user);
    state.setCsrfToken(data.csrfToken);
    state.setIsAuthenticated(true);
    // Clear any previous error banner
    const banner = document.getElementById("server-status-banner");
    if (banner) banner.classList.add("hidden");
    return true;
  } catch (err) {
    console.error("Auth check failed:", err.message);
    state.setCsrfToken(null);
    state.setCurrentUser(null);
    state.setIsAuthenticated(false);
    showAuthScreen();

    // Check for server/connection errors
    const banner = document.getElementById("server-status-banner");
    const message = document.getElementById("server-status-message");

    let isServerError = false;
    let errorMsg = "Server Unavailable";

    // Network error (fetch failed) or JSON parse error (likely HTML error page like Nginx 502)
    if (
      err.message.includes("Failed to fetch") ||
      err.message.includes("NetworkError") ||
      err.message.includes("Unexpected token") ||
      err.message.includes("JSON")
    ) {
      isServerError = true;
      errorMsg = "Server is unreachable. Please check your connection.";
    }
    // Explicit 5xx errors if returned as JSON
    else if (err.message.match(/5\d\d/) || err.message === "API Error") {
      isServerError = true;
      errorMsg = "Server error. Please try again later.";
    }

    if (banner) {
      if (isServerError) {
        banner.classList.remove("hidden");
        if (message) message.textContent = errorMsg;
      } else {
        banner.classList.add("hidden");
      }
    }

    return false;
  }
}

// Update user info display
export function updateUserInfo() {
  if (state.currentUser) {
    const userName = document.getElementById("user-name");
    const userAvatar = document.getElementById("user-avatar");
    const apiKeyValue = document.getElementById("api-key-value");

    if (userName) userName.textContent = state.currentUser.email;
    if (userAvatar)
      userAvatar.textContent = state.currentUser.email.charAt(0).toUpperCase();
    if (apiKeyValue) apiKeyValue.textContent = state.currentUser.api_key;
  }
}

// Regenerate API key
export async function regenerateApiKey() {
  if (!confirm("Regenerate API key? Old keys will stop working.")) return;

  try {
    const data = await api("/auth/regenerate-key", { method: "POST" });
    if (state.currentUser) {
      state.currentUser.api_key = data.api_key;
    }
    document.getElementById("api-key-value").textContent = data.api_key;
    showToast("API key regenerated!", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Copy API key
export function copyApiKey() {
  if (!state.currentUser?.api_key) return;
  navigator.clipboard.writeText(state.currentUser.api_key);
  showToast("API key copied!", "success");
}

// Update profile (email)
export async function updateProfile(email) {
  try {
    const data = await api("/auth/profile", {
      method: "PUT",
      body: JSON.stringify({ email }),
    });
    state.currentUser.email = data.email;
    updateUserInfo();
    showToast("Profile updated!", "success");
    return true;
  } catch (err) {
    showToast(err.message, "error");
    return false;
  }
}

// Update password
export async function updatePassword(currentPassword, newPassword) {
  try {
    await api("/auth/password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    showToast("Password updated successfully!", "success");
    return true;
  } catch (err) {
    showToast(err.message, "error");
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
