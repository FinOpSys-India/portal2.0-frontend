import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // A read-only copy of the deployed Node backend, kept as the reference for
    // what the API actually does. It is CommonJS and not ours to restyle, so
    // linting it only ever produced 578 errors nobody could act on.
    "Portal-backend/**",
  ]),
]);

export default eslintConfig;
