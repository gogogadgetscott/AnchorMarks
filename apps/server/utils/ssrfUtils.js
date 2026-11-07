const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const dns = require("dns").promises;
const net = require("net");

// Network safety helpers
const PRIVATE_IPV4 = [
  /^0\./, // 0.0.0.0/8 — 0.0.0.0 routes to localhost on Linux
  /^10\./, // 10.0.0.0/8
  /^127\./, // 127.0.0.0/8 loopback
  /^169\.254\./, // 169.254.0.0/16 link-local (cloud metadata lives here)
  /^172\.(1[6-9]|2\d|3[0-1])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  // 100.64.0.0/10 CGNAT — commonly used for internal cloud services
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];
const PRIVATE_IPV6 = [
  /^fc/i, // fc00::/7 unique local
  /^fd/i,
  /^fe[89ab]/i, // fe80::/10 link-local (fe80–febf)
  /^fec0/i, // fec0::/10 site-local (deprecated but still routed internally)
  /^::1$/i, // loopback
  /^::$/i, // unspecified
];

// Expand an IPv6 address into 8 groups of 4 lowercase hex digits, or null if
// unparseable. Bracket and zone-index decorations are tolerated.
function expandIpv6Groups(ip) {
  let addr = String(ip).trim().toLowerCase();
  addr = addr.replace(/^\[/, "").replace(/\]$/, "");
  const zone = addr.indexOf("%");
  if (zone !== -1) addr = addr.slice(0, zone);

  // Trailing dotted IPv4 (::ffff:127.0.0.1) → rewrite as two hex groups.
  // NOTE: the WHATWG URL parser normalises IPv4-mapped literals to the hex
  // form ([::ffff:127.0.0.1] → [::ffff:7f00:1]), so the hex branch below is
  // the one that actually protects URL-derived hostnames.
  if (addr.includes(".")) {
    const idx = addr.lastIndexOf(":");
    if (idx === -1) return null;
    const octets = addr.slice(idx + 1).split(".");
    if (octets.length !== 4) return null;
    const nums = octets.map((o) => Number(o));
    if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const hi = (((nums[0] << 8) | nums[1]) >>> 0).toString(16);
    const lo = (((nums[2] << 8) | nums[3]) >>> 0).toString(16);
    addr = `${addr.slice(0, idx)}:${hi}:${lo}`;
  }

  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  if (halves.length === 2) {
    // "::" must stand for at least one zero group
    if (8 - head.length - tail.length < 1) return null;
  } else if (head.length !== 8) {
    return null;
  }
  const groups = [
    ...head,
    ...Array(halves.length === 2 ? 8 - head.length - tail.length : 0).fill("0"),
    ...tail,
  ];
  if (groups.length !== 8) return null;
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => g.padStart(4, "0"));
}

// If an IPv6 address embeds an IPv4 address (IPv4-mapped ::ffff:a.b.c.d,
// IPv4-translated ::ffff:0:a.b.c.d, or deprecated IPv4-compatible ::a.b.c.d),
// return it in dotted form so the IPv4 rules apply — otherwise ::ffff:7f00:1
// (which URL parsing produces for [::ffff:127.0.0.1]) bypasses every check.
function embeddedIpv4(groups) {
  const allZero = (arr) => arr.every((g) => g === "0000");
  const isMapped = allZero(groups.slice(0, 5)) && groups[5] === "ffff";
  const isTranslated =
    allZero(groups.slice(0, 4)) && groups[4] === "ffff" && groups[5] === "0000";
  const isCompatible = allZero(groups.slice(0, 6));
  if (!isMapped && !isTranslated && !isCompatible) return null;

  const hi = parseInt(groups[6], 16);
  const lo = parseInt(groups[7], 16);
  return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff].join(".");
}

function isPrivateIp(ip) {
  if (!ip) return false;
  const addr = String(ip).trim().replace(/^\[/, "").replace(/\]$/, "");
  const version = net.isIP(addr);
  if (version === 4) return PRIVATE_IPV4.some((re) => re.test(addr));
  if (version === 6) {
    const groups = expandIpv6Groups(addr);
    if (groups) {
      const embedded = embeddedIpv4(groups);
      if (embedded) return isPrivateIp(embedded);
    }
    return PRIVATE_IPV6.some((re) => re.test(addr));
  }
  return false; // unparseable → callers decide how to treat it
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

  if (bare === "localhost")
    throw new Error("Hostname resolves to private address");
  if (net.isIP(bare)) {
    if (isPrivateIp(bare))
      throw new Error("Hostname resolves to private address");
    return bare;
  }

  const records = await dns.lookup(bare, { all: true });
  const pub = records.find((r) => !isPrivateIp(r.address));
  if (!pub) throw new Error("Hostname resolves to private address");
  return pub.address;
}

// Cache for in-progress favicon fetches
const faviconFetchQueue = new Map();

async function fetchFavicon(
  url,
  bookmarkId,
  db,
  FAVICONS_DIR,
  NODE_ENV,
  userId,
) {
  try {
    const urlObj = new URL(url);
    if (!["http:", "https:"].includes(urlObj.protocol)) return null;

    // Resolve hostname to a verified public IP to prevent DNS-rebinding attacks.
    // resolveToPublicIp throws if the hostname resolves only to private addresses.
    // The resolved IP is also *pinned* into the actual request below so the
    // connection cannot re-resolve to a different (private) address (TOCTOU).
    let pinnedIp = null;
    try {
      pinnedIp = await resolveToPublicIp(urlObj.hostname);
    } catch {
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
      // Try multiple favicon sources. Only the last source talks to the
      // bookmark's own host, so only that one is pinned to the verified IP;
      // the Google/DuckDuckGo sources must resolve on their own.
      const sources = [
        { url: `https://www.google.com/s2/favicons?domain=${domain}&sz=64` },
        { url: `https://icons.duckduckgo.com/ip3/${domain}.ico` },
        { url: `https://${domain}/favicon.ico`, pinnedIp },
      ];

      let finished = false;
      const done = (success) => {
        if (finished) return; // guard against double-completion
        finished = true;
        faviconFetchQueue.delete(domain);
        if (success) {
          try {
            updateFavicon(publicPath);
          } catch {
            // DB write failed (e.g. shutdown) — the file on disk is still
            // usable; never let a SQLite throw escape an event callback
            // (it would be an uncaughtException).
          }
          resolve(publicPath);
        } else {
          resolve(null);
        }
      };

      tryFetchFavicon(sources, 0, localPath, done);
    });

    faviconFetchQueue.set(domain, fetchPromise);
    return fetchPromise;
  } catch {
    return null;
  }
}

function unlinkQuiet(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore — file may not exist
  }
}

function tryFetchFavicon(sources, index, localPath, callback) {
  if (index >= sources.length) {
    callback(false);
    return;
  }

  const source = sources[index];
  const protocol = source.url.startsWith("https") ? https : http;

  // Each level may advance to the next source exactly once. Without this,
  // a timeout (destroy → 'error') plus the explicit timeout handler started
  // two parallel fetch chains and completed the callback twice.
  let advanced = false;
  const advance = () => {
    if (advanced) return;
    advanced = true;
    tryFetchFavicon(sources, index + 1, localPath, callback);
  };

  const options = { timeout: 5000 };
  if (source.pinnedIp) {
    // Connect to the IP we already verified while keeping the hostname for
    // the Host header and TLS SNI/certificate verification.
    options.lookup = (_hostname, opts, cb) => {
      const family = net.isIP(source.pinnedIp);
      if (opts && opts.all) cb(null, [{ address: source.pinnedIp, family }]);
      else cb(null, source.pinnedIp, family);
    };
  }

  const req = protocol.get(source.url, options, (res) => {
    if (res.statusCode !== 200) {
      res.resume(); // drain so the socket can be reused/closed
      advance();
      return;
    }

    const fileStream = fs.createWriteStream(localPath);

    res.on("error", () => {
      fileStream.destroy();
      unlinkQuiet(localPath);
      advance();
    });
    res.pipe(fileStream);

    fileStream.on("finish", () => {
      fileStream.close();
      if (advanced) {
        // A timeout/error already moved on to the next source; discard the
        // late write so a partial file never masquerades as a cached favicon.
        unlinkQuiet(localPath);
        return;
      }
      advanced = true;
      callback(true);
    });

    fileStream.on("error", () => {
      unlinkQuiet(localPath);
      advance();
    });
  });

  req.on("error", advance);

  req.on("timeout", () => {
    req.destroy();
    advance();
  });
}

module.exports = {
  isPrivateIp,
  isPrivateAddress,
  resolveToPublicIp,
  fetchFavicon,
};
