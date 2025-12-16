const path = require("path");

function setupStaticRoutes(app) {
  app.all(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, "../../public/index.html"));
  });
}

module.exports = setupStaticRoutes;
