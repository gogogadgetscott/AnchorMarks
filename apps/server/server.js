const app = require("./app");
const config = require("./config");

// Start server when this file is executed directly
app.listen(config.PORT, config.HOST, () => {
  console.log(`\n╔═════════════════════════════════════════════════════════════════╗`);
  console.log(`║                                                                 ║`);
  console.log(`║   AnchorMarks v1.0.0                                            ║`);
  console.log(`║                                                                 ║`);
  console.log(`║   Server:   http://${config.HOST === "0.0.0.0" ? "localhost" : config.HOST}:${config.PORT}                               ║`);
  console.log(`║   API:      http://${config.HOST === "0.0.0.0" ? "localhost" : config.HOST}:${config.PORT}/api                           ║`);
  console.log(`║   Mode:     ${config.NODE_ENV.padEnd(52)}║`);
  console.log(`║   Database: ${config.DB_PATH.padEnd(52)}║`);
  console.log(`║                                                                 ║`);
  console.log(`╚═════════════════════════════════════════════════════════════════╝\n`);
});

// Expose for external control (optional)
module.exports = app;
