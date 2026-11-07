/**
 * Import folder ordering tests.
 *
 * The previous loop counted every visit as an "attempt", including folders
 * re-queued because their parent had not been inserted yet. An export whose
 * child folders are listed before their parents exhausted the 1000-attempt
 * budget after only a handful of inserts and silently dropped the rest, so
 * deep trees were imported incomplete. Progress is now counted per pass.
 */
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { initializeDatabase } = require("../models/database");
const { importJson } = require("../models/importExport");

const TEST_DB_PATH = path.join(
  __dirname,
  "anchormarks-test-import-folder-order.db",
);

let db;
let userId;

function removeDbFiles() {
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
    (file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
  );
}

function countFolders() {
  return db
    .prepare("SELECT COUNT(*) AS c FROM folders WHERE user_id = ?")
    .get(userId).c;
}

beforeAll(() => {
  removeDbFiles();
  db = initializeDatabase(TEST_DB_PATH);
  userId = uuidv4();
  db.prepare("INSERT INTO users (id, email, password) VALUES (?, ?, ?)").run(
    userId,
    "import-order@example.com",
    "hashed",
  );
});

afterAll(() => {
  removeDbFiles();
});

describe("importJson folder insertion", () => {
  it("imports a deep tree even when children are listed before their parents", () => {
    const DEPTH = 600;
    const folders = [];
    // Build f0 (root) <- f1 <- ... <- f599, then list deepest-first so every
    // folder initially waits for its parent.
    for (let i = 0; i < DEPTH; i++) {
      folders.push({
        id: `f${i}`,
        name: `folder-${i}`,
        parent_id: i === 0 ? null : `f${i - 1}`,
        color: "#6366f1",
        icon: "folder",
      });
    }
    folders.reverse();

    importJson(db, userId, { bookmarks: [], folders });

    // All folders must land — previously the attempt budget ran out early.
    expect(countFolders()).toBe(DEPTH);

    // And the parent relationships must be reconstructed, not flattened:
    // exactly one root (f0) and every other folder has a parent.
    const rows = db
      .prepare("SELECT name, parent_id FROM folders WHERE user_id = ?")
      .all(userId);
    const roots = rows.filter((r) => r.parent_id === null);
    expect(roots).toHaveLength(1);
    expect(roots[0].name).toBe("folder-0");
  });

  it("skips folders whose parent is missing from the import without hanging", () => {
    const before = countFolders();
    importJson(db, userId, {
      bookmarks: [],
      folders: [
        { id: "ok-1", name: "has-parent-in-import", parent_id: null },
        { id: "ok-2", name: "child-ok", parent_id: "ok-1" },
        { id: "orphan", name: "orphan-child", parent_id: "not-in-import" },
      ],
    });

    const after = countFolders();
    expect(after - before).toBe(2); // the two resolvable folders
    const orphan = db
      .prepare("SELECT id FROM folders WHERE user_id = ? AND name = ?")
      .get(userId, "orphan-child");
    expect(orphan).toBeUndefined();
  });

  it("does not duplicate a folder when the same import runs twice", () => {
    const folders = [
      { id: "dup-1", name: "dup-root", parent_id: null },
      { id: "dup-2", name: "dup-child", parent_id: "dup-1" },
    ];
    importJson(db, userId, { bookmarks: [], folders });
    const afterFirst = countFolders();
    importJson(db, userId, { bookmarks: [], folders });
    expect(countFolders()).toBe(afterFirst);
  });
});
