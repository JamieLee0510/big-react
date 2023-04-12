import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import rollupReplace from "@rollup/plugin-replace";

import { resolvePkgPath } from "../rollup/utils";
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    rollupReplace({
      __DEV__: true,
      preventAssignment: true,
    }),
  ],
  resolve: {
    alias: [
      {
        find: "react",
        replacement: resolvePkgPath("react"),
      },
      {
        find: "react-dom",
        replacement: resolvePkgPath("react-dom"),
      },
      {
        find: "hostConfig",
        replacement: path.resolve(
          resolvePkgPath("react-dom"),
          "./src/hostConfig.ts"
        ),
      },
    ],
  },
});
