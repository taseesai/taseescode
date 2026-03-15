import { glob } from "glob";
import fs from "fs-extra";
import path from "path";
import { registerTool, ToolResult } from "../core/tools";

registerTool({
  name: "search_code",
  description: "Search for a text pattern across project files",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Text or regex pattern to search for" },
      filePattern: { type: "string", description: "Glob pattern to filter files (optional)" },
    },
    required: ["query"],
  },
  requiresApproval: false,
  async execute(args): Promise<ToolResult> {
    const query = args.query as string;
    const filePattern = (args.filePattern as string) || "**/*";
    const cwd = process.cwd();

    try {
      const files = await glob(filePattern, {
        cwd,
        nodir: true,
        maxDepth: 5,
        ignore: ["node_modules/**", ".git/**", "dist/**"],
      });

      const results: string[] = [];
      const regex = new RegExp(query, "gi");

      for (const file of files.slice(0, 100)) {
        try {
          const content = await fs.readFile(path.join(cwd, file), "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push(`${file}:${i + 1}: ${lines[i].trim()}`);
              regex.lastIndex = 0;
            }
          }
        } catch {
          // Skip binary or unreadable files
        }
        if (results.length > 50) break;
      }

      return {
        success: true,
        output: results.length > 0 ? results.join("\n") : "No matches found",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: "", error: msg };
    }
  },
});
