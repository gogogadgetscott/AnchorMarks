/**
 * bookmarkUpdate schema tests: the update path previously accepted any
 * string as a url (create required http/https/bookmark-view), so
 * `javascript:` URLs could be injected through PATCH/PUT of an existing
 * bookmark. The update schema now applies the same rule as create.
 */
const { bookmarkUpdate, bookmarkCreate } = require("../validation/schemas");

describe("bookmarkUpdate.url validation", () => {
  it("accepts http and https urls", () => {
    expect(
      bookmarkUpdate.safeParse({ url: "https://example.com/page" }).success,
    ).toBe(true);
    expect(
      bookmarkUpdate.safeParse({ url: "http://example.com" }).success,
    ).toBe(true);
  });

  it("accepts the bookmark-view app protocol", () => {
    expect(
      bookmarkUpdate.safeParse({ url: "bookmark-view://open/42" }).success,
    ).toBe(true);
  });

  it("rejects javascript: urls", () => {
    const result = bookmarkUpdate.safeParse({
      url: "javascript:alert(document.cookie)",
    });
    expect(result.success).toBe(false);
  });

  it("rejects data: urls", () => {
    const result = bookmarkUpdate.safeParse({
      url: "data:text/html;base64,PHNjcmlwdD4=",
    });
    expect(result.success).toBe(false);
  });

  it("rejects other non-web schemes", () => {
    expect(
      bookmarkUpdate.safeParse({ url: "file:///etc/passwd" }).success,
    ).toBe(false);
    expect(
      bookmarkUpdate.safeParse({ url: "vbscript:msgbox(1)" }).success,
    ).toBe(false);
  });

  it("allows omitting url (partial update) and treats empty string as omitted", () => {
    expect(bookmarkUpdate.safeParse({ title: "New title" }).success).toBe(true);
    expect(bookmarkUpdate.safeParse({ url: "" }).success).toBe(true);
  });

  it("still accepts a plain title-only update alongside a valid url", () => {
    const result = bookmarkUpdate.safeParse({
      title: "Renamed",
      url: "https://example.com",
      is_favorite: true,
    });
    expect(result.success).toBe(true);
  });

  it("applies the same url rules as bookmarkCreate", () => {
    expect(
      bookmarkCreate.safeParse({ url: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(
      bookmarkCreate.safeParse({ url: "https://ok.example" }).success,
    ).toBe(true);
  });
});
