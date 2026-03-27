// ESLint flat config — native format, no FlatCompat bridge needed.
// eslint-config-next v16 exports flat config arrays directly, so we import them
// as ES modules and spread them in. FlatCompat is only needed for legacy
// eslintrc-style shared configs; eslint-config-next v16 no longer requires it.
import nextConfig from "eslint-config-next/core-web-vitals";
import tsConfig from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextConfig,
  ...tsConfig,
  {
    rules: {
      // Enforce explicit return types on exported functions — makes the service
      // layer and store actions self-documenting and easier to review.
      "@typescript-eslint/explicit-function-return-type": "off", // too noisy for JSX; revisit
      // Ban `any` — every value touching the API must be typed.
      "@typescript-eslint/no-explicit-any": "error",
      // Unused vars are always a signal of incomplete refactoring.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];

export default eslintConfig;
