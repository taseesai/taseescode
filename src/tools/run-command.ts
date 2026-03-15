import { execSync, spawn } from "child_process";
import path from "path";
import { registerTool, ToolResult } from "../core/tools";
import { safePath } from "../utils/path-guard";

registerTool({
  name: "run_command",
  description:
    "Run a shell command and return its output. For long-running processes (dev servers, watchers), set background: true — the process will keep running and the first output is returned.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "The shell command to execute" },
      cwd: { type: "string", description: "Working directory (optional)" },
      background: {
        type: "boolean",
        description:
          "Set true for long-running processes (npm run dev, servers). Starts in background and returns initial output.",
      },
    },
    required: ["command"],
  },
  requiresApproval: true,
  async execute(args): Promise<ToolResult> {
    const command = args.command as string;
    const cwd = args.cwd ? path.resolve(args.cwd as string) : process.cwd();
    const background = args.background as boolean;

    // Block dangerous commands
    const dangerous = [
      /rm\s+(-rf?|--recursive)\s+[/~]/i,
      /sudo\s+rm/i,
      /mkfs/i,
      /dd\s+if=/i,
      />\s*\/dev\/sd/i,
      /chmod\s+777\s+\//,
    ];
    for (const pattern of dangerous) {
      if (pattern.test(command)) {
        return {
          success: false,
          output: "",
          error: "Blocked: this command is potentially destructive to the system.",
        };
      }
    }

    // Background mode — for dev servers, watchers, long-running processes
    if (background) {
      return new Promise((resolve) => {
        const child = spawn("sh", ["-c", command], {
          cwd,
          detached: true,
          stdio: ["ignore", "pipe", "pipe"],
        });

        let output = "";
        let errorOutput = "";
        let resolved = false;

        const finish = (success: boolean) => {
          if (resolved) return;
          resolved = true;
          child.stdout?.removeAllListeners();
          child.stderr?.removeAllListeners();
          // Don't kill the process — let it run in background
          child.unref();
          resolve({
            success,
            output: output.trim() || "(process started in background)",
            error: errorOutput.trim() || undefined,
          });
        };

        child.stdout?.on("data", (data: Buffer) => {
          output += data.toString();
          // Detect server-ready signals
          const text = output.toLowerCase();
          if (
            text.includes("ready in") ||
            text.includes("listening on") ||
            text.includes("started on") ||
            text.includes("localhost:") ||
            text.includes("server running") ||
            text.includes("compiled successfully") ||
            text.includes("watching for")
          ) {
            // Give it a moment to fully start
            setTimeout(() => finish(true), 1500);
          }
        });

        child.stderr?.on("data", (data: Buffer) => {
          errorOutput += data.toString();
        });

        child.on("error", (err) => {
          resolve({
            success: false,
            output: "",
            error: err.message,
          });
        });

        child.on("exit", (code) => {
          if (!resolved) {
            finish(code === 0);
          }
        });

        // Timeout: if no ready signal after 15s, return whatever we have
        setTimeout(() => {
          finish(output.length > 0);
        }, 15000);
      });
    }

    // Normal sync mode
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
        const execErr = err as {
          stdout: string;
          stderr: string;
          status: number;
        };
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
