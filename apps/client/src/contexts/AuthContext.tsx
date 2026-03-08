import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "../types/index";

interface AuthState {
  authToken: string | null;
  csrfToken: string | null;
  currentUser: User | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  setAuthToken: (val: string | null) => void;
  setCsrfToken: (val: string | null) => void;
  setCurrentUser: (val: User | null) => void;
  setIsAuthenticated: (val: boolean) => void;
}

type AuthContextValue = AuthState & AuthActions;

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

  const value: AuthContextValue = {
    authToken,
    csrfToken,
    currentUser,
    isAuthenticated,
    setAuthToken: useCallback((val) => setAuthToken(val), []),
    setCsrfToken: useCallback((val) => setCsrfToken(val), []),
    setCurrentUser: useCallback((val) => setCurrentUser(val), []),
    setIsAuthenticated: useCallback((val) => setIsAuthenticated(val), []),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
