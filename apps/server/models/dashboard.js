const { v4: uuidv4 } = require("uuid");

function listDashboardViews(db, userId) {
  return db
    .prepare(
      "SELECT * FROM dashboard_views WHERE user_id = ? ORDER BY position, name",
    )
    .all(userId)
    .map((v) => ({ ...v, config: JSON.parse(v.config) }));
}

function createDashboardView(db, userId, name, config) {
  const id = uuidv4();
  const maxPos = db
    .prepare(
      "SELECT MAX(position) as max FROM dashboard_views WHERE user_id = ?",
    )
    .get(userId);
  const position = (maxPos.max || 0) + 1;
  db.prepare(
    "INSERT INTO dashboard_views (id, user_id, name, config, position) VALUES (?, ?, ?, ?, ?)",
  ).run(id, userId, name, JSON.stringify(config), position);
  return db.prepare("SELECT * FROM dashboard_views WHERE id = ?").get(id);
}

function getDashboardView(db, id) {
  return db.prepare("SELECT * FROM dashboard_views WHERE id = ?").get(id);
}

function updateDashboardView(db, id, userId, fields) {
  db.prepare(
    `
    UPDATE dashboard_views SET
      name = COALESCE(?, name),
      config = COALESCE(?, config),
      position = COALESCE(?, position),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `,
  ).run(
    fields.name,
    fields.config ? JSON.stringify(fields.config) : null,
    fields.position,
    id,
    userId,
  );
  return db.prepare("SELECT * FROM dashboard_views WHERE id = ?").get(id);
}

function deleteDashboardView(db, id, userId) {
  return db
    .prepare("DELETE FROM dashboard_views WHERE id = ? AND user_id = ?")
    .run(id, userId);
}

module.exports = {
  listDashboardViews,
  createDashboardView,
  getDashboardView,
  updateDashboardView,
  deleteDashboardView,
};
