import React, { useState, useEffect } from "react";
import { useAuth } from "@contexts/AuthContext";
import { showToast } from "@utils/ui-helpers.ts";
import { Icon } from "./Icon.tsx";

export function AuthScreen() {
  const { isAuthenticated, login, register } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  useEffect(() => {
    if (tab === "register") {
      updatePasswordStrength(password);
    }
  }, [password, tab]);

  const updatePasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    setPasswordStrength(Math.min(score, 4));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        if (password !== confirmPassword) {
          showToast("Passwords do not match", "error");
          return;
        }
        await register(email, password);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    showToast(
      "Password reset is not yet available. Contact your admin.",
      "info",
    );
  };

  if (isAuthenticated) return null;

  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthLevels = ["", "weak", "fair", "good", "strong"];

  return (
    <div id="auth-screen" className="auth-screen">
      <div className="auth-container">
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
            className={`auth-tab ${tab === "login" ? "active" : ""}`}
            onClick={() => setTab("login")}
          >
            Login
          </button>
          <button
            className={`auth-tab ${tab === "register" ? "active" : ""}`}
            onClick={() => setTab("register")}
          >
            Register
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="auth-email">Email</label>
            <input
              type="email"
              id="auth-email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="auth-password">Password</label>
              {tab === "login" && (
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="auth-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  tab === "login" ? "current-password" : "new-password"
                }
                minLength={tab === "register" ? 6 : undefined}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <Icon name={showPassword ? "eye-off" : "eye"} size={20} />
              </button>
            </div>

            {tab === "register" && password.length > 0 && (
              <div className="password-strength">
                <div className="strength-bar">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`strength-segment ${
                        i < passwordStrength
                          ? strengthLevels[passwordStrength]
                          : ""
                      }`}
                    />
                  ))}
                </div>
                <span
                  className={`strength-label ${strengthLevels[passwordStrength]}`}
                >
                  {strengthLabels[passwordStrength]}
                </span>
              </div>
            )}
          </div>

          {tab === "register" && (
            <div className="form-group">
              <label htmlFor="auth-confirm-password">Confirm Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="auth-confirm-password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <span className="confirm-password-error">
                  Passwords do not match
                </span>
              )}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={isLoading}
          >
            <span>{tab === "login" ? "Sign In" : "Create Account"}</span>
            {isLoading ? (
              <Icon name="loader" className="animate-spin" size={18} />
            ) : (
              <Icon name="arrow-right" size={18} />
            )}
          </button>
        </form>

        <div className="auth-features">
          <div
            className="feature"
            data-tooltip="Your data stays on your own server"
          >
            <Icon name="shield" size={20} />
            <span>Secure & Private</span>
          </div>
          <div
            className="feature"
            data-tooltip="Sync bookmarks across all your browsers"
          >
            <Icon name="sync" size={20} />
            <span>Browser Sync</span>
          </div>
          <div
            className="feature"
            data-tooltip="Access your bookmarks via REST API"
          >
            <Icon name="code" size={20} />
            <span>API Access</span>
          </div>
        </div>
      </div>

      <div className="auth-bg">
        <div className="bg-gradient"></div>
        <div className="bg-pattern"></div>
      </div>
    </div>
  );
}
