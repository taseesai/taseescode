import fs from "fs-extra";
import path from "path";
import ignore from "ignore";
import { glob } from "glob";

export interface ProjectContext {
  cwd: string;
  files: string[];
  hasGit: boolean;
  taseesMd: string | null;
}

export async function readProjectContext(cwd: string): Promise<ProjectContext> {
  const hasGit = await fs.pathExists(path.join(cwd, ".git"));
  const taseesMdPath = path.join(cwd, "TASEESCODE.md");
  const taseesMd = (await fs.pathExists(taseesMdPath))
    ? await fs.readFile(taseesMdPath, "utf-8")
    : null;

  // Read .gitignore patterns
  const ig = ignore();
  const gitignorePath = path.join(cwd, ".gitignore");
  if (await fs.pathExists(gitignorePath)) {
    const gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
    ig.add(gitignoreContent);
  }
  // Always ignore these
  ig.add(["node_modules", ".git", "dist", "build", ".next"]);

  // List project files (limited depth for context)
  let allFiles: string[] = [];
  try {
    allFiles = await glob("**/*", {
      cwd,
      nodir: true,
      dot: false,
      maxDepth: 4,
    });
    allFiles = allFiles.filter((f) => !ig.ignores(f));
    // Limit to 200 files for context
    allFiles = allFiles.slice(0, 200);
  } catch {
    // Silently handle glob errors
  }

  return { cwd, files: allFiles, hasGit, taseesMd };
}

export function buildFileTree(files: string[]): string {
  if (files.length === 0) return "(empty project)";
  const tree = files.slice(0, 50).join("\n");
  const suffix = files.length > 50 ? `\n... and ${files.length - 50} more files` : "";
  return tree + suffix;
}
