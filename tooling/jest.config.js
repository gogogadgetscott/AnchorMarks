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
      statements: 45,
      lines: 45,
      functions: 45,
      branches: 30,
    },
  },
  coverageDirectory: "coverage",
  verbose: true,
  moduleNameMapper: {
    "^uuid$": "<rootDir>/apps/server/__mocks__/uuid.js",
  },
};
