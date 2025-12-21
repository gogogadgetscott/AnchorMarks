/**
 * AnchorMarks - Auth Module
 * Handles authentication (login, register, logout, checkAuth)
 */

import * as state from "@features/state.ts";
import { api } from "@services/api.ts";
import { showToast, closeModals } from "@utils/ui-helpers.ts";

// Show auth screen
export function showAuthScreen(): void {
  closeModals();
  const authScreen = document.getElementById("auth-screen");
  const mainApp = document.getElementById("main-app");
  if (authScreen) authScreen.classList.remove("hidden");
  if (mainApp) mainApp.classList.add("hidden");
}

// Show main app
export function showMainApp(): void {
  const authScreen = document.getElementById("auth-screen");
  const mainApp = document.getElementById("main-app");
  if (authScreen) authScreen.classList.add("hidden");
  if (mainApp) mainApp.classList.remove("hidden");
}

// Login
export async function login(email: string, password: string): Promise<boolean> {
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
  } catch (err: any) {
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
export async function register(
  email: string,
  password: string,
): Promise<boolean> {
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
  } catch (err: any) {
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
export function logout(): void {
  api("/auth/logout", { method: "POST" })
    .catch(() => { })
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
    const data = await api("/auth/me");
    state.setCurrentUser(data.user);
    state.setCsrfToken(data.csrfToken);
    state.setIsAuthenticated(true);
    // Clear any previous error banner
    const banner = document.getElementById("server-status-banner");
    if (banner) banner.classList.add("hidden");
    return true;
  } catch (err: any) {
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
export function updateUserInfo(): void {
  if (state.currentUser) {
    const userNames = document.querySelectorAll(".header-user-name");
    const userAvatars = document.querySelectorAll(".header-user-avatar");
    const userAvatarsLarge = document.querySelectorAll(".header-user-avatar-large");
    const apiKeyValue = document.getElementById("api-key-value");

    const initials = (state.currentUser.email || "U").charAt(0).toUpperCase();

    userNames.forEach((el) => (el.textContent = state.currentUser!.email));
    userAvatars.forEach((el) => (el.textContent = initials));
    userAvatarsLarge.forEach((el) => (el.textContent = initials));
    if (apiKeyValue) apiKeyValue.textContent = state.currentUser.api_key || "";
  }
}

// Regenerate API key
export async function regenerateApiKey(): Promise<void> {
  if (!confirm("Regenerate API key? Old keys will stop working.")) return;

  try {
    const data = await api("/auth/regenerate-key", { method: "POST" });
    if (state.currentUser) {
      state.currentUser.api_key = data.api_key;
    }
    const apiKeyValue = document.getElementById("api-key-value");
    if (apiKeyValue) apiKeyValue.textContent = data.api_key;
    showToast("API key regenerated!", "success");
  } catch (err: any) {
    showToast(err.message, "error");
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
    const data = await api("/auth/profile", {
      method: "PUT",
      body: JSON.stringify({ email }),
    });
    if (state.currentUser) state.currentUser.email = data.email;
    updateUserInfo();
    showToast("Profile updated!", "success");
    return true;
  } catch (err: any) {
    showToast(err.message, "error");
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
  } catch (err: any) {
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
