/**
 * Build-only (tsup `inject`): the bundle is compiled with the classic JSX transform
 * (React.createElement), and esbuild wires every `React` it emits to this import.
 *
 * Why not the automatic runtime: the ESM build would `import "react/jsx-runtime"`, and React 17
 * has no "exports" map, so Node's ESM loader cannot find that file without an extension —
 * server rendering on React 17 (e.g. Next 12) failed on import. `react` itself always resolves.
 */
import * as React from "react";
export { React };
