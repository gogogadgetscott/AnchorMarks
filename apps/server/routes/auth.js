// Delegate to controllers/auth.js
const controller = require("../controllers/auth");

module.exports = {
  setupAuthRoutes: controller.setupAuthRoutes,
  createExampleBookmarks: controller.createExampleBookmarks,
};
