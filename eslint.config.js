import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/", "node_modules/"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs}"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: globals.node },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }], eqeqeq: "error", "prefer-const": "error" },
  },
  // The browser script (theme switch and search) runs in the page, not in Node.
  { files: ["public/**/*.js"], languageOptions: { sourceType: "script", globals: globals.browser } },
];
