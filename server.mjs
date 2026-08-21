import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve(process.cwd(), process.argv[2] || ".");
const port = Number(process.env.NEON_PORT || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    let filePath = resolve(root, relative);
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) throw new Error("Invalid path");
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = resolve(filePath, "index.html");
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mime[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
      ...(extname(filePath) === ".js" && filePath.endsWith(`${sep}sw.js`) ? { "Service-Worker-Allowed": "/" } : {}),
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`霓虹余烬已启动：http://127.0.0.1:${port}`);
});
