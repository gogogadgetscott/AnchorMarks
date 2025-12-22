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

// Show auth screen
export function showAuthScreen(): void {
  closeModals();
  const authScreen = document.getElementById("auth-screen");
  const mainApp = document.getElementById("main-app");
  
  if (authScreen) {
    authScreen.classList.remove("hidden");
    
    // Enable forms for password managers when showing auth screen
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const loginPassword = document.getElementById(
      "login-password",
    ) as HTMLInputElement;
    const registerPassword = document.getElementById(
      "register-password",
    ) as HTMLInputElement;

    if (loginForm) {
      loginForm.removeAttribute("autocomplete");
      loginForm.setAttribute("autocomplete", "on");
      loginForm.style.display = "";
    }
    if (registerForm) {
      registerForm.removeAttribute("autocomplete");
      registerForm.setAttribute("autocomplete", "on");
      registerForm.style.display = "";
    }
    
    // Change password fields to type="password" so password managers can detect them
    if (loginPassword) {
      loginPassword.type = "password";
      loginPassword.removeAttribute("style");
      loginPassword.setAttribute("autocomplete", "current-password");
    }
    if (registerPassword) {
      registerPassword.type = "password";
      registerPassword.removeAttribute("style");
      registerPassword.setAttribute("autocomplete", "new-password");
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
    
    // Keep forms disabled with type="text" when not on login page to prevent password manager detection
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const loginPassword = document.getElementById(
      "login-password",
    ) as HTMLInputElement;
    const registerPassword = document.getElementById(
      "register-password",
    ) as HTMLInputElement;

    if (loginForm) {
      loginForm.style.display = "none";
    }
    if (registerForm) {
      registerForm.style.display = "none";
    }
    
    // Change password fields back to type="text" with visual masking to prevent password manager detection
    if (loginPassword) {
      loginPassword.type = "text";
      loginPassword.style.cssText = "-webkit-text-security: disc; text-security: disc;";
      loginPassword.removeAttribute("autocomplete");
    }
    if (registerPassword) {
      registerPassword.type = "text";
      registerPassword.style.cssText = "-webkit-text-security: disc; text-security: disc;";
      registerPassword.removeAttribute("autocomplete");
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
