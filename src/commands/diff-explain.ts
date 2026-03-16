import chalk from "chalk";
import { execFileSync } from "child_process";
import { Agent } from "../core/agent";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  red: chalk.hex("#C75050"),
};

function isSafeGitRef(ref: string): boolean {
  return /^[a-zA-Z0-9._\-~\/]+$/.test(ref);
}

export async function handleDiffExplain(args: string, agent: Agent): Promise<string> {
  const subCmd = args.trim();

  if (subCmd.toLowerCase() === "help") {
    return [
      "",
      p.white.bold("Diff-Explain — AI-Narrated Code Changes"),
      p.gray("\u2501".repeat(40)),
      "",
      "  /diff-explain              Explain all unstaged changes",
      "  /diff-explain staged       Explain staged changes only",
      "  /diff-explain <file>       Explain changes in a specific file",
      "  /diff-explain HEAD~1       Explain last commit's changes",
      "",
      "  For each change block, the AI explains:",
      "  * What changed and why",
      "  * What other files might be affected",
      "  * Potential risks or issues",
      "",
      p.dim("  Makes code reviews 3x faster."),
      "",
    ].join("\n");
  }

  let diff = "";
  let diffLabel = "";

  try {
    if (!subCmd || subCmd.toLowerCase() === "all") {
      diff = execFileSync("git", ["diff"], { encoding: "utf-8", timeout: 10000 });
      diffLabel = "unstaged changes";
    } else if (subCmd.toLowerCase() === "staged") {
      diff = execFileSync("git", ["diff", "--cached"], { encoding: "utf-8", timeout: 10000 });
      diffLabel = "staged changes";
    } else if (subCmd.startsWith("HEAD") || subCmd.match(/^[a-f0-9]{6,}$/)) {
      if (!isSafeGitRef(subCmd)) {
        return p.red("Invalid git ref. Only alphanumeric, dots, slashes, tildes, and hyphens are allowed.").toString();
      }
      diff = execFileSync("git", ["diff", subCmd], { encoding: "utf-8", timeout: 10000 });
      diffLabel = `changes since ${subCmd}`;
    } else {
      // Treat as file path
      if (!isSafeGitRef(subCmd)) {
        return p.red("Invalid file path. Only alphanumeric, dots, slashes, tildes, and hyphens are allowed.").toString();
      }
      diff = execFileSync("git", ["diff", "--", subCmd], { encoding: "utf-8", timeout: 10000 });
      diffLabel = `changes in ${subCmd}`;
    }
  } catch (e: any) {
    return p.red(`Git error: ${e.message}. Make sure you're in a git repository.`).toString();
  }

  if (!diff.trim()) {
    return p.dim(`No ${diffLabel} found.`).toString();
  }

  // Send to AI for narrated explanation
  const maxLen = 8000;
  const truncated = diff.length > maxLen
    ? diff.slice(0, maxLen) + `\n[... diff truncated — showing ${maxLen} of ${diff.length} chars ...]`
    : diff;

  await agent.processMessage(
    `Explain these code changes (${diffLabel}). For each changed file/section:\n` +
    `1. What changed (brief summary)\n` +
    `2. Why this change matters\n` +
    `3. Impact — what other parts of the code might be affected\n` +
    `4. Any potential risks or issues\n\n` +
    `Be concise. Use bullet points.\n\n` +
    `\`\`\`diff\n${truncated}\n\`\`\``
  );

  return "";
}
