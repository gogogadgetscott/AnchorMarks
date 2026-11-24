const { canonicalizeUrl, similarity } = require("../utils/urlCanonicalizer");

describe("URL canonicalizer", () => {
  it("normalizes hosts, default ports, tracking parameters, and trailing slashes", () => {
    expect(
      canonicalizeUrl(
        "HTTP://www.Example.com:80/docs/?utm_source=test&b=2&a=1#section",
      ),
    ).toBe("http://example.com/docs?a=1&b=2");
  });

  it("rejects unsupported protocols", () => {
    expect(canonicalizeUrl("bookmark-view:missing")).toBeNull();
  });

  it("detects highly similar titles", () => {
    expect(
      similarity("Complete React Guide", "Complete React Guides"),
    ).toBeGreaterThan(0.92);
  });
});
