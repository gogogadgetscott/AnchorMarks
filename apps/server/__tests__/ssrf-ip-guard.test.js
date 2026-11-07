/**
 * SSRF IP-guard tests.
 *
 * IPv4 addresses can be smuggled inside IPv6 literals. The WHATWG URL parser
 * even rewrites dotted forms to hex: new URL("http://[::ffff:127.0.0.1]/")
 * yields the hostname "[::ffff:7f00:1]". A dotted-only check therefore let
 * loopback and RFC1918 targets slip through — these tests pin the full set.
 */
const {
  isPrivateIp,
  isPrivateAddress,
  resolveToPublicIp,
} = require("../utils/ssrfUtils");

describe("isPrivateIp — IPv4 special ranges", () => {
  it("treats 0.0.0.0/8 as private (routes to localhost on Linux)", () => {
    expect(isPrivateIp("0.0.0.0")).toBe(true);
    expect(isPrivateIp("0.1.2.3")).toBe(true);
  });

  it("treats CGNAT 100.64.0.0/10 as private", () => {
    expect(isPrivateIp("100.64.0.1")).toBe(true);
    expect(isPrivateIp("100.100.100.100")).toBe(true);
    expect(isPrivateIp("100.127.255.255")).toBe(true);
  });

  it("does not over-block neighbours of the CGNAT range", () => {
    expect(isPrivateIp("100.63.255.255")).toBe(false);
    expect(isPrivateIp("100.128.0.1")).toBe(false);
  });

  it("keeps the RFC1918 and loopback ranges", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("169.254.169.254")).toBe(true); // cloud metadata
  });

  it("allows public IPv4", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("172.32.0.1")).toBe(false);
    expect(isPrivateIp("93.184.216.34")).toBe(false);
  });
});

describe("isPrivateIp — IPv6 forms that embed IPv4", () => {
  it("detects IPv4-mapped IPv6 in dotted form (dns.lookup output)", () => {
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:10.0.0.5")).toBe(true);
    expect(isPrivateIp("::ffff:192.168.1.1")).toBe(true);
    expect(isPrivateIp("::ffff:169.254.169.254")).toBe(true);
  });

  it("detects IPv4-mapped IPv6 in hex form (WHATWG URL normalisation)", () => {
    expect(isPrivateIp("::ffff:7f00:1")).toBe(true); // 127.0.0.1
    expect(isPrivateIp("::ffff:a00:5")).toBe(true); // 10.0.0.5
    expect(isPrivateIp("::ffff:c0a8:101")).toBe(true); // 192.168.1.1
  });

  it("detects IPv4-translated and IPv4-compatible forms", () => {
    expect(isPrivateIp("::ffff:0:7f00:1")).toBe(true);
    expect(isPrivateIp("::7f00:1")).toBe(true);
    expect(isPrivateIp("::127.0.0.1")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("::")).toBe(true);
  });

  it("allows public addresses embedded in IPv6", () => {
    expect(isPrivateIp("::ffff:8.8.8.8")).toBe(false);
    expect(isPrivateIp("::ffff:808:808")).toBe(false);
  });

  it("keeps the native IPv6 private ranges", () => {
    expect(isPrivateIp("fc00::1")).toBe(true);
    expect(isPrivateIp("fd12:3456::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
    expect(isPrivateIp("febf::1")).toBe(true);
    expect(isPrivateIp("fec0::1")).toBe(true);
    expect(isPrivateIp("2001:4860:4860::8888")).toBe(false);
  });

  it("returns false for garbage input instead of throwing", () => {
    expect(isPrivateIp("")).toBe(false);
    expect(isPrivateIp(null)).toBe(false);
    expect(isPrivateIp("not-an-ip")).toBe(false);
  });
});

describe("isPrivateAddress — URL literals normalised by the URL parser", () => {
  it("rejects loopback hidden in mapped IPv6 literals", async () => {
    await expect(isPrivateAddress("http://[::ffff:127.0.0.1]/")).resolves.toBe(
      true,
    );
    await expect(isPrivateAddress("http://[::7f00:1]/")).resolves.toBe(true);
    await expect(
      isPrivateAddress("http://[::ffff:0:127.0.0.1]/"),
    ).resolves.toBe(true);
    await expect(isPrivateAddress("http://[0:0:0:0:0:0:0:1]/")).resolves.toBe(
      true,
    );
  });

  it("allows a public address with a mapped-IPv6-style literal", async () => {
    await expect(isPrivateAddress("http://[::ffff:8.8.8.8]/")).resolves.toBe(
      false,
    );
  });
});

describe("resolveToPublicIp", () => {
  it("rejects loopback literals in every embedded form", async () => {
    await expect(resolveToPublicIp("[::ffff:127.0.0.1]")).rejects.toThrow(
      "private address",
    );
    await expect(resolveToPublicIp("::ffff:7f00:1")).rejects.toThrow(
      "private address",
    );
    await expect(resolveToPublicIp("127.0.0.1")).rejects.toThrow(
      "private address",
    );
  });

  it("returns a public IP literal unchanged", async () => {
    await expect(resolveToPublicIp("8.8.8.8")).resolves.toBe("8.8.8.8");
  });
});
