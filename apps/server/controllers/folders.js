const { v4: uuidv4 } = require("uuid");

function setupFoldersRoutes(app, db, helpers = {}) {
  const { authenticateTokenMiddleware } = helpers;
  const folderModel = require("../models/folder");

  app.get("/api/folders", authenticateTokenMiddleware, (req, res) => {
    try {
      const folders = folderModel.listFolders(db, req.user.id);
      return res.json(folders);
    } catch (err) {
      console.error("Error fetching folders:", err);
      return res.status(500).json({ error: "Failed to fetch folders" });
    }
  });

  app.put("/api/folders/:id", authenticateTokenMiddleware, (req, res) => {
    const { name, parent_id, color, icon, position } = req.body;
    try {
      folderModel.updateFolder(db, req.params.id, req.user.id, {
        name,
        parent_id,
        color,
        icon,
        position,
      });
      const folder = folderModel.getFolderById(db, req.params.id);
      res.json(folder);
    } catch (err) {
      console.error("Error updating folder:", err);
      res.status(500).json({ error: "Failed to update folder" });
    }
  });

  app.delete("/api/folders/:id", authenticateTokenMiddleware, (req, res) => {
    try {
      folderModel.deleteFolder(db, req.params.id, req.user.id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting folder:", err);
      res.status(500).json({ error: "Failed to delete folder" });
    }
  });
}

module.exports = { setupFoldersRoutes };
