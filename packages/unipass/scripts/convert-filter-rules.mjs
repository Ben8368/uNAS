// Node test/audit bridge for the exact converter bundled into the Service Worker.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
const result = await build({ entryPoints: [fileURLToPath(new URL("../src/background/blocking/filter-converter.ts", import.meta.url))], bundle: true, platform: "node", format: "esm", write: false });
const converter = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
export const { convertFilterList, PROTECTED_INITIATOR_DOMAINS } = converter;
