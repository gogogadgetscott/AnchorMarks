const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const dns = require("dns").promises;
const net = require("net");

// Network safety helpers
const PRIVATE_IPV4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
];
const PRIVATE_IPV6 = [/^fc/i, /^fd/i, /^fe80/i, /^::1$/];

function isPrivateIp(ip) {
  if (!ip) return false;
  if (net.isIP(ip) === 6) return PRIVATE_IPV6.some((re) => re.test(ip));
  return PRIVATE_IPV4.some((re) => re.test(ip));
}

async function isPrivateAddress(url) {
  try {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) return true; // Disallow non-http(s)

    const hostname =
      urlObj.hostname.startsWith("[") && urlObj.hostname.endsWith("]")
        ? urlObj.hostname.slice(1, -1)
        : urlObj.hostname;
    if (hostname === "localhost") return true;
    if (net.isIP(hostname)) return isPrivateIp(hostname);

    const records = await dns.lookup(hostname, { all: true });
    return records.some((r) => isPrivateIp(r.address));
  } catch {
    // If resolution fails, be conservative in production
    return process.env.NODE_ENV === "production";
  }
}

// Resolves a hostname to a verified public IP, eliminating the TOCTOU window
// between isPrivateAddress() and the actual HTTP connection (DNS rebinding).
// Throws if the hostname resolves only to private/loopback addresses.
async function resolveToPublicIp(hostname) {
  const bare =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;

  if (bare === "localhost") throw new Error("Hostname resolves to private address");
  if (net.isIP(bare)) {
    if (isPrivateIp(bare)) throw new Error("Hostname resolves to private address");
    return bare;
  }

  const records = await dns.lookup(bare, { all: true });
  const pub = records.find((r) => !isPrivateIp(r.address));
  if (!pub) throw new Error("Hostname resolves to private address");
  return pub.address;
}

// Cache for in-progress favicon fetches
const faviconFetchQueue = new Map();

async function fetchFavicon(url, bookmarkId, db, FAVICONS_DIR, NODE_ENV, userId) {
  try {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) return null;

    // Block private/loopback targets to avoid SSRF
    if (await isPrivateAddress(url)) {
      return null;
    }
    const domain = urlObj.hostname;
    const faviconFilename = `${domain.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
    const localPath = path.join(FAVICONS_DIR, faviconFilename);
    const publicPath = `/favicons/${faviconFilename}`;

    const updateFavicon = (pathVal) => {
      if (userId != null) {
        db.prepare(
          "UPDATE bookmarks SET favicon_local = ?, favicon = ? WHERE id = ? AND user_id = ?",
        ).run(pathVal, pathVal, bookmarkId, userId);
      } else {
        db.prepare(
          "UPDATE bookmarks SET favicon_local = ?, favicon = ? WHERE id = ?",
        ).run(pathVal, pathVal, bookmarkId);
      }
    };

    // Check if already cached locally
    if (fs.existsSync(localPath)) {
      updateFavicon(publicPath);
      return publicPath;
    }

    // In tests we avoid network activity, but still allow cached favicons above.
    if (NODE_ENV === "test") return null;

    // Check if already being fetched
    if (faviconFetchQueue.has(domain)) {
      return faviconFetchQueue.get(domain);
    }

    // Create fetch promise
    const fetchPromise = new Promise((resolve) => {
      // Try multiple favicon sources
      const sources = [
        `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
        `https://icons.duckduckgo.com/ip3/${domain}.ico`,
        `https://${domain}/favicon.ico`,
      ];

      tryFetchFavicon(sources, 0, localPath, (success) => {
        faviconFetchQueue.delete(domain);
        if (success) {
          updateFavicon(publicPath);
          resolve(publicPath);
        } else {
          resolve(null);
        }
      });
    });

    faviconFetchQueue.set(domain, fetchPromise);
    return fetchPromise;
  } catch {
    return null;
  }
}

function tryFetchFavicon(sources, index, localPath, callback) {
  if (index >= sources.length) {
    callback(false);
    return;
  }

  const source = sources[index];
  const protocol = source.startsWith("https") ? https : http;

  const req = protocol.get(source, { timeout: 5000 }, (res) => {
    if (res.statusCode !== 200) {
      tryFetchFavicon(sources, index + 1, localPath, callback);
      return;
    }

    const fileStream = fs.createWriteStream(localPath);
    res.pipe(fileStream);

    fileStream.on("finish", () => {
      fileStream.close();
      callback(true);
    });

    fileStream.on("error", () => {
      tryFetchFavicon(sources, index + 1, localPath, callback);
    });
  });

  req.on("error", () => {
    tryFetchFavicon(sources, index + 1, localPath, callback);
  });

  req.on("timeout", () => {
    req.destroy();
    tryFetchFavicon(sources, index + 1, localPath, callback);
  });
}

module.exports = {
  isPrivateAddress,
  resolveToPublicIp,
  fetchFavicon,
};
