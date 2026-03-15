import { execSync } from "child_process";
import path from "path";
import { registerTool, ToolResult } from "../core/tools";

registerTool({
  name: "run_command",
  description: "Run a shell command and return its output",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "The shell command to execute" },
      cwd: { type: "string", description: "Working directory (optional)" },
    },
    required: ["command"],
  },
  requiresApproval: true,
  async execute(args): Promise<ToolResult> {
    const command = args.command as string;
    const cwd = args.cwd ? path.resolve(args.cwd as string) : process.cwd();
    try {
      const output = execSync(command, {
        cwd,
        encoding: "utf-8",
        timeout: 30000,
        maxBuffer: 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return { success: true, output: output.trim() };
    } catch (err: unknown) {
      if (err && typeof err === "object" && "stdout" in err) {
        const execErr = err as { stdout: string; stderr: string; status: number };
        return {
          success: false,
          output: execErr.stdout || "",
          error: execErr.stderr || `Exit code: ${execErr.status}`,
        };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: "", error: msg };
    }
  },
});
