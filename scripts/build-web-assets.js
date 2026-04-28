import { cp, mkdir, rm } from "node:fs/promises";

const dist = new URL("../dist/", import.meta.url);
const root = new URL("../", import.meta.url);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of ["index.html", "app.html", "src", "assets"]) {
  await cp(new URL(entry, root), new URL(entry, dist), { recursive: true });
}

console.log("Built desktop web assets in dist/");
