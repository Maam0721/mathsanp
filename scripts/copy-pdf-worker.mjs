import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const source = new URL("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", root);
const publicDirectory = new URL("public/", root);
const target = new URL("pdf.worker.min.mjs", publicDirectory);

await mkdir(fileURLToPath(publicDirectory), { recursive: true });
await copyFile(fileURLToPath(source), fileURLToPath(target));
