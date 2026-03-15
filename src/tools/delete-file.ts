import fs from "fs-extra";
import { registerTool, ToolResult } from "../core/tools";
import { safePath } from "../utils/path-guard";

registerTool({
  name: "delete_file",
  description: "Delete a file at the given path",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file to delete" },
    },
    required: ["path"],
  },
  requiresApproval: true,
  async execute(args): Promise<ToolResult> {
    const filePath = safePath(args.path as string);
    try {
      if (!(await fs.pathExists(filePath))) {
        return { success: false, output: "", error: `File not found: ${filePath}` };
      }
      await fs.remove(filePath);
      return { success: true, output: `Deleted ${filePath}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: "", error: msg };
    }
  },
});
