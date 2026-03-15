import path from "path";

const cwd = process.cwd();

export function safePath(filePath: string): string {
  const resolved = path.resolve(cwd, filePath);
  if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
    throw new Error(`Access denied: path "${filePath}" is outside the project directory`);
  }
  return resolved;
}
