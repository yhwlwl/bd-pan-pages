import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const tempRoot = await mkdtemp(join(tmpdir(), "bd-pan-pages-"));
const project = join(tempRoot, "project");
const excluded = new Set([
  ".git",
  ".next",
  ".vercel",
  ".wrangler",
  "coverage",
  "node_modules",
  "out",
  "playwright-report",
  "test-results",
]);

try {
  await cp(root, project, {
    recursive: true,
    filter(source) {
      const rel = relative(root, source);
      if (!rel) return true;
      const parts = rel.split(sep);
      if (parts.some((part) => excluded.has(part))) return false;
      if (parts.some((part) => part === ".env" || part.startsWith(".env."))) return false;
      return true;
    },
  });

  await symlink(join(root, "node_modules"), join(project, "node_modules"), "dir");

  // Pages serves the exported UI; the existing Aliyun Next.js server continues
  // to provide the API routes and middleware used by the browser.
  await rm(join(project, "src", "app", "api"), { recursive: true, force: true });
  await rm(join(project, "src", "middleware.ts"), { force: true });

  // This module only collects server logs and is not part of the static UI.
  const layoutPath = join(project, "src", "app", "layout.tsx");
  const layout = await readFile(layoutPath, "utf8");
  await writeFile(
    layoutPath,
    layout.replace(/^import\s+["']\.\.\/lib\/server-log["'];\r?\n/m, ""),
    "utf8",
  );

  const panApiBase = process.env.PAGES_PAN_API_BASE || "https://pan.tantantan.tech/pan";
  const wlmApiBase = process.env.PAGES_WLM_API_BASE || "https://pan.tantantan.tech/wlm-api";
  const env = {
    ...process.env,
    CF_PAGES_STATIC_BUILD: "1",
    NEXT_PUBLIC_API_BASE: panApiBase,
    NEXT_PUBLIC_PAGES_API_BASE: panApiBase,
    NEXT_PUBLIC_WLM_API_BASE: wlmApiBase,
  };

  const nextBin = join(project, "node_modules", "next", "dist", "bin", "next");
  const result = spawnSync(process.execPath, [nextBin, "build", "--webpack"], {
    cwd: project,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Next.js Pages build exited with status ${result.status}`);

  const out = join(root, "out");
  await rm(out, { recursive: true, force: true });
  await cp(join(project, "out"), out, { recursive: true });
  await mkdir(out, { recursive: true });
  await cp(join(project, "cloudflare", "_headers"), join(out, "_headers"));
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
