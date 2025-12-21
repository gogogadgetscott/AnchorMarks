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
import type { User } from "@types.ts";

// Show auth screen
export function showAuthScreen(): void {
  closeModals();
  const authScreen = document.getElementById("auth-screen");
  const mainApp = document.getElementById("main-app");
  if (authScreen) {
    authScreen.classList.remove("hidden");
    // Re-enable login forms for password managers when showing auth screen
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const loginEmail = document.getElementById(
      "login-email",
    ) as HTMLInputElement;
    const loginPassword = document.getElementById(
      "login-password",
    ) as HTMLInputElement;
    const registerEmail = document.getElementById(
      "register-email",
    ) as HTMLInputElement;
    const registerPassword = document.getElementById(
      "register-password",
    ) as HTMLInputElement;

    if (loginForm) {
      loginForm.removeAttribute("data-bitwarden-watching");
      loginForm.removeAttribute("aria-hidden");
      loginForm.removeAttribute("inert");
      loginForm.style.display = "";
    }
    if (registerForm) {
      registerForm.removeAttribute("data-bitwarden-watching");
      registerForm.removeAttribute("aria-hidden");
      registerForm.removeAttribute("inert");
      registerForm.style.display = "";
    }
    // Restore autocomplete attributes and enable inputs for password manager detection
    if (loginForm) {
      loginForm.removeAttribute("data-bitwarden-watching");
      loginForm.removeAttribute("data-lpignore");
      loginForm.removeAttribute("data-form-type");
      loginForm.removeAttribute("aria-hidden");
      loginForm.removeAttribute("inert");
      loginForm.style.display = "";
      loginForm.style.visibility = "";
      loginForm.style.position = "";
      loginForm.style.left = "";
    }
    if (registerForm) {
      registerForm.removeAttribute("data-bitwarden-watching");
      registerForm.removeAttribute("data-lpignore");
      registerForm.removeAttribute("data-form-type");
      registerForm.removeAttribute("aria-hidden");
      registerForm.removeAttribute("inert");
      registerForm.style.display = "";
      registerForm.style.visibility = "";
      registerForm.style.position = "";
      registerForm.style.left = "";
    }
    if (loginEmail) {
      loginEmail.setAttribute("autocomplete", "username");
      loginEmail.removeAttribute("data-form-type");
      loginEmail.removeAttribute("data-lpignore");
      loginEmail.removeAttribute("tabindex");
      loginEmail.disabled = false;
      loginEmail.readOnly = false;
      loginEmail.style.display = "";
    }
    if (loginPassword) {
      loginPassword.setAttribute("autocomplete", "current-password");
      loginPassword.removeAttribute("data-form-type");
      loginPassword.removeAttribute("data-lpignore");
      loginPassword.removeAttribute("tabindex");
      loginPassword.disabled = false;
      loginPassword.readOnly = false;
      loginPassword.style.display = "";
      loginPassword.type = "password"; // Restore password type
    }
    if (registerEmail) {
      registerEmail.setAttribute("autocomplete", "username");
      registerEmail.removeAttribute("data-form-type");
      registerEmail.removeAttribute("data-lpignore");
      registerEmail.removeAttribute("tabindex");
      registerEmail.disabled = false;
      registerEmail.readOnly = false;
      registerEmail.style.display = "";
    }
    if (registerPassword) {
      registerPassword.setAttribute("autocomplete", "new-password");
      registerPassword.removeAttribute("data-form-type");
      registerPassword.removeAttribute("data-lpignore");
      registerPassword.removeAttribute("tabindex");
      registerPassword.disabled = false;
      registerPassword.readOnly = false;
      registerPassword.style.display = "";
      registerPassword.type = "password"; // Restore password type
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
    // Aggressively disable login forms from password managers when logged in
    // This prevents Bitwarden and other password managers from detecting the forms
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const loginEmail = document.getElementById(
      "login-email",
    ) as HTMLInputElement;
    const loginPassword = document.getElementById(
      "login-password",
    ) as HTMLInputElement;
    const registerEmail = document.getElementById(
      "register-email",
    ) as HTMLInputElement;
    const registerPassword = document.getElementById(
      "register-password",
    ) as HTMLInputElement;

    // Hide and disable forms completely
    if (loginForm) {
      loginForm.setAttribute("data-bitwarden-watching", "false");
      loginForm.setAttribute("data-lpignore", "true");
      loginForm.setAttribute("data-form-type", "other");
      loginForm.setAttribute("aria-hidden", "true");
      loginForm.setAttribute("inert", "true");
      loginForm.style.display = "none";
      loginForm.style.visibility = "hidden";
      loginForm.style.position = "absolute";
      loginForm.style.left = "-9999px";
    }
    if (registerForm) {
      registerForm.setAttribute("data-bitwarden-watching", "false");
      registerForm.setAttribute("data-lpignore", "true");
      registerForm.setAttribute("data-form-type", "other");
      registerForm.setAttribute("aria-hidden", "true");
      registerForm.setAttribute("inert", "true");
      registerForm.style.display = "none";
      registerForm.style.visibility = "hidden";
      registerForm.style.position = "absolute";
      registerForm.style.left = "-9999px";
    }
    // Remove autocomplete attributes and disable inputs to prevent password manager detection
    if (loginEmail) {
      loginEmail.removeAttribute("autocomplete");
      loginEmail.setAttribute("data-form-type", "other");
      loginEmail.setAttribute("data-lpignore", "true");
      loginEmail.setAttribute("tabindex", "-1");
      loginEmail.disabled = true;
      loginEmail.readOnly = true;
      loginEmail.style.display = "none";
    }
    if (loginPassword) {
      loginPassword.removeAttribute("autocomplete");
      loginPassword.setAttribute("data-form-type", "other");
      loginPassword.setAttribute("data-lpignore", "true");
      loginPassword.setAttribute("tabindex", "-1");
      loginPassword.disabled = true;
      loginPassword.readOnly = true;
      loginPassword.style.display = "none";
      loginPassword.type = "text"; // Change type to prevent detection
    }
    if (registerEmail) {
      registerEmail.removeAttribute("autocomplete");
      registerEmail.setAttribute("data-form-type", "other");
      registerEmail.setAttribute("data-lpignore", "true");
      registerEmail.setAttribute("tabindex", "-1");
      registerEmail.disabled = true;
      registerEmail.readOnly = true;
      registerEmail.style.display = "none";
    }
    if (registerPassword) {
      registerPassword.removeAttribute("autocomplete");
      registerPassword.setAttribute("data-form-type", "other");
      registerPassword.setAttribute("data-lpignore", "true");
      registerPassword.setAttribute("tabindex", "-1");
      registerPassword.disabled = true;
      registerPassword.readOnly = true;
      registerPassword.style.display = "none";
      registerPassword.type = "text"; // Change type to prevent detection
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
