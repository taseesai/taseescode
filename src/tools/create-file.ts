import fs from "fs-extra";
import path from "path";
import { registerTool, ToolResult } from "../core/tools";
import { safePath } from "../utils/path-guard";

registerTool({
  name: "create_file",
  description: "Create a new file with the given content",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path for the new file" },
      content: { type: "string", description: "Content for the new file" },
    },
    required: ["path", "content"],
  },
  requiresApproval: true,
  async execute(args): Promise<ToolResult> {
    const filePath = safePath(args.path as string);
    try {
      if (await fs.pathExists(filePath)) {
        return { success: false, output: "", error: `File already exists: ${filePath}` };
      }
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, args.content as string, "utf-8");
      return { success: true, output: `Created ${filePath}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: "", error: msg };
    }
  },
});
