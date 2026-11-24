const http = require("http");
const https = require("https");
const net = require("net");
const config = require("../config");
const { isPrivateAddress, resolveToPublicIp } = require("../utils/ssrfUtils");

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 8000;

function statusForResponse(statusCode, redirected) {
  if (statusCode >= 200 && statusCode < 300) {
    return redirected ? "redirect" : "ok";
  }
  if (statusCode === 401 || statusCode === 403 || statusCode === 429) {
    return "blocked";
  }
  return "dead";
}

async function requestOnce(url, method) {
  let parsed;
  try {
    parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { status: "dead", httpCode: null, error: "invalid-url" };
    }
  } catch {
    return { status: "dead", httpCode: null, error: "invalid-url" };
  }

  if (
    config.NODE_ENV !== "test" &&
    (await isPrivateAddress(parsed.toString()))
  ) {
    return { status: "blocked", httpCode: null, error: "private-address" };
  }

  let pinnedIp = null;
  if (config.NODE_ENV === "production") {
    try {
      pinnedIp = await resolveToPublicIp(parsed.hostname);
    } catch {
      return { status: "blocked", httpCode: null, error: "private-address" };
    }
  }

  return new Promise((resolve) => {
    const transport = parsed.protocol === "https:" ? https : http;
    const headers = {
      "User-Agent": "AnchorMarks-LinkChecker/1.0",
      Accept: "*/*",
      Host: parsed.host,
    };
    const options = {
      method,
      hostname: pinnedIp || parsed.hostname,
      port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers,
      timeout: REQUEST_TIMEOUT_MS,
      ...(parsed.protocol === "https:" ? { servername: parsed.hostname } : {}),
    };

    if (pinnedIp) {
      options.lookup = (_hostname, opts, callback) => {
        const family = net.isIP(pinnedIp);
        if (opts?.all) callback(null, [{ address: pinnedIp, family }]);
        else callback(null, pinnedIp, family);
      };
    }

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const req = transport.request(options, (res) => {
      res.resume();
      finish({
        statusCode: res.statusCode,
        location: res.headers.location,
      });
    });
    req.on("error", (error) => {
      const code = error?.code;
      finish({
        status: code === "ETIMEDOUT" ? "timeout" : "dead",
        httpCode: null,
        error: code || "connection-failed",
      });
    });
    req.on("timeout", () => {
      req.destroy();
      finish({
        status: "timeout",
        httpCode: null,
        error: "timeout",
      });
    });
    req.end();
  });
}

async function checkUrlHealth(inputUrl) {
  let url = inputUrl;
  let redirected = false;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    let result = await requestOnce(url, "HEAD");
    if (result.status) return result;

    if (result.statusCode === 405 || result.statusCode === 501) {
      result = await requestOnce(url, "GET");
      if (result.status) return result;
    }

    if (
      result.statusCode >= 300 &&
      result.statusCode < 400 &&
      result.location
    ) {
      try {
        url = new URL(result.location, url).toString();
        redirected = true;
        continue;
      } catch {
        return {
          status: "dead",
          httpCode: result.statusCode,
          error: "invalid-redirect",
        };
      }
    }

    return {
      status: statusForResponse(result.statusCode, redirected),
      httpCode: result.statusCode,
      redirected,
      finalUrl: url,
    };
  }

  return {
    status: "redirect",
    httpCode: 302,
    redirected: true,
    error: "too-many-redirects",
  };
}

module.exports = {
  checkUrlHealth,
  statusForResponse,
};
