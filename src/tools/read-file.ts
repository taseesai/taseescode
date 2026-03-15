import fs from "fs-extra";
import { registerTool, ToolResult } from "../core/tools";
import { safePath } from "../utils/path-guard";

registerTool({
  name: "read_file",
  description: "Read the contents of a file at the given path",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file to read" },
    },
    required: ["path"],
  },
  requiresApproval: false,
  async execute(args): Promise<ToolResult> {
    const filePath = safePath(args.path as string);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return { success: true, output: content };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: "", error: msg };
    }
  },
});
