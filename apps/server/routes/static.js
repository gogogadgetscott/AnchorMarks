const path = require("path");
const fs = require("fs");

module.exports = function setupStaticRoutes(app) {
  app.all(/(.*)/, (req, res) => {
    const isDev = process.env.NODE_ENV !== "production";
    const distPath = path.join(__dirname, "../../client/dist/index.html");
    const publicPath = path.join(__dirname, "../../client/index.html");
    const htmlFile = !isDev && fs.existsSync(distPath) ? distPath : publicPath;
    res.sendFile(htmlFile);
  });
};
