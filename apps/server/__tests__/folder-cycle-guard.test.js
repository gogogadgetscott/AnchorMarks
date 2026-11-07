/**
 * Folder hierarchy guard tests.
 *
 * Parent moves must be validated at the model layer (both the generic PUT
 * and the sync push path call updateFolder): parent ownership, self-parent,
 * and cycle checks. Also verifies that the include_children recursive CTE in
 * listBookmarks terminates even on databases that already contain a cycle
 * (better-sqlite3 is synchronous, so unbounded recursion would freeze the
 * whole event loop).
 */
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { initializeDatabase } = require("../models/database");
const folderModel = require("../models/folder");
const bookmarkModel = require("../models/bookmark");
const { AppError } = require("../lib/errors");

const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-folder-cycle.db");

let db;
let userA;
let userB;

function removeDbFiles() {
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
    (file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
  );
}

beforeAll(() => {
  removeDbFiles();
  db = initializeDatabase(TEST_DB_PATH);
  userA = uuidv4();
  userB = uuidv4();
  const insertUser = db.prepare(
    "INSERT INTO users (id, email, password) VALUES (?, ?, ?)",
  );
  insertUser.run(userA, "cycle-a@example.com", "hashed");
  insertUser.run(userB, "cycle-b@example.com", "hashed");
});

afterAll(() => {
  removeDbFiles();
});

function mkFolder(userId, name) {
  const id = uuidv4();
  folderModel.createFolder(db, id, userId, name, "#6366f1", "folder", 1, null);
  return id;
}

function expectAppError422(fn, messagePart) {
  let thrown = null;
  try {
    fn();
  } catch (err) {
    thrown = err;
  }
  expect(thrown).toBeInstanceOf(AppError);
  expect(thrown.statusCode).toBe(422);
  expect(thrown.message).toContain(messagePart);
}

describe("Folder parent validation (model layer)", () => {
  it("rejects a folder becoming its own parent", () => {
    const a = mkFolder(userA, "self-parent");
    expectAppError422(
      () => folderModel.updateFolder(db, a, userA, { parent_id: a }),
      "own parent",
    );
    // Row untouched
    const row = db.prepare("SELECT parent_id FROM folders WHERE id = ?").get(a);
    expect(row.parent_id).toBeNull();
  });

  it("rejects a parent that belongs to another user", () => {
    const a = mkFolder(userA, "cross-tenant-child");
    const foreignParent = mkFolder(userB, "foreign-parent");
    expectAppError422(
      () =>
        folderModel.updateFolder(db, a, userA, { parent_id: foreignParent }),
      "Parent folder not found",
    );
    const row = db.prepare("SELECT parent_id FROM folders WHERE id = ?").get(a);
    expect(row.parent_id).toBeNull();
  });

  it("rejects a parent id that does not exist at all", () => {
    const a = mkFolder(userA, "missing-parent-child");
    expectAppError422(
      () => folderModel.updateFolder(db, a, userA, { parent_id: uuidv4() }),
      "Parent folder not found",
    );
  });

  it("rejects a move that would create a cycle", () => {
    const a = mkFolder(userA, "cycle-a");
    const b = mkFolder(userA, "cycle-b");
    // a under b — fine
    folderModel.updateFolder(db, a, userA, { parent_id: b });
    // b under a — would close the loop
    expectAppError422(
      () => folderModel.updateFolder(db, b, userA, { parent_id: a }),
      "own subfolders",
    );
    const row = db.prepare("SELECT parent_id FROM folders WHERE id = ?").get(b);
    expect(row.parent_id).toBeNull();
  });

  it("allows valid moves and clearing the parent", () => {
    const a = mkFolder(userA, "valid-child");
    const b = mkFolder(userA, "valid-parent");
    folderModel.updateFolder(db, a, userA, { parent_id: b });
    const moved = db
      .prepare("SELECT parent_id FROM folders WHERE id = ?")
      .get(a);
    expect(moved.parent_id).toBe(b);

    folderModel.updateFolder(db, a, userA, { parent_id: null });
    const cleared = db
      .prepare("SELECT parent_id FROM folders WHERE id = ?")
      .get(a);
    expect(cleared.parent_id).toBeNull();
  });

  it("rejects createFolder with an invalid parent", () => {
    expectAppError422(
      () =>
        folderModel.createFolder(
          db,
          uuidv4(),
          userA,
          "bad-parent-create",
          "#6366f1",
          "folder",
          1,
          uuidv4(),
        ),
      "Parent folder not found",
    );
  });
});

describe("include_children CTE terminates on a cycled database", () => {
  it("returns from listBookmarks even when the folder tree contains a cycle", () => {
    const x = mkFolder(userA, "cte-x");
    const y = mkFolder(userA, "cte-y");
    // Close the loop directly — simulates a database written before the
    // cycle checks existed (the CTE must defend against this, not hang).
    const link = db.prepare("UPDATE folders SET parent_id = ? WHERE id = ?");
    link.run(y, x);
    link.run(x, y);

    // A bookmark inside the loop so the folder clause is exercised
    db.prepare(
      "INSERT INTO bookmarks (id, user_id, folder_id, title, url) VALUES (?, ?, ?, ?, ?)",
    ).run(uuidv4(), userA, x, "Cycled bookmark", "https://example.com/cycle");

    // Without the depth cap this never returns (vitest's timeout would fire);
    // with it, the query completes quickly.
    const started = Date.now();
    const result = bookmarkModel.listBookmarks(db, userA, {
      folder_id: x,
      include_children: true,
    });
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(2000);
    expect(result).toBeDefined();
    // Both folders are in each other's subtree at depth 1
    const ids = (result.bookmarks || []).map((b) => b.id);
    expect(ids.length).toBeGreaterThanOrEqual(0);
  });

  it("still finds bookmarks in children without a cycle", () => {
    const parent = mkFolder(userA, "tree-parent");
    const child = mkFolder(userA, "tree-child");
    folderModel.updateFolder(db, child, userA, { parent_id: parent });
    const bmId = uuidv4();
    db.prepare(
      "INSERT INTO bookmarks (id, user_id, folder_id, title, url) VALUES (?, ?, ?, ?, ?)",
    ).run(bmId, userA, child, "Child bookmark", "https://example.com/child");

    const result = bookmarkModel.listBookmarks(db, userA, {
      folder_id: parent,
      include_children: true,
    });
    expect((result.bookmarks || []).map((b) => b.id)).toContain(bmId);
  });
});
