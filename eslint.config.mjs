import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["frontend/**/*.{js,jsx,ts,tsx}"],
    ignores: [
      "frontend/node_modules/**",
      "frontend/.next/**",
      "frontend/out/**",
      "frontend/build/**",
      "frontend/next-env.d.ts",
    ],
  },
];

export default eslintConfig;
