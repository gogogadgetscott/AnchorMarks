const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { JWT_SECRET, NODE_ENV } = require("../config");
const {
  ensureTagsExist,
  updateBookmarkTags,
} = require("../helpers/tag-helpers");

function generateCsrfToken() {
  return uuidv4().replace(/-/g, "");
}

function createExampleBookmarks(db, userId, folderId = null, fetchFavicon) {
  const EXAMPLE_BOOKMARKS = [
    {
      title: "GitHub",
      url: "https://github.com",
      description: "Code hosting and collaboration platform",
      tags: "dev,git",
    },
    {
      title: "Stack Overflow",
      url: "https://stackoverflow.com",
      description: "Q&A for programmers",
      tags: "dev,help",
    },
    {
      title: "MDN Web Docs",
      url: "https://developer.mozilla.org",
      description: "Web development documentation",
      tags: "dev,docs",
    },
    {
      title: "Hacker News",
      url: "https://news.ycombinator.com",
      description: "Tech news and discussion",
      tags: "news,tech",
    },
    {
      title: "Reddit",
      url: "https://reddit.com",
      description: "Social news aggregation",
      tags: "social,news",
    },
  ];

  const created = [];

  for (let i = 0; i < EXAMPLE_BOOKMARKS.length; i++) {
    const bm = EXAMPLE_BOOKMARKS[i];
    const id = uuidv4();
    const faviconUrl = null;

    db.prepare(
      `INSERT INTO bookmarks (id, user_id, folder_id, title, url, description, favicon, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      folderId,
      bm.title,
      bm.url,
      bm.description,
      faviconUrl,
      i + 1,
    );

    if (bm.tags) {
      const tagIds = ensureTagsExist(db, userId, bm.tags);
      updateBookmarkTags(db, id, tagIds);
    }

    if (fetchFavicon && process.env.NODE_ENV === "production") {
      fetchFavicon(bm.url, id).catch(console.error);
    }

    created.push({ id, ...bm, favicon: faviconUrl });
  }

  return created;
}

function setupAuthRoutes(
  app,
  db,
  authenticateToken,
  fetchFavicon,
  securityAudit = null,
) {
  // Helper to safely log security events (no-op if audit logger not provided)
  const audit = securityAudit || {
    register: () => {},
    loginSuccess: () => {},
    loginFailure: () => {},
    logout: () => {},
    passwordChange: () => {},
    apiKeyRegenerate: () => {},
  };
  // Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password } = req.body;
      const normalizedEmail = (email || "").trim().toLowerCase();

      if (!normalizedEmail || !password)
        return res.status(400).json({ error: "All fields are required" });
      if (password.length < 6)
        return res
          .status(400)
          .json({ error: "Password must be at least 6 characters" });

      const existingUser = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(normalizedEmail);
      if (existingUser)
        return res.status(400).json({ error: "User already exists" });

      const hashedPassword = await bcrypt.hash(password, 12);
      const userId = uuidv4();
      const apiKey = "lv_" + uuidv4().replace(/-/g, "");

      db.prepare(
        "INSERT INTO users (id, email, password, api_key) VALUES (?, ?, ?, ?)",
      ).run(userId, normalizedEmail, hashedPassword, apiKey);

      const defaultFolderId = uuidv4();
      db.prepare(
        "INSERT INTO folders (id, user_id, name, color, icon) VALUES (?, ?, ?, ?, ?)",
      ).run(defaultFolderId, userId, "My Bookmarks", "#6366f1", "folder");

      createExampleBookmarks(db, userId, defaultFolderId, fetchFavicon);

      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
      const csrfToken = generateCsrfToken();

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });
      res.cookie("csrfToken", csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      // Log successful registration
      audit.register(userId, req, { email: normalizedEmail });

      res.json({
        user: {
          id: userId,
          username: email, // use email as username
          email,
          role: "user",
          api_key: apiKey,
        },
        csrfToken,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const normalizedEmail = (email || "").trim().toLowerCase();

      const user = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(normalizedEmail);
      if (!user) {
        audit.loginFailure(null, req, {
          email: normalizedEmail,
          reason: "user_not_found",
        });
        return res.status(400).json({ error: "Invalid credentials" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        audit.loginFailure(user.id, req, {
          email: normalizedEmail,
          reason: "invalid_password",
        });
        return res.status(400).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
        expiresIn: "30d",
      });
      const csrfToken = generateCsrfToken();

      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });
      res.cookie("csrfToken", csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      // Log successful login
      audit.loginSuccess(user.id, req, { email: user.email });

      res.json({
        user: {
          id: user.id,
          username: user.email, // use email as username
          email: user.email,
          role: user.role || "user",
          api_key: user.api_key,
        },
        csrfToken,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Get current user
  app.get("/api/auth/me", authenticateToken, (req, res) => {
    res.json({
      user: {
        id: req.user.id,
        username: req.user.email, // Use email as username (no separate username field in DB)
        email: req.user.email,
        role: req.user.role || "user",
        api_key: req.user.api_key,
      },
      csrfToken: req.cookies.csrfToken,
    });
  });

  // Logout
  app.post("/api/auth/logout", authenticateToken, (req, res) => {
    audit.logout(req.user.id, req);
    res.clearCookie("token");
    res.clearCookie("csrfToken");
    // Rotate CSRF token after logout for extra safety
    const csrfToken = generateCsrfToken();
    res.cookie("csrfToken", csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.json({ success: true, csrfToken });
  });

  // Delete account
  app.delete("/api/auth/me", authenticateToken, (req, res) => {
    try {
      const userId = req.user.id;

      // Delete from security audit log
      db.prepare("DELETE FROM security_audit_log WHERE user_id = ?").run(
        userId,
      );

      // Delete user (cascades to all other tables)
      const result = db.prepare("DELETE FROM users WHERE id = ?").run(userId);

      if (result.changes === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.clearCookie("token");
      res.clearCookie("csrfToken");
      res.json({
        success: true,
        message: "Account and data deleted successfully",
      });
    } catch (err) {
      console.error("Delete account error:", err);
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Regenerate API key
  app.post("/api/auth/regenerate-key", authenticateToken, (req, res) => {
    const newApiKey = "lv_" + uuidv4().replace(/-/g, "");
    db.prepare("UPDATE users SET api_key = ? WHERE id = ?").run(
      newApiKey,
      req.user.id,
    );
    audit.apiKeyRegenerate(req.user.id, req);
    res.json({ api_key: newApiKey });
  });

  // Update profile
  app.put("/api/auth/profile", authenticateToken, (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const existing = db
        .prepare("SELECT id FROM users WHERE email = ? AND id != ?")
        .get(email.toLowerCase(), req.user.id);
      if (existing)
        return res.status(400).json({ error: "Email already in use" });

      db.prepare(
        "UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(email.toLowerCase(), req.user.id);
      res.json({ success: true, email: email.toLowerCase() });
    } catch (err) {
      console.error("Update profile error:", err);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Change password
  app.put("/api/auth/password", authenticateToken, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword)
        return res
          .status(400)
          .json({ error: "Both current and new passwords are required" });
      if (newPassword.length < 6)
        return res
          .status(400)
          .json({ error: "New password must be at least 6 characters" });

      const user = db
        .prepare("SELECT password FROM users WHERE id = ?")
        .get(req.user.id);
      const validPassword = await bcrypt.compare(
        currentPassword,
        user.password,
      );
      if (!validPassword)
        return res.status(400).json({ error: "Incorrect current password" });

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      db.prepare(
        "UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(hashedPassword, req.user.id);
      audit.passwordChange(req.user.id, req);
      // Rotate CSRF token after password change
      const csrfToken = generateCsrfToken();
      res.cookie("csrfToken", csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      res.json({ success: true, csrfToken });
    } catch (err) {
      console.error("Change password error:", err);
      res.status(500).json({ error: "Failed to change password" });
    }
  });
}

module.exports = { setupAuthRoutes, createExampleBookmarks };
