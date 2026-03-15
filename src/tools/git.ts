import simpleGit from "simple-git";
import { registerTool, ToolResult } from "../core/tools";

const git = simpleGit();

registerTool({
  name: "git_diff",
  description: "Show git diff of current changes",
  parameters: {
    type: "object",
    properties: {
      staged: { type: "boolean", description: "Show only staged changes" },
    },
    required: [],
  },
  requiresApproval: false,
  async execute(args): Promise<ToolResult> {
    try {
      const staged = args.staged as boolean;
      const diff = staged ? await git.diff(["--cached"]) : await git.diff();
      return { success: true, output: diff || "(no changes)" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: "", error: msg };
    }
  },
});

registerTool({
  name: "git_commit",
  description: "Stage all changes and create a git commit",
  parameters: {
    type: "object",
    properties: {
      message: { type: "string", description: "Commit message" },
    },
    required: ["message"],
  },
  requiresApproval: true,
  async execute(args): Promise<ToolResult> {
    try {
      await git.add(".");
      const result = await git.commit(args.message as string);
      return {
        success: true,
        output: `Committed: ${result.commit} — ${result.summary.changes} files changed`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: "", error: msg };
    }
  },
});
