const path = require("path");
const fs = require("fs");

function setupStaticRoutes(app) {
  app.all(/(.*)/, (req, res) => {
    // Determine which directory to serve from based on environment
    const isDev = process.env.NODE_ENV !== "production";
    const distPath = path.join(__dirname, "../../dist/index.html");
    const publicPath = path.join(__dirname, "../../public/index.html");

    // In production, serve from dist if it exists
    const htmlFile =
      !isDev && fs.existsSync(distPath) ? distPath : publicPath;

    res.sendFile(htmlFile);
  });
}

module.exports = setupStaticRoutes;
