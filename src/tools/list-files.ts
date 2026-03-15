import { glob } from "glob";
import path from "path";
import { registerTool, ToolResult } from "../core/tools";

registerTool({
  name: "list_files",
  description: "List files in a directory, optionally matching a glob pattern",
  parameters: {
    type: "object",
    properties: {
      directory: { type: "string", description: "Directory to list" },
      pattern: { type: "string", description: "Glob pattern to filter (optional)" },
    },
    required: ["directory"],
  },
  requiresApproval: false,
  async execute(args): Promise<ToolResult> {
    const dir = path.resolve(args.directory as string);
    const pattern = (args.pattern as string) || "**/*";
    try {
      const files = await glob(pattern, {
        cwd: dir,
        nodir: true,
        maxDepth: 3,
        ignore: ["node_modules/**", ".git/**"],
      });
      return { success: true, output: files.join("\n") || "(no files found)" };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: "", error: msg };
    }
  },
});
