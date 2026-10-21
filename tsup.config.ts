import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/tailwind.ts", "src/devices.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
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
});
