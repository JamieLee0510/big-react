import { resolvePkgPath, getPackageName, getBaseRollupPlugins } from "./utils";
import rollupGeneratePkgJson from "rollup-plugin-generate-package-json";
import rollupAlias from "@rollup/plugin-alias";
const { name, module } = getPackageName("react-dom");
const pkgPath = resolvePkgPath(name);
const pkgDistPath = resolvePkgPath(name, true);

export default [
  // react
  {
    input: `${pkgPath}/${module}`,
    output:
      // 為了兼容React17和React18的導出，所以打包兩份
      [
        {
          file: `${pkgDistPath}/index.js`,
          name: "index.js",
          format: "umd",
        },
        // import ReactDOM from 'react-dom/client'
        {
          file: `${pkgDistPath}/client.js`,
          name: "client.js",
          format: "umd",
        },
      ],
    plugins: [
      ...getBaseRollupPlugins(),
      // deal with alias
      rollupAlias({
        entries: {
          hostConfig: `${pkgDistPath}/src/hostConfig.ts`,
        },
      }),
      rollupGeneratePkgJson({
        inputFolder: pkgPath,
        outputFolder: pkgDistPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          version,
          peerDependencies: {
            react: version,
          },
          main: "index.js",
        }),
      }),
    ],
  },
];
