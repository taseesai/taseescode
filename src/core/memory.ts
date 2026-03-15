import fs from "fs-extra";
import path from "path";

const MEMORY_FILENAME = "TASEESCODE.md";

export async function readMemory(cwd: string): Promise<string | null> {
  const memPath = path.join(cwd, MEMORY_FILENAME);
  if (await fs.pathExists(memPath)) {
    return fs.readFile(memPath, "utf-8");
  }
  return null;
}

export async function writeMemory(cwd: string, content: string): Promise<void> {
  const memPath = path.join(cwd, MEMORY_FILENAME);
  await fs.writeFile(memPath, content, "utf-8");
}

export async function resetMemory(cwd: string): Promise<void> {
  const memPath = path.join(cwd, MEMORY_FILENAME);
  if (await fs.pathExists(memPath)) {
    await fs.remove(memPath);
  }
}

export async function appendMemory(cwd: string, entry: string): Promise<void> {
  const existing = (await readMemory(cwd)) || "";
  const updated = existing + "\n" + entry;
  await writeMemory(cwd, updated.trim());
}
