const globals = require("globals");

module.exports = [
  {
    ignores: [
      "**/node_modules/**",
      "**/coverage/**",
      "data/**",
      "public/favicons/**",
      "public/thumbnails/**",
      "screenshots/**",
    ],
  },

  // Node/server code
  {
    files: [
      "apps/server/**/*.js",
      "tooling/jest.config.js",
      "tooling/deploy/**/*.js",
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.es2022,
        ...globals.node,
        ...globals.commonjs,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // Jest tests
  {
    files: ["apps/server/__tests__/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.es2022,
        ...globals.node,
        ...globals.commonjs,
        ...globals.jest,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // Frontend (ES modules)
  {
    files: ["apps/client/src/**/*.js", "apps/client/public/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.es2022,
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // Extension scripts
  {
    files: ["tooling/extension/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.es2022,
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
