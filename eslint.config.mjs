import { FlatCompat } from "@eslint/eslintrc";

// ESLint flat config (Next.js 15 default format).
// next/core-web-vitals extends next/recommended with stricter rules around
// performance (no img tags, no sync scripts, etc.).
// next/typescript adds TypeScript-specific rules on top.
const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
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
