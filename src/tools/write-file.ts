import fs from "fs-extra";
import path from "path";
import { registerTool, ToolResult } from "../core/tools";

registerTool({
  name: "write_file",
  description: "Write content to an existing file, replacing its contents",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file to write" },
      content: { type: "string", description: "Content to write to the file" },
    },
    required: ["path", "content"],
  },
  requiresApproval: true,
  async execute(args): Promise<ToolResult> {
    const filePath = path.resolve(args.path as string);
    try {
      await fs.writeFile(filePath, args.content as string, "utf-8");
      return { success: true, output: `Written to ${filePath}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: "", error: msg };
    }
  },
});
