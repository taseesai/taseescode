import fs from "fs-extra";
import path from "path";

const MEMORY_DIR = ".taseescode";
const MEMORY_FILE = "memory.md";
const MAX_MEMORY_LINES = 500; // Keep last 500 entries max
const MAX_ENTRY_LENGTH = 300; // Truncate long messages

function sanitize(text: string): string {
  return text
    .replace(/sk-[a-zA-Z0-9_-]{20,}/g, '***KEY_REDACTED***')
    .replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, '***KEY_REDACTED***')
    .replace(/gsk_[a-zA-Z0-9_-]{20,}/g, '***KEY_REDACTED***')
    .replace(/Bearer\s+[a-zA-Z0-9_.-]{20,}/g, 'Bearer ***REDACTED***')
    .replace(/eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '***JWT_REDACTED***')
    .replace(/ghp_[a-zA-Z0-9]{20,}/g, '***GITHUB_TOKEN_REDACTED***')
    .replace(/xox[bpsa]-[a-zA-Z0-9-]{20,}/g, '***SLACK_TOKEN_REDACTED***');
}

/**
 * AutoMemory — persistent, silent, always-on memory for every project.
 *
 * Saves every exchange automatically. Loads silently on startup.
 * No user interaction needed. The AI always knows what happened.
 *
 * Stored in: .taseescode/memory.md (per-project, gitignored)
 */
export class AutoMemory {
  private memoryPath: string;
  private cwd: string;
  private buffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(cwd: string) {
    this.cwd = cwd;
    const dir = path.join(cwd, MEMORY_DIR);
    this.memoryPath = path.join(dir, MEMORY_FILE);
  }

  /**
   * Initialize — ensure directory exists, add to .gitignore
   */
  async init(): Promise<void> {
    const dir = path.join(this.cwd, MEMORY_DIR);
    await fs.ensureDir(dir);

    // Auto-add .taseescode to .gitignore if not already there
    const gitignorePath = path.join(this.cwd, ".gitignore");
    try {
      if (await fs.pathExists(gitignorePath)) {
        const content = await fs.readFile(gitignorePath, "utf-8");
        if (!content.includes(".taseescode")) {
          await fs.appendFile(gitignorePath, "\n# TaseesCode memory\n.taseescode/\n");
        }
      } else {
        // Only create .gitignore if project has a .git directory
        if (await fs.pathExists(path.join(this.cwd, ".git"))) {
          await fs.writeFile(gitignorePath, "# TaseesCode memory\n.taseescode/\n");
        }
      }
    } catch {
      // Silent — don't fail on gitignore issues
    }
  }

  /**
   * Load full memory for injection into system prompt.
   * Returns null if no memory exists yet.
   */
  async load(): Promise<string | null> {
    try {
      if (!(await fs.pathExists(this.memoryPath))) {
        return null;
      }
      const content = await fs.readFile(this.memoryPath, "utf-8");
      if (!content.trim()) return null;

      // Return the last portion if file is very large
      const lines = content.split("\n");
      if (lines.length > MAX_MEMORY_LINES) {
        const header = "# TaseesCode Memory (auto-saved)\n\n[...older entries truncated...]\n\n";
        return header + lines.slice(-MAX_MEMORY_LINES).join("\n");
      }
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Record a user message — called automatically on every input
   */
  recordUser(message: string): void {
    const timestamp = new Date().toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false
    });
    const truncated = message.length > MAX_ENTRY_LENGTH
      ? message.slice(0, MAX_ENTRY_LENGTH) + "..."
      : message;
    this.buffer.push(`[${timestamp}] **User:** ${sanitize(truncated)}`);
    this.scheduleFlush();
  }

  /**
   * Record an assistant response — called automatically on every response
   */
  recordAssistant(message: string): void {
    const truncated = message.length > MAX_ENTRY_LENGTH
      ? message.slice(0, MAX_ENTRY_LENGTH) + "..."
      : message;
    this.buffer.push(`**TaseesCode:** ${sanitize(truncated)}`);
    this.buffer.push(""); // blank line between exchanges
    this.scheduleFlush();
  }

  /**
   * Record a tool execution — called automatically
   */
  recordTool(name: string, success: boolean, result?: string): void {
    const status = success ? "✓" : "✗";
    const summary = result
      ? (result.length > 100 ? result.slice(0, 100) + "..." : result)
      : "";
    this.buffer.push(`  ${status} \`${name}\`${summary ? ": " + sanitize(summary) : ""}`);
    this.scheduleFlush();
  }

  /**
   * Record a key decision or important context
   */
  recordNote(note: string): void {
    this.buffer.push(`📌 ${note}`);
    this.scheduleFlush();
  }

  /**
   * Flush buffer to disk — short debounce but also register exit handler
   */
  private scheduleFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => this.flush(), 500); // 500ms debounce (was 2s)

    // Ensure flush on unexpected exit (Ctrl+C, crash)
    this.registerExitHandler();
  }

  private exitHandlerRegistered = false;
  private registerExitHandler(): void {
    if (this.exitHandlerRegistered) return;
    this.exitHandlerRegistered = true;

    const flushSync = () => {
      if (this.buffer.length === 0) return;
      try {
        const fs = require('fs');
        const dir = path.join(this.cwd, MEMORY_DIR);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const entries = this.buffer.join("\n") + "\n";
        this.buffer = [];
        fs.appendFileSync(this.memoryPath, entries, "utf-8");
      } catch {}
    };

    process.on('exit', flushSync);
    process.on('SIGINT', () => { flushSync(); process.exit(0); });
    process.on('SIGTERM', () => { flushSync(); process.exit(0); });
  }

  /**
   * Force flush to disk immediately
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    try {
      const dir = path.join(this.cwd, MEMORY_DIR);
      await fs.ensureDir(dir);

      const entries = this.buffer.join("\n") + "\n";
      this.buffer = [];

      // Append to file
      await fs.appendFile(this.memoryPath, entries, "utf-8");

      // Trim if file is too large
      await this.trimIfNeeded();
    } catch {
      // Silent — never fail on memory writes
    }
  }

  /**
   * Trim memory file to keep it manageable
   */
  private async trimIfNeeded(): Promise<void> {
    try {
      const content = await fs.readFile(this.memoryPath, "utf-8");
      const lines = content.split("\n");

      if (lines.length > MAX_MEMORY_LINES * 1.5) {
        // Keep header + recent entries
        const header = "# TaseesCode Memory (auto-saved)\n\n";
        const kept = lines.slice(-MAX_MEMORY_LINES).join("\n");
        await fs.writeFile(this.memoryPath, header + kept, "utf-8");
      }
    } catch {
      // Silent
    }
  }

  /**
   * Get memory stats
   */
  async getStats(): Promise<{ entries: number; sizeKB: number } | null> {
    try {
      if (!(await fs.pathExists(this.memoryPath))) return null;
      const stat = await fs.stat(this.memoryPath);
      const content = await fs.readFile(this.memoryPath, "utf-8");
      const entries = (content.match(/\*\*User:\*\*/g) || []).length;
      return {
        entries,
        sizeKB: Math.round(stat.size / 1024),
      };
    } catch {
      return null;
    }
  }
}
