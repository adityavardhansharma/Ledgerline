import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "convex/_generated/**", "next-env.d.ts"] },
  {
    rules: {
      // Apostrophes in copy are fine in JSX text.
      "react/no-unescaped-entities": "off",
      // React Compiler advice: reported, not blocking, until the animated components are reworked for it.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      // `_name` marks a value left out on purpose (`const { _id, ...rest } = row`).
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
];

export default config;
