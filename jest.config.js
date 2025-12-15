module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.js", "**/*.test.js"],
  collectCoverageFrom: [
    "server/**/*.js",
    "!server/**/*.test.js",
    "!server/index.js",
    "!server/smart-organization-endpoints.js",
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
