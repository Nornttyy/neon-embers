import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const outputRoot = resolve(projectRoot, "dist");
const publicEntries = [
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "sw.js",
  "assets",
  "src",
];
const revisionToken = "__ASSET_REVISION__";
const textExtensions = new Set([".css", ".html", ".js", ".json", ".svg", ".webmanifest"]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

if (!outputRoot.startsWith(`${projectRoot}/`)) throw new Error("Refusing to build outside the project");
await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

for (const entry of publicEntries) {
  await cp(resolve(projectRoot, entry), resolve(outputRoot, entry), { recursive: true });
}

const outputFiles = (await collectFiles(outputRoot)).sort();
const hash = createHash("sha256");
for (const path of outputFiles) {
  hash.update(relative(outputRoot, path));
  hash.update("\0");
  hash.update(await readFile(path));
  hash.update("\0");
}
const revision = hash.digest("hex").slice(0, 12);

for (const path of outputFiles) {
  if (!textExtensions.has(extname(path))) continue;
  const source = await readFile(path, "utf8");
  if (source.includes(revisionToken)) await writeFile(path, source.replaceAll(revisionToken, revision));
}

console.log(`Static website built at ${outputRoot} (revision ${revision})`);
