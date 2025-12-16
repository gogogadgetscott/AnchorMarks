module.exports = {
  testEnvironment: "node",
  // Run tests from the repository root so patterns like "apps/..." are resolved
  rootDir: "..",
  testMatch: ["**/__tests__/**/*.js", "**/*.test.js"],
  collectCoverageFrom: [
    "apps/server/**/*.js",
    "!apps/server/**/*.test.js",
    "!apps/server/app.js",
    "!apps/server/smart-organization-endpoints.js",
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      lines: 80,
      functions: 80,
      branches: 70,
    },
  },
  coverageDirectory: "coverage",
  verbose: true,
  moduleNameMapper: {
    "^uuid$": "<rootDir>/__mocks__/uuid.js",
  },
};
