// Unit tests: getFolderById and getDashboardView require userId for tenant isolation (SEC-003)
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { initializeDatabase } = require("../models/database");
const folderModel = require("../models/folder");
const dashboardModel = require("../models/dashboard");

const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-tenant-isolation.db");
let db;
let userId;
let folderId;
let viewId;

beforeAll(() => {
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
    (file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
  );
  db = initializeDatabase(TEST_DB_PATH);
  userId = uuidv4();
  db.prepare("INSERT INTO users (id, email, password) VALUES (?, ?, ?)").run(
    userId,
    "tenant-test@example.com",
    "hashed",
  );
  folderId = uuidv4();
  folderModel.createFolder(db, folderId, userId, "Test", "#6366f1", "folder", 0);
  viewId = uuidv4();
  db.prepare(
    "INSERT INTO dashboard_views (id, user_id, name, config, position) VALUES (?, ?, ?, ?, ?)",
  ).run(viewId, userId, "Test View", "{}", 0);
});

afterAll(() => {
  if (db) db.close();
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach(
    (file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    },
  );
});

describe("getFolderById requires userId for tenant isolation", () => {
  it("throws when userId is omitted", () => {
    expect(() => folderModel.getFolderById(db, folderId)).toThrow(
      "getFolderById requires userId for tenant isolation",
    );
  });

  it("throws when userId is null", () => {
    expect(() => folderModel.getFolderById(db, folderId, null)).toThrow(
      "getFolderById requires userId for tenant isolation",
    );
  });

  it("throws when userId is undefined", () => {
    expect(() =>
      folderModel.getFolderById(db, folderId, undefined),
    ).toThrow("getFolderById requires userId for tenant isolation");
  });

  it("returns folder when userId is provided and matches", () => {
    const folder = folderModel.getFolderById(db, folderId, userId);
    expect(folder).not.toBeNull();
    expect(folder.id).toBe(folderId);
    expect(folder.user_id).toBe(userId);
  });

  it("returns null when userId is provided but does not own folder", () => {
    const otherUserId = uuidv4();
    const folder = folderModel.getFolderById(db, folderId, otherUserId);
    expect(folder).toBeNull();
  });
});

describe("getDashboardView requires userId for tenant isolation", () => {
  it("throws when userId is omitted", () => {
    expect(() => dashboardModel.getDashboardView(db, viewId)).toThrow(
      "getDashboardView requires userId for tenant isolation",
    );
  });

  it("throws when userId is null", () => {
    expect(() => dashboardModel.getDashboardView(db, viewId, null)).toThrow(
      "getDashboardView requires userId for tenant isolation",
    );
  });

  it("throws when userId is undefined", () => {
    expect(() =>
      dashboardModel.getDashboardView(db, viewId, undefined),
    ).toThrow("getDashboardView requires userId for tenant isolation");
  });

  it("returns view when userId is provided and matches", () => {
    const view = dashboardModel.getDashboardView(db, viewId, userId);
    expect(view).not.toBeNull();
    expect(view.id).toBe(viewId);
    expect(view.user_id).toBe(userId);
  });

  it("returns undefined when userId is provided but does not own view", () => {
    const otherUserId = uuidv4();
    const view = dashboardModel.getDashboardView(db, viewId, otherUserId);
    expect(view).toBeUndefined();
  });
});
