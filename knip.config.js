import { standardKnipConfig } from "./knip.standard.mjs";

export default standardKnipConfig({
  // scripts/build-content.mjs empaqueta los content scripts que inyecta la extensión: nadie los importa.
  entry: ["src/content/bridge.ts!", "src/content/inject.ts!", "src/content/design-overlay.ts!"],
});
