import { resolvePkgPath, getPackageName, getBaseRollupPlugins } from "./utils";
import rollupGeneratePkgJson from "rollup-plugin-generate-package-json";
import rollupAlias from "@rollup/plugin-alias";

const { name, module, peerDependencies } = getPackageName("react-dom");
const pkgPath = resolvePkgPath(name);
const pkgDistPath = resolvePkgPath(name, true);

export default [
  // react-dom
  {
    input: `${pkgPath}/${module}`,
    output:
      // 為了兼容React17和React18的導出，所以打包兩份
      [
        {
          file: `${pkgDistPath}/index.js`,
          name: "ReactDOM",
          format: "umd",
        },
        // import ReactDOM from 'react-dom/client'
        {
          file: `${pkgDistPath}/client.js`,
          name: "client",
          format: "umd",
        },
      ],

    external: ["react", "react-dom"],
    plugins: [...getBaseRollupPlugins()],
  },
  // test-utils
  {
    input: `${pkgPath}/test-utils.ts`,
    output:
      // 為了兼容React17和React18的導出，所以打包兩份
      [
        {
          file: `${pkgDistPath}/test-utils.js`,
          name: "testUtils",
          format: "umd",
        },
      ],
    // 讓react-dom中不要有react的代碼（打包排除）
    external: [...Object.keys(peerDependencies)],
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
