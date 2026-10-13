import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPublicSite } from "../public-site/site.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist");

const files = [
  "booking.html",
  "bound.html",
  "calendar.html",
  "history.html",
  "review.html",
];

const directories = ["admin", "admin-login", "design-admin", "security", "client-preview", "sitter-preview"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of files) {
  await cp(resolve(root, file), resolve(output, file));
}

for (const directory of directories) {
  await cp(resolve(root, directory), resolve(output, directory), {
    recursive: true,
  });
}

await cp(resolve(root, "_headers"), resolve(output, "_headers"));
await buildPublicSite(output);

console.log(`Cloudflare static bundle created at ${output}`);
