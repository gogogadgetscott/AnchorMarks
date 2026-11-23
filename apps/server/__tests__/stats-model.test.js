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
});
