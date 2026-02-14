import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function loadEnv(dir: string) {
  for (const name of [".env", ".env.local"]) {
    const p = resolve(dir, name);
    if (existsSync(p)) {
      for (const line of readFileSync(p, "utf8").split(/\n/)) {
        const trimmed = line.replace(/#.*/, "").trim();
        const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
      }
    }
  }
}
const scriptDir = dirname(fileURLToPath(import.meta.url));
loadEnv(process.cwd());
loadEnv(resolve(scriptDir, ".."));
