import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { User } from "../types/index";
import { setAuthContextSetter } from "@features/auth/auth.ts";
import { registerAuthBridge } from "./context-bridge";
import { api } from "@services/api.ts";
import { showToast } from "./ToastContext";
import { showConfirm } from "./ConfirmContext";
import { handleApiError, hideServerStatusBanner } from "@utils/error-handler";
import { logger } from "@utils/logger";

interface AuthState {
  authToken: string | null;
  csrfToken: string | null;
  currentUser: User | null;
  isAuthenticated: boolean;
}

interface AuthMethods {
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  updateProfile: (email: string) => Promise<boolean>;
  updatePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<boolean>;
  regenerateApiKey: () => Promise<void>;
  copyApiKey: () => void;
  prefetchCsrf: () => Promise<void>;
}

interface AuthActions {
  setAuthToken: (val: string | null) => void;
  setCsrfToken: (val: string | null) => void;
  setCurrentUser: (val: User | null) => void;
  setIsAuthenticated: (val: boolean) => void;
}

type AuthContextValue = AuthState & AuthActions & AuthMethods;

const AuthContext = createContext<AuthContextValue | null>(null);

const initialState: AuthState = {
  authToken: null,
  csrfToken: null,
  currentUser: null,
  isAuthenticated: false,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authToken, setAuthToken] = useState<string | null>(
    initialState.authToken,
  );
  const [csrfToken, setCsrfToken] = useState<string | null>(
    initialState.csrfToken,
  );
  const [currentUser, setCurrentUser] = useState<User | null>(
    initialState.currentUser,
  );
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    initialState.isAuthenticated,
  );

  useEffect(() => {
    setAuthContextSetter((user, csrf, isAuth) => {
      if (user) setCurrentUser(user);
      if (csrf) setCsrfToken(csrf);
      setIsAuthenticated(isAuth);
    });
  }, []);

  // Register with context bridge for non-React code
  useEffect(() => {
    registerAuthBridge({
      getCsrfToken: () => csrfToken,
      setCsrfToken,
      getCurrentUser: () => currentUser,
      setCurrentUser,
      getIsAuthenticated: () => isAuthenticated,
      setIsAuthenticated,
    });
  }, []);

  // Prefetch CSRF Token
  const prefetchCsrf = useCallback(async () => {
    if (!csrfToken) {
      try {
        const data = await api<{ csrfToken: string }>("/auth/csrf");
        setCsrfToken(data.csrfToken);
      } catch (e) {
        logger.error("Failed to prefetch CSRF token", e);
      }
    }
  }, [csrfToken]);

  // Login
  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        await prefetchCsrf();
        const data = await api<{
          csrfToken: string;
          user: User;
        }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setCsrfToken(data.csrfToken);
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        showToast("Welcome back!", "success");
        return true;
      } catch (err) {
        logger.error("Login failed", err);
        const errorMessage = handleApiError(err, true);
        showToast(errorMessage, "error");
        return false;
      }
    },
    [prefetchCsrf],
  );

  // Register
  const register = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        await prefetchCsrf();
        const data = await api<{
          csrfToken: string;
          user: User;
        }>("/auth/register", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setCsrfToken(data.csrfToken);
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        showToast("Account created successfully!", "success");
        return true;
      } catch (err) {
        logger.error("Register failed", err);
        const errorMessage = handleApiError(err, true);
        showToast(errorMessage, "error");
        return false;
      }
    },
    [prefetchCsrf],
  );

  // Logout
  const logout = useCallback(() => {
    api("/auth/logout", { method: "POST" })
      .catch((err) => {
        logger.error("Logout failed", err);
      })
      .finally(() => {
        setCsrfToken(null);
        setCurrentUser(null);
        setIsAuthenticated(false);
      });
  }, []);

  // Check authentication status
  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      const data = await api<{
        user: User;
        csrfToken: string;
      }>("/auth/me");
      setCurrentUser(data.user);
      setCsrfToken(data.csrfToken);
      setIsAuthenticated(true);
      hideServerStatusBanner();
      return true;
    } catch (err) {
      logger.error("Auth check failed", err);
      setCsrfToken(null);
      setCurrentUser(null);
      setIsAuthenticated(false);
      handleApiError(err, true);
      return false;
    }
  }, []);

  // Update profile (email)
  const updateProfile = useCallback(async (email: string): Promise<boolean> => {
    try {
      const data = await api<{ email: string }>("/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ email }),
      });
      setCurrentUser((prev) => (prev ? { ...prev, email: data.email } : null));
      showToast("Profile updated!", "success");
      return true;
    } catch (err) {
      logger.error("Update profile failed", err);
      const errorMessage = handleApiError(err, false);
      showToast(errorMessage, "error");
      return false;
    }
  }, []);

  // Update password
  const updatePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<boolean> => {
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
    },
    [],
  );

  // Regenerate API key
  const regenerateApiKey = useCallback(async (): Promise<void> => {
    const confirmed = await showConfirm(
      "Regenerate API key? Old keys will stop working.",
      {
        title: "Regenerate API Key",
        confirmText: "Regenerate",
        destructive: true,
      },
    );

    if (!confirmed) return;

    try {
      const data = await api<{ api_key: string }>("/auth/regenerate-key", {
        method: "POST",
      });
      setCurrentUser((prev) =>
        prev ? { ...prev, api_key: data.api_key } : null,
      );
      showToast("API key regenerated!", "success");
    } catch (err) {
      logger.error("Regenerate API key failed", err);
      const errorMessage = handleApiError(err, false);
      showToast(errorMessage, "error");
    }
  }, []);

  // Copy API key
  const copyApiKey = useCallback(() => {
    if (!currentUser?.api_key) return;
    navigator.clipboard.writeText(currentUser.api_key);
    showToast("API key copied!", "success");
  }, [currentUser]);

  const value: AuthContextValue = {
    authToken,
    csrfToken,
    currentUser,
    isAuthenticated,
    setAuthToken: useCallback((val) => setAuthToken(val), []),
    setCsrfToken: useCallback((val) => setCsrfToken(val), []),
    setCurrentUser: useCallback((val) => setCurrentUser(val), []),
    setIsAuthenticated: useCallback((val) => setIsAuthenticated(val), []),
    login,
    register,
    logout,
    checkAuth,
    updateProfile,
    updatePassword,
    regenerateApiKey,
    copyApiKey,
    prefetchCsrf,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
