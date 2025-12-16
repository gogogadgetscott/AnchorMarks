function applyDashboardConfigToUser(db, userId, config) {
  return db
    .prepare(
      `
    UPDATE user_settings 
    SET dashboard_mode = ?, 
        dashboard_tags = ?, 
        dashboard_sort = ?,
        widget_order = ?,
        dashboard_widgets = ?,
        include_child_bookmarks = ?,
        current_view = 'dashboard',
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `,
    )
    .run(
      config.dashboard_mode || "folder",
      config.dashboard_tags ? JSON.stringify(config.dashboard_tags) : null,
      config.dashboard_sort || "recently_added",
      config.widget_order ? JSON.stringify(config.widget_order) : null,
      config.dashboard_widgets
        ? JSON.stringify(config.dashboard_widgets)
        : null,
      config.include_child_bookmarks || 0,
      userId,
    );
}

function getUserSettings(db, userId) {
  return db
    .prepare("SELECT * FROM user_settings WHERE user_id = ?")
    .get(userId);
}

function upsertUserSettings(db, userId, body = {}) {
  const existing = getUserSettings(db, userId);
  if (existing) {
    const updates = [];
    const values = [];

    const pushIf = (key, val, transform) => {
      if (val !== undefined) {
        updates.push(`${key} = ?`);
        values.push(transform ? transform(val) : val);
      }
    };

    pushIf("view_mode", body.view_mode);
    pushIf("hide_favicons", body.hide_favicons, (v) => (v ? 1 : 0));
    pushIf("hide_sidebar", body.hide_sidebar, (v) => (v ? 1 : 0));
    pushIf("ai_suggestions_enabled", body.ai_suggestions_enabled, (v) =>
      v ? 1 : 0,
    );
    pushIf("theme", body.theme);
    pushIf("dashboard_mode", body.dashboard_mode);
    pushIf("dashboard_tags", body.dashboard_tags, (v) =>
      v ? JSON.stringify(v) : null,
    );
    pushIf("dashboard_sort", body.dashboard_sort);
    pushIf("widget_order", body.widget_order, (v) =>
      v ? JSON.stringify(v) : null,
    );
    pushIf("dashboard_widgets", body.dashboard_widgets, (v) =>
      v ? JSON.stringify(v) : null,
    );
    pushIf("collapsed_sections", body.collapsed_sections, (v) =>
      v ? JSON.stringify(v) : null,
    );
    pushIf("include_child_bookmarks", body.include_child_bookmarks);
    if (body.snap_to_grid !== undefined)
      pushIf("snap_to_grid", body.snap_to_grid ? 1 : 0);
    if (body.current_view !== undefined)
      pushIf("current_view", body.current_view);

    if (updates.length > 0) {
      updates.push("updated_at = CURRENT_TIMESTAMP");
      values.push(userId);
      return db
        .prepare(
          `UPDATE user_settings SET ${updates.join(", ")} WHERE user_id = ?`,
        )
        .run(...values);
    }
    return null;
  }

  // Insert
  return db
    .prepare(
      `
    INSERT INTO user_settings (
      user_id, view_mode, hide_favicons, hide_sidebar, ai_suggestions_enabled, theme, dashboard_mode,
      dashboard_tags, dashboard_sort, widget_order, dashboard_widgets, collapsed_sections, include_child_bookmarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      userId,
      body.view_mode || "grid",
      body.hide_favicons || 0,
      body.hide_sidebar || 0,
      body.ai_suggestions_enabled !== undefined &&
        body.ai_suggestions_enabled !== null
        ? body.ai_suggestions_enabled
          ? 1
          : 0
        : 1,
      body.theme || "light",
      body.dashboard_mode || "folder",
      body.dashboard_tags ? JSON.stringify(body.dashboard_tags) : null,
      body.dashboard_sort || "updated_desc",
      body.widget_order ? JSON.stringify(body.widget_order) : null,
      body.dashboard_widgets ? JSON.stringify(body.dashboard_widgets) : null,
      body.collapsed_sections ? JSON.stringify(body.collapsed_sections) : null,
      body.include_child_bookmarks || 0,
    );
}

module.exports = {
  applyDashboardConfigToUser,
  getUserSettings,
  upsertUserSettings,
};
