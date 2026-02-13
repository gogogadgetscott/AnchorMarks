const http = require("http");
const https = require("https");
const { parseHtmlMetadata } = require("./html");

const config = require("../config");
const { isPrivateAddress } = require("./utils.js");

async function fetchUrlMetadata(url, redirectCount = 0) {
  if (redirectCount > 5) {
    throw new Error("Too many redirects");
  }

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const options = {
      timeout: 5000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    };

    const request = protocol.get(url, options, (response) => {
      // Follow redirects
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        try {
          const redirectUrl = new URL(
            response.headers.location,
            url,
          ).toString();
          return fetchUrlMetadata(redirectUrl, redirectCount + 1)
            .then(resolve)
            .catch(reject);
        } catch (e) {
          return reject(e);
        }
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode}`));
      }

      const contentType = response.headers["content-type"] || "";
      if (!contentType.includes("text/html")) {
        return resolve({
          title: new URL(url).hostname,
          description: "",
          url: url,
        });
      }

      let html = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        html += chunk;
        if (html.length > 2000000) {
          response.destroy();
          reject(new Error("HTML content too large"));
          return;
        }
      });

      response.on("end", async () => {
        try {
          // SSRF guard in production
          if (
            config.NODE_ENV === "production" &&
            (await isPrivateAddress(url))
          ) {
            return resolve(null);
          }
          const metadata = parseHtmlMetadata(html, url);
          resolve(metadata);
        } catch (e) {
          reject(e);
        }
      });
    });

    request.on("error", (err) => {
      reject(err);
    });

    request.on("timeout", () => {
      request.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

function detectContentType(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;

    if (
      hostname.includes("youtube.com") ||
      hostname.includes("youtu.be") ||
      hostname.includes("vimeo.com") ||
      hostname.includes("dailymotion.com") ||
      hostname.includes("twitch.tv")
    ) {
      return "video";
    }

    if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
      return "tweet";
    }

    if (pathname.endsWith(".pdf")) return "pdf";

    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(pathname)) return "image";

    if (hostname.includes("github.com")) return "repo";

    if (
      hostname.includes("medium.com") ||
      hostname.includes("dev.to") ||
      hostname.includes("substack.com") ||
      hostname.includes("hackernews") ||
      hostname.includes("reddit.com")
    ) {
      return "article";
    }

    if (
      hostname.includes("docs.") ||
      pathname.includes("/docs/") ||
      pathname.includes("/documentation/")
    ) {
      return "docs";
    }

    return "link";
  } catch {
    return "link";
  }
}

module.exports = { fetchUrlMetadata, detectContentType };
