import { resolvePkgPath, getPackageName, getBaseRollupPlugins } from "./utils";
import rollupGeneratePkgJson from "rollup-plugin-generate-package-json";

const { name, module } = getPackageName("react");
const pkgPath = resolvePkgPath("react");
const pkgDistPath = resolvePkgPath("react", true);

export default [
  // react
  {
    input: `${pkgPath}/${module}`,
    output: {
      file: `${pkgDistPath}/index.js`,
      name: "React",
      format: "umd",
    },
    plugins: [
      ...getBaseRollupPlugins(),
      rollupGeneratePkgJson({
        inputFolder: pkgPath,
        outputFolder: pkgDistPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          version,
          main: "index.js",
        }),
      }),
    ],
  },
  // jsx-runtime
  {
    input: `${pkgPath}/src/jsx.ts`,
    output: [
      // jsx-runtime
      {
        file: `${pkgDistPath}/jsx-runtime.js`,
        name: "jsx-runtime",
        format: "umd",
      },
      // jsx-dev-runtime
      {
        file: `${pkgDistPath}/jsx-dev-runtime.js`,
        name: "jsx-dev-runtime",
        format: "umd",
      },
    ],
    plugins: [...getBaseRollupPlugins()],
  },
];
