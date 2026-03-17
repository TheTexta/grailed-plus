import path from "node:path";
import { createExtensionArchive, rootDir, stageExtension } from "./release-lib.mjs";

const staged = stageExtension("chrome");
const packaged = createExtensionArchive("chrome", staged.stageDir);

console.log(`Staged chrome extension at ${path.relative(rootDir, staged.stageDir)}`);
console.log(`Packaged chrome extension at ${path.relative(rootDir, packaged.outputFile)}`);
