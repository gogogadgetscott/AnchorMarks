const fs = require("fs");
const path = require("path");
const request = require("supertest");
const {
  EXAMPLE_BOOKMARKS,
  STARTER_FOLDER,
} = require("../utils/exampleBookmarks");

const TEST_DB_PATH = path.join(__dirname, "anchormarks-test-settings.db");
process.env.NODE_ENV = "test";
process.env.DB_PATH = TEST_DB_PATH;
process.env.JWT_SECRET = "test-secret-key-settings";
process.env.CORS_ORIGIN = "http://localhost";

const app = require("../app");

let agent;
let csrfToken;
let userId;

function cleanup() {
  if (app.db) app.db.close();
  [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`].forEach((f) => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
}

describe("Settings API", () => {
  beforeAll(async () => {
    agent = request.agent(app);
    const unique = Date.now();
    const register = await agent.post("/api/auth/register").send({
      email: `settings_${unique}@example.com`,
      password: "TestPass123!",
    });

    expect(register.status).toBe(200);
    csrfToken = register.body.csrfToken;
    userId = register.body.user.id;
  });

  afterAll(() => cleanup());

  it("returns default settings when user has no settings row", async () => {
    const res = await agent.get("/api/settings").set("X-CSRF-Token", csrfToken);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      view_mode: "grid",
      hide_favicons: false,
      hide_sidebar: false,
      ai_suggestions_enabled: true,
      rich_link_previews_enabled: true,
      theme: "dark",
      dashboard_mode: "folder",
      dashboard_tags: [],
      dashboard_sort: "updated_desc",
      widget_order: {},
      collapsed_sections: [],
      tour_completed: false,
    });
  });

  it("updates settings and persists known + flexible JSON fields", async () => {
    const updatePayload = {
      view_mode: "list",
      hide_favicons: true,
      hide_sidebar: true,
      ai_suggestions_enabled: false,
      theme: "light",
      rich_link_previews_enabled: true,
      dashboard_mode: "tag",
      dashboard_tags: ["work", "focus"],
      dashboard_sort: "recently_added",
      widget_order: { stats: 0, tags: 1 },
      dashboard_widgets: [{ id: "stats", enabled: true }],
      collapsed_sections: ["tags"],
      include_child_bookmarks: 1,
      snap_to_grid: false,
      current_view: "dashboard",
      tour_completed: true,
      custom_pref: "alpha",
      nested_pref: { density: "compact" },
    };

    const res = await agent
      .put("/api/settings")
      .set("X-CSRF-Token", csrfToken)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      view_mode: "list",
      hide_favicons: true,
      hide_sidebar: true,
      ai_suggestions_enabled: false,
      rich_link_previews_enabled: true,
      theme: "light",
      dashboard_mode: "tag",
      dashboard_tags: ["work", "focus"],
      dashboard_sort: "recently_added",
      widget_order: { stats: 0, tags: 1 },
      collapsed_sections: ["tags"],
      include_child_bookmarks: 1,
      snap_to_grid: false,
      current_view: "dashboard",
      tour_completed: true,
      custom_pref: "alpha",
      nested_pref: { density: "compact" },
    });

    const settingsRow = app.db
      .prepare("SELECT settings_json FROM user_settings WHERE user_id = ?")
      .get(userId);
    expect(JSON.parse(settingsRow.settings_json)).toEqual({
      custom_pref: "alpha",
      nested_pref: { density: "compact" },
    });
  });

  it("merges additional flexible settings_json keys on later updates", async () => {
    const res = await agent
      .put("/api/settings")
      .set("X-CSRF-Token", csrfToken)
      .send({
        custom_pref_2: 42,
      });

    expect(res.status).toBe(200);
    expect(res.body.custom_pref).toBe("alpha");
    expect(res.body.nested_pref).toEqual({ density: "compact" });
    expect(res.body.custom_pref_2).toBe(42);

    const settingsRow = app.db
      .prepare("SELECT settings_json FROM user_settings WHERE user_id = ?")
      .get(userId);
    expect(JSON.parse(settingsRow.settings_json)).toEqual({
      custom_pref: "alpha",
      nested_pref: { density: "compact" },
      custom_pref_2: 42,
    });
  });

  it("resets bookmarks and returns the expected response contract", async () => {
    const created = await agent
      .post("/api/bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({ url: "https://before-reset.example", title: "Before Reset" });
    expect(created.status).toBe(200);

    const resetRes = await agent
      .post("/api/settings/reset-bookmarks")
      .set("X-CSRF-Token", csrfToken)
      .send({});

    expect(resetRes.status).toBe(200);
    expect(resetRes.body).toMatchObject({
      success: true,
      bookmarks_created: EXAMPLE_BOOKMARKS.length,
      message: "Bookmarks reset successfully",
    });

    const userBookmarks = app.db
      .prepare("SELECT id, title, url FROM bookmarks WHERE user_id = ?")
      .all(userId);
    expect(userBookmarks).toHaveLength(EXAMPLE_BOOKMARKS.length);
    expect(
      userBookmarks.some((b) => b.url === "https://before-reset.example"),
    ).toBe(false);

    const starterFolder = app.db
      .prepare("SELECT name, color, icon FROM folders WHERE user_id = ?")
      .get(userId);
    expect(starterFolder).toMatchObject({
      name: STARTER_FOLDER.name,
      color: STARTER_FOLDER.color,
      icon: STARTER_FOLDER.icon,
    });
  });
});
