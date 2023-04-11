import path from "path";
import fs from "fs";
import rollupTypescript from "rollup-plugin-typescript2";
import rollupCommonJS from "@rollup/plugin-commonjs";
import rollupReplace from "@rollup/plugin-replace";

const pkgPath = path.resolve(__dirname, "../../packages");
const distPath = path.resolve(__dirname, "../../dist/node_modules");

/**
 *
 * @param {string} pkgName
 * @param {boolean} isDist ,判斷當前是否為打包後的路徑
 */
export function resolvePkgPath(pkgName, isDist) {
  if (isDist) {
    return `${distPath}/${pkgName}`;
  }
  return `${pkgPath}/${pkgName}`;
}

export function getPackageName(pkgName) {
  // package path
  const packagePath = `${resolvePkgPath(pkgName)}/package.json`;
  const str = fs.readFileSync(packagePath, { encoding: "utf-8" });
  return JSON.parse(str);
}

export function getBaseRollupPlugins({
  alias = { __DEV__: true, preventAssignment: true },
  typescript = {},
} = {}) {
  return [rollupReplace(alias), rollupCommonJS(), rollupTypescript(typescript)];
}
