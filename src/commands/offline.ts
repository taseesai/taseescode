import chalk from "chalk";
import { execSync } from "child_process";
import { getConfig, setConfig } from "../utils/config";
import { MODEL_REGISTRY, registerCustomModel } from "../models";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  yellow: chalk.hex("#C9A962"),
  red: chalk.hex("#C75050"),
};

function isOllamaRunning(): boolean {
  try {
    execSync("curl -s http://localhost:11434/api/tags", { timeout: 3000, stdio: "pipe" });
    return true;
  } catch { return false; }
}

function getOllamaModels(): string[] {
  try {
    const output = execSync("curl -s http://localhost:11434/api/tags", {
      timeout: 5000, encoding: "utf-8",
    });
    const data = JSON.parse(output);
    return (data.models || []).map((m: any) => m.name || m.model);
  } catch { return []; }
}

function isOnline(): boolean {
  try {
    execSync("curl -s --max-time 3 https://api.deepseek.com", { timeout: 5000, stdio: "pipe" });
    return true;
  } catch { return false; }
}

export async function handleOffline(args: string): Promise<string> {
  const subCmd = args.trim().toLowerCase();

  if (subCmd === "help" || (!subCmd && !isOllamaRunning())) {
    const ollamaStatus = isOllamaRunning();
    const onlineStatus = isOnline();

    return [
      "",
      p.white.bold("📡 Offline Mode — Local Model Fallback"),
      p.gray("━".repeat(40)),
      "",
      `  Internet:  ${onlineStatus ? p.green("✅ Online") : p.red("❌ Offline")}`,
      `  Ollama:    ${ollamaStatus ? p.green("✅ Running") : p.yellow("⚠️ Not running")}`,
      "",
      "  /offline              Check status & available local models",
      "  /offline on           Enable auto-fallback to local models",
      "  /offline off          Disable auto-fallback",
      "  /offline models       List local Ollama models",
      "  /offline setup        Setup guide for Ollama",
      "",
      "  When enabled:",
      "  • TaseesCode auto-switches to Ollama if API calls fail",
      "  • Switches back when internet returns",
      "  • Shows indicator: [LOCAL] or [CLOUD]",
      "",
      !ollamaStatus ? [
        p.dim("  Quick setup:"),
        p.dim("  1. Install Ollama: brew install ollama"),
        p.dim("  2. Start it: ollama serve"),
        p.dim("  3. Pull a model: ollama pull llama3.2"),
        p.dim("  4. Run: /offline on"),
      ].join("\n") : "",
      "",
    ].filter(Boolean).join("\n");
  }

  if (subCmd === "on") {
    if (!isOllamaRunning()) {
      return [
        p.yellow("⚠️ Ollama is not running."),
        "",
        "  Start it first:",
        p.white("  ollama serve"),
        "",
        "  Then try /offline on again.",
      ].join("\n");
    }

    const models = getOllamaModels();
    if (models.length === 0) {
      return [
        p.yellow("⚠️ Ollama is running but no models installed."),
        "",
        "  Pull a model first:",
        p.white("  ollama pull llama3.2"),
        p.white("  ollama pull codellama"),
        "",
        "  Then try /offline on again.",
      ].join("\n");
    }

    // Register Ollama as a custom model
    const bestModel = models.find(m => m.includes("llama3") || m.includes("codellama")) || models[0];

    if (!MODEL_REGISTRY["custom:ollama"]) {
      registerCustomModel("ollama", "http://localhost:11434/v1");
    }

    setConfig("offlineEnabled" as any, true);
    setConfig("offlineModel" as any, `custom:ollama`);

    return [
      p.green("✅ Offline mode enabled!"),
      "",
      `  Local model: ${p.white(bestModel)}`,
      `  ${p.dim("TaseesCode will auto-switch to local model if internet drops.")}`,
      `  ${p.dim("Use /offline off to disable.")}`,
    ].join("\n");
  }

  if (subCmd === "off") {
    setConfig("offlineEnabled" as any, false);
    return p.green("✅ Offline mode disabled. Using cloud models only.").toString();
  }

  if (subCmd === "models") {
    if (!isOllamaRunning()) {
      return p.yellow("Ollama is not running. Start with: ollama serve").toString();
    }
    const models = getOllamaModels();
    if (models.length === 0) {
      return "No local models found. Pull one with: ollama pull llama3.2";
    }
    const lines = [
      "",
      p.white.bold("📡 Local Models (Ollama)"),
      p.gray("━".repeat(30)),
      "",
      ...models.map(m => `  • ${p.white(m)}`),
      "",
      p.dim("  Pull more: ollama pull <model-name>"),
      p.dim("  Popular: llama3.2, codellama, mistral, phi3"),
      "",
    ];
    return lines.join("\n");
  }

  if (subCmd === "setup") {
    return [
      "",
      p.white.bold("📡 Ollama Setup Guide"),
      p.gray("━".repeat(40)),
      "",
      p.white("  Step 1: Install Ollama"),
      p.dim("  macOS:   brew install ollama"),
      p.dim("  Linux:   curl -fsSL https://ollama.com/install.sh | sh"),
      p.dim("  Windows: Download from ollama.com"),
      "",
      p.white("  Step 2: Start the server"),
      p.dim("  ollama serve"),
      "",
      p.white("  Step 3: Pull a model"),
      p.dim("  ollama pull llama3.2        (8B, general purpose)"),
      p.dim("  ollama pull codellama       (code-focused)"),
      p.dim("  ollama pull mistral         (7B, fast)"),
      p.dim("  ollama pull phi3            (3.8B, tiny & fast)"),
      "",
      p.white("  Step 4: Enable in TaseesCode"),
      p.dim("  /offline on"),
      "",
      p.dim("  Models run 100% on your machine. No internet needed."),
      p.dim("  No API costs. Your code never leaves your device."),
      "",
    ].join("\n");
  }

  // Default: show status
  const ollamaRunning = isOllamaRunning();
  const online = isOnline();
  const models = ollamaRunning ? getOllamaModels() : [];
  const cfg = getConfig() as any;

  return [
    "",
    p.white.bold("📡 Offline Status"),
    p.gray("━".repeat(30)),
    "",
    `  Internet:       ${online ? p.green("✅ Online") : p.red("❌ Offline")}`,
    `  Ollama:         ${ollamaRunning ? p.green("✅ Running") : p.dim("Not running")}`,
    `  Auto-fallback:  ${cfg.offlineEnabled ? p.green("✅ Enabled") : p.dim("Disabled")}`,
    `  Local models:   ${models.length > 0 ? p.white(models.join(", ")) : p.dim("none")}`,
    "",
  ].join("\n");
}
