const fs = require("fs");
const http = require("http");
const https = require("https");
const app = require("./app");
const config = require("./config");
const { version } = require("../../package.json");

let server;
let usingSsl = false;
if (config.SSL_ENABLED) {
    try {
        const key = fs.readFileSync(config.SSL_KEY);
        const cert = fs.readFileSync(config.SSL_CERT);
        server = https.createServer({ key, cert }, app);
        usingSsl = true;
    } catch (err) {
        console.warn("⚠️  Failed to read SSL key/cert, falling back to HTTP:", err.message);
        server = http.createServer(app);
        usingSsl = false;
    }
} else {
    server = http.createServer(app);
}

server.listen(config.PORT, config.HOST, () => {
    const lines = [];

    const protocol = usingSsl ? "https" : "http";
    const hostDisplay = config.HOST === "0.0.0.0" ? "localhost" : config.HOST;
    const apiUrl = `${protocol}://${hostDisplay}:${config.PORT}/api`;
    const serverUrl = `${protocol}://${hostDisplay}:${config.PORT}`;

    // Gather config info
    try {
        lines.push(`AnchorMarks v${version || "unknown"}`);
    } catch (e) {
        lines.push("AnchorMarks v(unknown)");
    }
    lines.push(`Server: ${serverUrl}`);
    lines.push(`API:    ${apiUrl}`);
    lines.push(`Mode:   ${config.NODE_ENV}`);
    lines.push(`Database: ${config.DB_PATH}`);
    lines.push(
        `Background jobs: ${config.ENABLE_BACKGROUND_JOBS ? "enabled" : "disabled"}`,
    );
    lines.push(
        `Favicon background jobs: ${config.ENABLE_FAVICON_BACKGROUND_JOBS ? "enabled" : "disabled"}`,
    );

    // AI config
    try {
        const ai = config.getAIConfig();
        const aiProvider = ai.provider || "none";
        const aiModel = ai.model || "-";
        lines.push(`AI: ${aiProvider}${aiProvider !== "none" ? ` (${aiModel})` : ""}`);
    } catch (e) {
        lines.push(`AI: (error reading config)`);
    }

    // CORS origin
    try {
        const cors = config.resolveCorsOrigin();
        if (Array.isArray(cors)) lines.push(`CORS allowed origins: ${cors.join(", ")}`);
        else lines.push(`CORS allowed origins: ${String(cors)}`);
    } catch (e) {
        lines.push(`CORS allowed origins: (invalid in production)`);
    }

    // JWT secret status (don't print the secret)
    const jwtEnv = process.env.JWT_SECRET;
    let jwtStatus = "not set (using fallback)";
    if (jwtEnv) jwtStatus = "set";
    if (config.NODE_ENV === "production" && (!jwtEnv || jwtEnv.length < 20)) {
        jwtStatus = "WARNING: insecure or missing (set JWT_SECRET in env)";
    }
    lines.push(`JWT secret: ${jwtStatus}`);

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
