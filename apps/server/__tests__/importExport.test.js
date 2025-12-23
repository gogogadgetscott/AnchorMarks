const { importJson } = require("../models/importExport");

// Mock specific database responses
const mockDb = () => {
  const db = {
    prepare: jest.fn(() => {
      // Return a mock statement
      return {
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn(),
      };
    }),
  };
  return db;
};

describe("importJson", () => {
  let db;
  const userId = 1;

  beforeEach(() => {
    db = mockDb();
  });

  test("should insert a new bookmark if it does not exist", () => {
    const bookmarks = [
      {
        url: "https://example.com",
        title: "Example",
      },
    ];

    // Mock "existing" check to return undefined (not found)
    const getMock = jest.fn();
    getMock.mockReturnValueOnce(undefined); // First check: no tag check in snippet, but existing bookmark check

    // We need to carefully mock prepare() to distinguish calls if possible,
    // or just assume order.
    // The code calls prepare("SELECT id FROM bookmarks ...").get(...)
    // Then prepare("INSERT INTO ...").run(...)

    // Simplest way is to define default behaviors for the statement object
    const stmt = {
      get: jest.fn(),
      run: jest.fn(),
    };
    db.prepare.mockReturnValue(stmt);

    // Mock existing check returning null (not found)
    stmt.get.mockReturnValue(undefined);

    const result = importJson(db, userId, { bookmarks });

    expect(result.imported.length).toBe(1);
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO bookmarks"),
    );
  });

  test("should NOT insert a bookmark if it already exists", () => {
    const bookmarks = [
      {
        url: "https://existing.com",
        title: "Existing",
      },
    ];

    const stmt = {
      get: jest.fn(),
      run: jest.fn(),
    };
    db.prepare.mockReturnValue(stmt);

    // Mock existing check returning an object (found)
    stmt.get.mockReturnValue({ id: "existing-id" });

    const result = importJson(db, userId, { bookmarks });

    expect(result.imported.length).toBe(0);
    // Should NOT insert
    const insertCalls = db.prepare.mock.calls.filter((args) =>
      args[0].includes("INSERT INTO bookmarks"),
    );
    expect(insertCalls.length).toBe(0);
  });
});
