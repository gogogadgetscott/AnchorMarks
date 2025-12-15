/**
 * AnchorMarks - Auth Module
 * Handles authentication (login, register, logout, checkAuth)
 */

import * as state from "./state.js";
import { api } from "./api.js";
import { showToast, closeModals } from "./ui.js";

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
    return true;
  } catch (err) {
    console.error("Auth check failed:", err.message);
    state.setCsrfToken(null);
    state.setCurrentUser(null);
    state.setIsAuthenticated(false);
    showAuthScreen();
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
};
