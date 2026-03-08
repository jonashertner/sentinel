import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(frontendDir, "..");
const sourceDir = path.join(repoDir, "data");
const destDir = path.join(frontendDir, "public", "data");

if (!existsSync(sourceDir)) {
  throw new Error(`Data source directory not found: ${sourceDir}`);
}

mkdirSync(path.dirname(destDir), { recursive: true });
rmSync(destDir, { recursive: true, force: true });
cpSync(sourceDir, destDir, { recursive: true });

console.log(`Synced data from ${sourceDir} to ${destDir}`);
