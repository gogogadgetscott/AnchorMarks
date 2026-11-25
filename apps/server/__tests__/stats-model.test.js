const statsModel = require("../models/stats");

describe("stats model performance behavior", () => {
  it("computes monthly growth with a single grouped query", () => {
    const all = vi.fn().mockReturnValue([]);
    const db = {
      prepare: vi.fn().mockReturnValue({ all }),
    };

    const result = statsModel.getMonthlyGrowth(db, "user-1");

    expect(db.prepare).toHaveBeenCalledTimes(1);
    expect(all).toHaveBeenCalledWith("user-1");
    expect(result).toHaveLength(6);
    expect(result.every((entry) => typeof entry.month === "string")).toBe(true);
    expect(result.every((entry) => typeof entry.count === "number")).toBe(true);
  });

  it("skips title-similarity duplicate grouping in fast mode", () => {
    const rows = [
      {
        id: "a",
        user_id: "user-1",
        title: "How to Brew Coffee at Home",
        url: "https://example.com/guide-a",
        created_at: "2026-01-01T00:00:00.000Z",
        tags: "",
      },
      {
        id: "b",
        user_id: "user-1",
        title: "How to brew coffee at home",
        url: "https://example.com/guide-b",
        created_at: "2026-01-02T00:00:00.000Z",
        tags: "",
      },
    ];
    const db = {
      prepare: vi.fn().mockReturnValue({ all: vi.fn().mockReturnValue(rows) }),
    };

    const fullGroups = statsModel.findDuplicates(db, "user-1");
    const fastGroups = statsModel.findDuplicates(db, "user-1", {
      includeTitleMatches: false,
    });

    expect(fullGroups.some((group) => group.match_type === "title")).toBe(true);
    expect(fastGroups.some((group) => group.match_type === "title")).toBe(
      false,
    );
  });
});
