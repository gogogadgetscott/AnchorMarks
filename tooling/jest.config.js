module.exports = {
  testEnvironment: "node",
  // Run tests from the repository root so patterns like "apps/..." are resolved
  rootDir: "..",
  testMatch: ["**/__tests__/**/*.js", "**/*.test.js"],
  collectCoverageFrom: [
    "apps/server/**/*.js",
    "!apps/server/**/*.test.js",
    "!apps/server/app.js",
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
    "^uuid$": "<rootDir>/apps/server/__mocks__/uuid.js",
  },
};
