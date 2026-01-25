import { describe, it, expect } from "vitest";
import { UserProfile } from "./UserProfile";

describe("UserProfile", () => {
  it("renders default profile info", () => {
    const html = UserProfile();

    expect(html).toContain("User");
    expect(html).toContain("Free Plan");
    expect(html).toContain("header-user-avatar");
    expect(html).toContain("header-user-dropdown");
  });

  it("supports custom user details and classes", () => {
    const html = UserProfile({
      name: "Ada Lovelace",
      avatarChar: "A",
      plan: "Pro",
      className: "extra-class",
    });

    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("Pro");
    expect(html).toContain("extra-class");
    expect(html).toContain(">A<");
  });
});
