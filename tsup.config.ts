import { defineConfig } from "tsup";

// Two builds so that only the React entry is a client module.
// "use client" on fold-ready/devices or fold-ready/tailwind would turn their plain data
// (IPHONE_DUO, VARIANTS) into opaque client references when imported from a React Server Component.
// `dist` is emptied by the build script, not by `clean` (the two builds run side by side).
export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    external: ["react", "react-dom"],
    // classic JSX, so neither build imports "react/jsx-runtime" (see src/react-shim.ts)
    inject: ["src/react-shim.ts"],
    esbuildOptions(options) {
      options.jsx = "transform";
      options.jsxFactory = "React.createElement";
      options.jsxFragment = "React.Fragment";
      options.tsconfigRaw = { compilerOptions: { jsx: "react", jsxFactory: "React.createElement", jsxFragmentFactory: "React.Fragment" } };
      delete options.tsconfig;
    },
    banner: { js: '"use client";' },
  },
  {
    entry: ["src/tailwind.ts", "src/devices.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    external: ["react", "react-dom"],
  },
]);
