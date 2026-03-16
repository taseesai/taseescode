// /health — Quick codebase health analysis
import chalk from "chalk";
import path from "path";
import fs from "fs-extra";
import { execSync } from "child_process";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  yellow: chalk.hex("#C9A962"),
  red: chalk.hex("#C75050"),
};

const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "__pycache__", ".cache"]);
const TODO_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py"]);
const TODO_PATTERN = /\b(TODO|FIXME|HACK|XXX)\b/;

function walkFiles(dir: string, maxFiles: number = 500): string[] {
  const results: string[] = [];

  function recurse(current: string, depth: number) {
    if (depth > 8 || results.length >= maxFiles) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= maxFiles) return;
      if (IGNORE_DIRS.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        recurse(full, depth + 1);
      } else if (entry.isFile()) {
        results.push(full);
      }
    }
  }

  recurse(dir, 0);
  return results;
}

function countTodos(files: string[]): number {
  let count = 0;
  for (const file of files) {
    const ext = path.extname(file);
    if (!TODO_EXTENSIONS.has(ext)) continue;
    try {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (const line of lines) {
        if (TODO_PATTERN.test(line)) count++;
      }
    } catch {}
  }
  return count;
}

export async function handleHealth(args: string): Promise<string> {
  try {
    const cwd = process.cwd();

    const lines: string[] = [
      "",
      p.white.bold("Codebase Health Report"),
      p.gray("━".repeat(40)),
      "",
    ];

    // Package info
    const pkgPath = path.join(cwd, "package.json");
    if (await fs.pathExists(pkgPath)) {
      const pkg = await fs.readJSON(pkgPath);
      lines.push(p.white(`  Project: ${pkg.name || "unnamed"} v${pkg.version || "0.0.0"}`));
      const depCount = Object.keys(pkg.dependencies || {}).length;
      const devDepCount = Object.keys(pkg.devDependencies || {}).length;
      lines.push(p.dim(`  Dependencies: ${depCount} prod, ${devDepCount} dev`));
      lines.push("");
    }

    // Git status (git is cross-platform, keep execSync)
    try {
      const status = execSync("git status --porcelain", { encoding: "utf8", timeout: 5000 });
      const modified = (status.match(/^ M/gm) || []).length;
      const untracked = (status.match(/^\?\?/gm) || []).length;
      const staged = (status.match(/^[AMDR] /gm) || []).length;
      lines.push(p.gray(`  Git: ${modified} modified, ${untracked} untracked, ${staged} staged`));

      const branch = execSync("git branch --show-current", { encoding: "utf8", timeout: 5000 }).trim();
      lines.push(p.gray(`  Branch: ${branch}`));

      const commitCount = execSync('git rev-list --count HEAD 2>/dev/null || echo 0', { encoding: "utf8", timeout: 5000 }).trim();
      lines.push(p.gray(`  Commits: ${commitCount}`));
    } catch {
      lines.push(p.dim("  Git: not a git repository"));
    }
    lines.push("");

    // File counts by type (Node.js native)
    const allFiles = walkFiles(cwd);
    const exts: Record<string, number> = {};
    for (const f of allFiles) {
      const ext = path.extname(f) || "(none)";
      exts[ext] = (exts[ext] || 0) + 1;
    }
    const sorted = Object.entries(exts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    lines.push(p.white("  File types:"));
    for (const [ext, count] of sorted) {
      lines.push(p.dim(`    ${ext}: ${count}`));
    }
    lines.push(p.gray(`    Total: ${allFiles.length} files`));
    lines.push("");

    // TODO/FIXME count (Node.js native)
    const totalTodos = countTodos(allFiles);
    const todoColor = totalTodos > 20 ? p.yellow : totalTodos > 0 ? p.gray : p.green;
    lines.push(todoColor(`  TODOs/FIXMEs: ${totalTodos}`));

    lines.push("");
    return lines.join("\n");
  } catch (e: any) {
    return p.red(`Health check error: ${e.message}`).toString();
  }
}
