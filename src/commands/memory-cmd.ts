import chalk from "chalk";
import { readMemory, resetMemory } from "../core/memory";

export async function memoryCommand(args: string[]): Promise<string> {
  const cwd = process.cwd();

  if (args[0] === "reset") {
    await resetMemory(cwd);
    return "Project memory (TASEESCODE.md) cleared.";
  }

  const memory = await readMemory(cwd);
  if (!memory) {
    return `${chalk.hex("#707070")("No TASEESCODE.md found in this project.")}`;
  }

  return `\n${chalk.hex("#E8E8E8").bold("TASEESCODE.md")}\n${chalk.hex("#8B8B8B")("─".repeat(35))}\n${memory}\n`;
}
