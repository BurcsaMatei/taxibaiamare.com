// eslint.config.mjs
//
// Flat config (ESLint 9). Traducerea 1:1 a fostului `.eslintrc.cjs` — fiecare `extends`, plugin,
// regulă și pattern de ignorare de acolo se regăsește mai jos, în aceeași ordine de precedență.
// Patternurile din fostul `.eslintignore` sunt incluse: ESLint 9 nu mai citește acel fișier.

// ==============================
// Imports
// ==============================
import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import jsxA11y from "eslint-plugin-jsx-a11y";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";

// ==============================
// Config
// ==============================
export default defineConfig([
  globalIgnores([".next", "lib/gallery.data.ts", "next-env.d.ts", ".next/types/**"]),

  // Fostul `extends`, în aceeași ordine.
  ...nextCoreWebVitals, // "next/core-web-vitals"
  ...nextTypescript, // "plugin:@typescript-eslint/recommended"
  // "plugin:jsx-a11y/recommended" — doar REGULILE: plugin-ul e deja înregistrat de
  // `eslint-config-next/core-web-vitals`, iar flat config refuză redefinirea lui.
  { rules: jsxA11y.flatConfigs.recommended.rules },
  prettier, // "prettier" — dezactivează regulile de formatare; rămâne ULTIMUL

  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
    },
    settings: {
      next: { rootDir: ["./"] },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",

      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",

      "jsx-a11y/anchor-is-valid": "off",

      // ✅ prevent rule-load crash + consistent behavior
      "@typescript-eslint/no-unused-expressions": [
        "error",
        { allowShortCircuit: true, allowTernary: true, allowTaggedTemplates: true },
      ],

      // ── Singura regulă ajustată de migrare ──────────────────────────────────────────
      // Migrarea NU adaugă reguli noi. Directivele `eslint-disable` care indicau reguli
      // neactivate au devenit comentarii simple, ca justificarea autorului să nu se piardă.

      // `eslint-config-next@16` activează implicit **regulile React Compiler** — 12 dintre ele
      // ca ERORI, față de v15 care avea doar `rules-of-hooks` (error) și `exhaustive-deps` (warn).
      // Nu e o simplă versiune nouă de lint: e o schimbare de politică React, sosită ca efect
      // secundar al alinierii `eslint-config-next` cu framework-ul.
      //
      // Toate 12 sunt coborâte la avertisment, DELIBERAT. Lovesc tipare preexistente, scrise
      // deliberat și cu justificare în cod — „citește din localStorage la montare" (imposibil
      // altfel în Pages Router), `ref.current` în logica de drag, componente construite
      // condiționat în render. O migrare de lint nu are voie să devină tăcut o refactorizare
      // React pe site-uri live.
      //
      // `rules-of-hooks` RĂMÂNE eroare — era eroare și în v15, și e corectitudine reală.
      //
      // Poarta rămâne astfel utilă pentru REGRESII, iar datoria existentă e catalogată ca task
      // separat în `konceptid-ops` → Val 3.
      "react-hooks/static-components": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/config": "warn",
      "react-hooks/gating": "warn",
    },
  },
]);
