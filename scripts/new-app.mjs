// Scaffold a new app from apps/_template and register it in apps.json.
// Usage: npm run new -- my-app "Optional Title" "Optional one-line description"
import { cp, readFile, writeFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const [slug, titleArg, descArg] = process.argv.slice(2);

if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error('Usage: npm run new -- <kebab-case-name> ["Title"] ["Description"]');
  process.exit(1);
}

const dest = join(ROOT, "apps", slug);
if (await stat(dest).catch(() => null)) {
  console.error(`apps/${slug} already exists.`);
  process.exit(1);
}

const title =
  titleArg || slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const description = descArg || "";

await cp(join(ROOT, "apps", "_template"), dest, { recursive: true });

for (const name of await readdir(dest)) {
  const file = join(dest, name);
  if (!/\.(html|js|css|md)$/.test(name)) continue;
  const text = await readFile(file, "utf8");
  await writeFile(
    file,
    text.replaceAll("{{TITLE}}", title).replaceAll("{{DESCRIPTION}}", description)
  );
}

const registry = join(ROOT, "apps.json");
const apps = JSON.parse(await readFile(registry, "utf8"));
apps.push({ slug, title, description, created: new Date().toISOString().slice(0, 10) });
await writeFile(registry, JSON.stringify(apps, null, 2) + "\n");

console.log(`Created apps/${slug}/  ->  http://localhost:5173/apps/${slug}/`);
