import React, { memo, useState, useCallback } from "react";
import { Icon } from "../components/Icon";
import { Button } from "../components/Button";

interface AuthScreenProps {
  onLogin?: (email: string, password: string) => Promise<boolean>;
  onRegister?: (email: string, password: string) => Promise<boolean>;
}

export const AuthScreen = memo<AuthScreenProps>(({ onLogin, onRegister }) => {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError("");

      try {
        const success =
          activeTab === "login"
            ? await onLogin?.(email, password)
            : await onRegister?.(email, password);

        if (!success) {
          setError(
            activeTab === "login"
              ? "Invalid credentials"
              : "Registration failed",
          );
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, email, password, onLogin, onRegister],
  );

  return (
    <div id="auth-screen" className="auth-screen">
      <div className="auth-container">
        <div id="server-status-banner" className="status-banner error hidden">
          <Icon name="info" size={18} />
          <span id="server-status-message">Server Unavailable</span>
        </div>

        <div className="auth-header">
          <div className="logo">
            <div className="logo-icon">
              <img src="/icon.png" alt="AnchorMarks Logo" />
            </div>
            <span className="logo-text">AnchorMarks</span>
          </div>
          <p className="auth-subtitle">Your bookmarks, beautifully organized</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${activeTab === "login" ? "active" : ""}`}
            onClick={() => setActiveTab("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={`auth-tab ${activeTab === "register" ? "active" : ""}`}
            onClick={() => setActiveTab("register")}
            type="button"
          >
            Register
          </button>
        </div>

        <form
          id={`${activeTab}-form`}
          className="auth-form"
          onSubmit={handleSubmit}
          data-bitwarden-watching="false"
          data-lpignore="true"
        >
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor={`${activeTab}-email`}>Email</label>
            <input
              type="email"
              id={`${activeTab}-email`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              autoComplete={activeTab === "login" ? "username" : "email"}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${activeTab}-password`}>Password</label>
            <input
              type="password"
              id={`${activeTab}-password`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete={
                activeTab === "login" ? "current-password" : "new-password"
              }
              disabled={loading}
              minLength={8}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="btn-full"
            loading={loading}
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : activeTab === "login"
                ? "Login"
                : "Register"}
          </Button>
        </form>

        <div className="auth-footer">
          <p className="auth-help-text">
            {activeTab === "login"
              ? "New to AnchorMarks? Switch to Register to create an account."
              : "Already have an account? Switch to Login."}
          </p>
        </div>
      </div>
    </div>
  );
});

AuthScreen.displayName = "AuthScreen";
