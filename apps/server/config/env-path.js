/**
 * Resolve the path to the .env file.
 *
 * On a normal host install the file lives at the repository root
 * (two levels above apps/server/).  Inside Docker the compose file
 * mounts it at /apps/.env.  We try both and return the first that
 * exists, falling back to the host path so dotenv silently no-ops
 * when there is no file at all.
 */

const path = require("path");
const fs = require("fs");

// Repository-root relative to apps/server/
const hostPath = path.join(__dirname, "..", "..", ".env");
// Docker-compose mount point
const dockerPath = "/apps/.env";

const envPath = fs.existsSync(hostPath)
  ? hostPath
  : fs.existsSync(dockerPath)
    ? dockerPath
    : hostPath; // default — dotenv will silently skip if missing

module.exports = envPath;
