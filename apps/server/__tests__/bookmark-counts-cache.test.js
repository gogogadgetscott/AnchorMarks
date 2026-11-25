const {
  getCachedCounts,
  setCachedCounts,
  invalidateUserCounts,
} = require("../services/bookmarkCountsCache");

describe("bookmarkCountsCache", () => {
  it("stores and reads counts per user", () => {
    const userId = "user-cache-1";
    const payload = { all: 10, favorites: 3 };
    setCachedCounts(userId, payload);
    expect(getCachedCounts(userId)).toEqual(payload);
  });

  it("invalidates counts for a user", () => {
    const userId = "user-cache-2";
    setCachedCounts(userId, { all: 5 });
    invalidateUserCounts(userId);
    expect(getCachedCounts(userId)).toBeNull();
  });
});
