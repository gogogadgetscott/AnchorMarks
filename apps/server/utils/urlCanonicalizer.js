const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "dclid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "ref",
  "source",
]);

function canonicalizeUrl(input) {
  try {
    const url = new URL(String(input));
    if (!["http:", "https:"].includes(url.protocol)) return null;

    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hash = "";
    url.username = "";
    url.password = "";

    if (
      (url.protocol === "http:" && url.port === "80") ||
      (url.protocol === "https:" && url.port === "443")
    ) {
      url.port = "";
    }

    [...url.searchParams.keys()].forEach((key) => {
      if (
        TRACKING_PARAMS.has(key.toLowerCase()) ||
        key.toLowerCase().startsWith("utm_")
      ) {
        url.searchParams.delete(key);
      }
    });
    url.searchParams.sort();

    let pathname = url.pathname || "/";
    pathname = pathname.replace(/\/+/g, "/");
    if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "");
    url.pathname = pathname;

    return url.toString();
  } catch {
    return null;
  }
}

function normalizeTitle(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function similarity(a, b) {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const matrix = Array.from({ length: left.length + 1 }, () =>
    new Array(right.length + 1).fill(0),
  );
  for (let i = 0; i <= left.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= left.length; i++) {
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  const distance = matrix[left.length][right.length];
  return 1 - distance / Math.max(left.length, right.length);
}

module.exports = { canonicalizeUrl, normalizeTitle, similarity };
