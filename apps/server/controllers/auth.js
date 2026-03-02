const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY,
} = require("../config");
const { logger } = require("../lib/logger");
const { reportAndSend } = require("../lib/errors");

function expiryToMs(expiry) {
  const s = String(expiry);
  const n = parseInt(s, 10);
  if (s.endsWith("d")) return n * 24 * 60 * 60 * 1000;
  if (s.endsWith("h")) return n * 60 * 60 * 1000;
  if (s.endsWith("m")) return n * 60 * 1000;
  if (s.endsWith("s")) return n * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

function setTokenCookies(res, accessToken, refreshToken, csrfToken) {
  const isProd = process.env.NODE_ENV === "production";
  const cookieOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "Strict" : "Lax",
    path: "/",
  };
  res.cookie("token", accessToken, {
    ...cookieOpts,
    maxAge: expiryToMs(JWT_ACCESS_EXPIRY),
  });
  res.cookie("refreshToken", refreshToken, {
    ...cookieOpts,
    maxAge: expiryToMs(JWT_REFRESH_EXPIRY),
  });
  res.cookie("csrfToken", csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? "Strict" : "Lax",
    maxAge: expiryToMs(JWT_REFRESH_EXPIRY),
    path: "/",
  });
}
const {
  ensureTagsExist,
  updateBookmarkTags,
} = require("../helpers/tag-helpers");
const {
  EXAMPLE_BOOKMARKS,
  STARTER_FOLDER,
} = require("../helpers/example-bookmarks");

function generateCsrfToken() {
  return uuidv4().replace(/-/g, "");
}

function createExampleBookmarks(db, userId, folderId = null, fetchFavicon) {
  const created = [];

  for (let i = 0; i < EXAMPLE_BOOKMARKS.length; i++) {
    const bm = EXAMPLE_BOOKMARKS[i];
    const id = uuidv4();
    const faviconUrl = null;
    // Place bookmarks marked with inStarterFolder in the provided folder
    const bookmarkFolderId = bm.inStarterFolder ? folderId : null;

    db.prepare(
      `INSERT INTO bookmarks (id, user_id, folder_id, title, url, description, favicon, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      bookmarkFolderId,
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
      fetchFavicon(bm.url, id, userId).catch((e) =>
        logger.error("Favicon fetch failed for example bookmark", e),
      );
    }

    created.push({ id, ...bm, favicon: faviconUrl });
  }

  return created;
}

const { validateBody, schemas } = require("../validation");

function setupAuthRoutes(
  app,
  db,
  authenticateToken,
  validateCsrfTokenMiddleware,
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

  /**
   * @swagger
   * /auth/csrf:
   *   get:
   *     summary: Get CSRF token
   *     tags: [Auth]
   *     description: Generates and returns a CSRF token in a cookie and response body.
   *     responses:
   *       200:
   *         description: CSRF token generated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 csrfToken:
   *                   type: string
   */
  // Get CSRF Token
  app.get("/api/auth/csrf", (req, res) => {
    const csrfToken = generateCsrfToken();
    res.cookie("csrfToken", csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    res.json({ csrfToken });
  });

  /**
   * @swagger
   * /auth/register:
   *   post:
   *     summary: Register a new user
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *                 minLength: 6
   *     responses:
   *       200:
   *         description: User registered successfully
   *       400:
   *         description: Invalid input or user already exists
   */
  // Register
  app.post(
    "/api/auth/register",
    validateBody(schemas.authRegister),
    async (req, res) => {
      try {
        const { email, password } = req.validated;
        const normalizedEmail = (email || "").trim().toLowerCase();

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
        ).run(
          defaultFolderId,
          userId,
          STARTER_FOLDER.name,
          STARTER_FOLDER.color,
          STARTER_FOLDER.icon,
        );

        createExampleBookmarks(db, userId, defaultFolderId, fetchFavicon);

        const refreshJti = uuidv4();
        const accessToken = jwt.sign({ userId }, JWT_SECRET, {
          expiresIn: JWT_ACCESS_EXPIRY,
        });
        const refreshToken = jwt.sign(
          { userId, jti: refreshJti },
          JWT_REFRESH_SECRET,
          {
            expiresIn: JWT_REFRESH_EXPIRY,
          },
        );
        const csrfToken = generateCsrfToken();
        const refreshExpiresAt = new Date(
          Date.now() + expiryToMs(JWT_REFRESH_EXPIRY),
        ).toISOString();
        db.prepare(
          "INSERT INTO refresh_tokens (id, user_id, expires_at) VALUES (?, ?, ?)",
        ).run(refreshJti, userId, refreshExpiresAt);

        setTokenCookies(res, accessToken, refreshToken, csrfToken);

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
        if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
          return res.status(400).json({ error: "User already exists" });
        }
        return reportAndSend(res, err, logger, "Registration error");
      }
    },
  );

  /**
   * @swagger
   * /auth/login:
   *   post:
   *     summary: Log in a user
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, password]
   *             properties:
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Login successful
   *       400:
   *         description: Invalid credentials
   */
  // Login
  app.post(
    "/api/auth/login",
    validateBody(schemas.authLogin),
    async (req, res) => {
      try {
        const { email, password } = req.validated;
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

        const refreshJti = uuidv4();
        const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
          expiresIn: JWT_ACCESS_EXPIRY,
        });
        const refreshToken = jwt.sign(
          { userId: user.id, jti: refreshJti },
          JWT_REFRESH_SECRET,
          { expiresIn: JWT_REFRESH_EXPIRY },
        );
        const csrfToken = generateCsrfToken();
        const refreshExpiresAt = new Date(
          Date.now() + expiryToMs(JWT_REFRESH_EXPIRY),
        ).toISOString();
        db.prepare(
          "INSERT INTO refresh_tokens (id, user_id, expires_at) VALUES (?, ?, ?)",
        ).run(refreshJti, user.id, refreshExpiresAt);

        setTokenCookies(res, accessToken, refreshToken, csrfToken);

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
        return reportAndSend(res, err, logger, "Login error");
      }
    },
  );

  /**
   * @swagger
   * /auth/me:
   *   get:
   *     summary: Get current user info
   *     tags: [Auth]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Current user information
   *       401:
   *         description: Unauthorized
   */
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

  /**
   * @swagger
   * /auth/logout:
   *   post:
   *     summary: Log out a user
   *     tags: [Auth]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Logout successful
   */
  /**
   * @swagger
   * /auth/refresh:
   *   post:
   *     summary: Rotate tokens using refresh token (no auth required)
   *     tags: [Auth]
   *     description: Accepts refresh token from cookie; issues new access + refresh and invalidates the old refresh (rotation).
   *     responses:
   *       200:
   *         description: New tokens issued
   *       401:
   *         description: Refresh token missing, invalid, or already used
   */
  app.post("/api/auth/refresh", (req, res) => {
    try {
      db.prepare("DELETE FROM refresh_tokens WHERE expires_at < ?").run(
        new Date().toISOString(),
      );
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        res.clearCookie("token");
        res.clearCookie("refreshToken");
        res.clearCookie("csrfToken");
        return res.status(401).json({ error: "Refresh token required" });
      }
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      const { userId, jti } = decoded;
      if (!userId || !jti) {
        res.clearCookie("token");
        res.clearCookie("refreshToken");
        res.clearCookie("csrfToken");
        return res.status(401).json({ error: "Invalid refresh token" });
      }
      const row = db
        .prepare(
          "SELECT id, user_id, expires_at FROM refresh_tokens WHERE id = ?",
        )
        .get(jti);
      const now = new Date().toISOString();
      if (!row || row.expires_at < now) {
        if (row) db.prepare("DELETE FROM refresh_tokens WHERE id = ?").run(jti);
        res.clearCookie("token");
        res.clearCookie("refreshToken");
        res.clearCookie("csrfToken");
        return res
          .status(401)
          .json({ error: "Refresh token expired or revoked" });
      }
      db.prepare("DELETE FROM refresh_tokens WHERE id = ?").run(jti);

      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
      if (!user) {
        res.clearCookie("token");
        res.clearCookie("refreshToken");
        res.clearCookie("csrfToken");
        return res.status(401).json({ error: "User not found" });
      }

      const newRefreshJti = uuidv4();
      const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
        expiresIn: JWT_ACCESS_EXPIRY,
      });
      const newRefreshToken = jwt.sign(
        { userId: user.id, jti: newRefreshJti },
        JWT_REFRESH_SECRET,
        { expiresIn: JWT_REFRESH_EXPIRY },
      );
      const csrfToken = generateCsrfToken();
      const refreshExpiresAt = new Date(
        Date.now() + expiryToMs(JWT_REFRESH_EXPIRY),
      ).toISOString();
      db.prepare(
        "INSERT INTO refresh_tokens (id, user_id, expires_at) VALUES (?, ?, ?)",
      ).run(newRefreshJti, user.id, refreshExpiresAt);

      setTokenCookies(res, accessToken, newRefreshToken, csrfToken);

      res.json({
        user: {
          id: user.id,
          username: user.email,
          email: user.email,
          role: user.role || "user",
          api_key: user.api_key,
        },
        csrfToken,
      });
    } catch (err) {
      if (
        err.name === "TokenExpiredError" ||
        err.name === "JsonWebTokenError"
      ) {
        res.clearCookie("token");
        res.clearCookie("refreshToken");
        res.clearCookie("csrfToken");
        return res
          .status(401)
          .json({ error: "Refresh token invalid or expired" });
      }
      logger.error("Refresh token error", err);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Logout
  app.post(
    "/api/auth/logout",
    authenticateToken,
    validateCsrfTokenMiddleware,
    (req, res) => {
      audit.logout(req.user.id, req);
      db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(
        req.user.id,
      );
      res.clearCookie("token");
      res.clearCookie("refreshToken");
      res.clearCookie("csrfToken");
      const csrfToken = generateCsrfToken();
      res.cookie("csrfToken", csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
        maxAge: expiryToMs(JWT_REFRESH_EXPIRY),
        path: "/",
      });
      res.json({ success: true, csrfToken });
    },
  );

  /**
   * @swagger
   * /auth/me:
   *   delete:
   *     summary: Delete current user account
   *     tags: [Auth]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Account deleted successfully
   *       401:
   *         description: Unauthorized
   */
  // Delete account
  app.delete(
    "/api/auth/me",
    authenticateToken,
    validateCsrfTokenMiddleware,
    (req, res) => {
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
        res.clearCookie("refreshToken");
        res.clearCookie("csrfToken");
        res.json({
          success: true,
          message: "Account and data deleted successfully",
        });
      } catch (err) {
        return reportAndSend(res, err, logger, "Delete account error");
      }
    },
  );

  /**
   * @swagger
   * /auth/regenerate-key:
   *   post:
   *     summary: Regenerate API key
   *     tags: [Auth]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: API key regenerated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 api_key:
   *                   type: string
   */
  // Regenerate API key
  app.post(
    "/api/auth/regenerate-key",
    authenticateToken,
    validateCsrfTokenMiddleware,
    (req, res) => {
      const newApiKey = "lv_" + uuidv4().replace(/-/g, "");
      db.prepare("UPDATE users SET api_key = ? WHERE id = ?").run(
        newApiKey,
        req.user.id,
      );
      audit.apiKeyRegenerate(req.user.id, req);
      res.json({ api_key: newApiKey });
    },
  );

  /**
   * @swagger
   * /auth/profile:
   *   put:
   *     summary: Update user profile
   *     tags: [Auth]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *     responses:
   *       200:
   *         description: Profile updated
   *       400:
   *         description: Email already in use
   */
  // Update profile
  app.put(
    "/api/auth/profile",
    authenticateToken,
    validateCsrfTokenMiddleware,
    validateBody(schemas.authProfile),
    (req, res) => {
      try {
        const { email } = req.validated;

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
        return reportAndSend(res, err, logger, "Update profile error");
      }
    },
  );

  /**
   * @swagger
   * /auth/password:
   *   put:
   *     summary: Change user password
   *     tags: [Auth]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [currentPassword, newPassword]
   *             properties:
   *               currentPassword:
   *                 type: string
   *               newPassword:
   *                 type: string
   *                 minLength: 6
   *     responses:
   *       200:
   *         description: Password changed successfully
   *       400:
   *         description: Incorrect current password or invalid new password
   */
  // Change password
  app.put(
    "/api/auth/password",
    authenticateToken,
    validateCsrfTokenMiddleware,
    validateBody(schemas.authPassword),
    async (req, res) => {
      try {
        const { currentPassword, newPassword } = req.validated;

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
        db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(
          req.user.id,
        );
        audit.passwordChange(req.user.id, req);
        const csrfToken = generateCsrfToken();
        res.cookie("csrfToken", csrfToken, {
          httpOnly: false,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
          maxAge: expiryToMs(JWT_REFRESH_EXPIRY),
          path: "/",
        });
        res.json({ success: true, csrfToken });
      } catch (err) {
        return reportAndSend(res, err, logger, "Change password error");
      }
    },
  );
}

module.exports = { setupAuthRoutes, createExampleBookmarks };
