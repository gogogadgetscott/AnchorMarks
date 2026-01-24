const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const app = require("./app");
const config = require("./config");
let version = "unknown";
try {
  // Attempt to load root package.json (may not be present in some container builds)
  // Resolve relative to this file to match previous behavior
  const pkg = require(path.join(__dirname, "..", "..", "package.json"));
  version = (pkg && pkg.version) || "unknown";
} catch {
  // Fallback: leave version as 'unknown' and continue
  console.warn("package.json not found, version unknown");
}

let server;
let usingSsl = false;
let httpRedirectServer = null;

if (config.SSL_ENABLED) {
  try {
    const key = fs.readFileSync(config.SSL_KEY);
    const cert = fs.readFileSync(config.SSL_CERT);
    server = https.createServer({ key, cert }, app);
    usingSsl = true;

    // Create HTTP server to redirect to HTTPS
    const httpRedirectPort =
      config.NODE_ENV === "production" ? 80 : parseInt(config.PORT) - 1;
    httpRedirectServer = http.createServer((req, res) => {
      const host =
        req.headers.host?.replace(`:${httpRedirectPort}`, `:${config.PORT}`) ||
        `localhost:${config.PORT}`;
      const redirectUrl = `https://${host}${req.url}`;
      res.writeHead(301, { Location: redirectUrl });
      res.end();
    });

    httpRedirectServer
      .listen(httpRedirectPort, config.HOST, () => {
        console.log(
          `HTTP → HTTPS redirect server running on port ${httpRedirectPort}`,
        );
      })
      .on("error", (err) => {
        if (err.code === "EADDRINUSE" || err.code === "EACCES") {
          console.log(
            `ℹ️  HTTP redirect port ${httpRedirectPort} not available (${err.code}), skipping redirect server`,
          );
        } else {
          console.warn(
            "⚠️  Failed to start HTTP redirect server:",
            err.message,
          );
        }
      });
  } catch (err) {
    console.warn(
      "⚠️  Failed to read SSL key/cert, falling back to HTTP:",
      err.message,
    );
    server = http.createServer(app);
    usingSsl = false;
  }
} else {
  server = http.createServer(app);
}

server.listen(config.PORT, config.HOST, () => {
  const lines = [];

  const protocol = usingSsl ? "https" : "http";
  const hostDisplay = (config.HOST === "0.0.0.0" || config.HOST === "::") ? "localhost" : config.HOST;
  const apiUrl = `${protocol}://${hostDisplay}:${config.PORT}/api`;
  const serverUrl = `${protocol}://${hostDisplay}:${config.PORT}`;

  // Gather config info
  try {
    lines.push(`AnchorMarks v${version || "unknown"}`);
  } catch {
    lines.push("AnchorMarks v(unknown)");
  }
  lines.push(`Server:                   ${serverUrl}`);
  lines.push(`API:                      ${apiUrl}`);
  lines.push(`Mode:                     ${config.NODE_ENV}`);

  // Confirm .env file location
  const envPath = path.join(__dirname, "..", "..", ".env");
  const envExists = fs.existsSync(envPath);
  lines.push(
    `ENV file:                 ${envPath} ${envExists ? "✓" : "✗ (not found)"}`,
  );

  lines.push(`SSL Enabled:              ${config.SSL_ENABLED ? "✓" : "✗"}`);

  // SSL configuration
  if (config.SSL_ENABLED) {
    const sslKeyExists = config.SSL_KEY && fs.existsSync(config.SSL_KEY);
    const sslCertExists = config.SSL_CERT && fs.existsSync(config.SSL_CERT);
    lines.push(
      `SSL Key:                  ${config.SSL_KEY || "(not set)"} ${sslKeyExists ? "✓" : "✗"}`,
    );
    lines.push(
      `SSL Cert:                 ${config.SSL_CERT || "(not set)"} ${sslCertExists ? "✓" : "✗"}`,
    );
  }

  const dbExists = config.DB_PATH && fs.existsSync(config.DB_PATH);
  lines.push(
    `Database:                 ${config.DB_PATH || "(not set)"} ${dbExists ? "✓" : "✗"}`,
  );
  lines.push(
    `Background jobs:          ${config.ENABLE_BACKGROUND_JOBS ? "enabled" : "disabled"}`,
  );
  lines.push(
    `Favicon background jobs:  ${config.ENABLE_FAVICON_BACKGROUND_JOBS ? "enabled" : "disabled"}`,
  );

  // AI config
  try {
    const ai = config.getAIConfig();
    const aiProvider = ai.provider || "none";
    const aiModel = ai.model || "-";
    lines.push(
      `AI:                       ${aiProvider}${aiProvider !== "none" ? ` (${aiModel})` : ""}`,
    );
  } catch {
    lines.push(`AI:                       (error reading config)`);
  }

  // CORS origin
  try {
    const cors = config.resolveCorsOrigin();
    if (Array.isArray(cors))
      lines.push(`CORS allowed origins:     ${cors.join(", ")}`);
    else lines.push(`CORS allowed origins:     ${String(cors)}`);
  } catch {
    lines.push(`CORS allowed origins:     (invalid in production)`);
  }

  // JWT secret status (don't print the secret)
  const jwtEnv = process.env.JWT_SECRET;
  let jwtStatus = "not set (using fallback)";
  if (jwtEnv) jwtStatus = "set";
  if (config.NODE_ENV === "production" && (!jwtEnv || jwtEnv.length < 20)) {
    jwtStatus = "WARNING: insecure or missing (set JWT_SECRET in env)";
  }
  lines.push(`JWT secret:               ${jwtStatus}`);

  // Format box
  const maxWidth = Math.max(...lines.map((l) => l.length)) + 4;
  const hr = "═".repeat(maxWidth);
  console.log(`\n╔${hr}╗`);
  lines.forEach((l) => {
    const padded = l.padEnd(maxWidth - 4);
    console.log(`║  ${padded}  ║`);
  });
  console.log(`╚${hr}╝\n`);
});

module.exports = app;
