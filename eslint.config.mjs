import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

// Next 16 dropped `next lint`; run `pnpm lint`. The React hooks rules catch stale closures in effects.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // React Compiler advice; this app doesn't use the compiler, so these stay visible as warnings
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      // Pixel-art sprites are plain <img> on purpose (no resampling, no image optimizer)
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "design/**", "downloads/**"]),
])
