// Estándar de calidad: lo copia quality/sync.sh como dependency-cruiser.standard.mjs y no se edita en
// el repo. El script `deps` de cada paquete lo usa tal cual (`depcruise --config
// dependency-cruiser.standard.mjs <carpetas>`): no hay configuración propia ni excepciones.
//
// Los ciclos cuentan aunque una de las flechas sea sólo de tipos: el diseño queda igual de enredado y
// se arregla igual, llevando el tipo compartido a un módulo propio. Los archivos sin uso no se miran
// acá: los encuentra knip.

const GENERATED_DIRECTORIES =
  "(^|/)(node_modules|dist|build|out|coverage|\\.next|\\.astro|\\.turbo|playwright-report|test-results)/";

const dependencyCruiserConfig = {
  forbidden: [
    {
      name: "no-circular",
      comment: "Un ciclo entre módulos: lo compartido va a un módulo que los dos importen.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-relative-escape",
      comment:
        "Un import relativo que sale del paquete: lo de otro paquete del workspace entra por su nombre, " +
        "declarado en package.json.",
      severity: "error",
      from: {},
      to: { path: "^\\.\\./", pathNot: "(^|/)node_modules/" },
    },
  ],
  options: {
    doNotFollow: { path: "(^|/)node_modules/" },
    exclude: { path: GENERATED_DIRECTORIES },
    preserveSymlinks: true,
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".d.ts"],
    },
  },
};

export default dependencyCruiserConfig;
