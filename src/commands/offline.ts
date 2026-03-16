import chalk from "chalk";
import { execSync, spawn } from "child_process";
import { getConfig, setConfig, setNestedConfig } from "../utils/config";
import { MODEL_REGISTRY, registerCustomModel } from "../models";
import { ensureInstalled } from "../utils/auto-install";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  yellow: chalk.hex("#C9A962"),
  red: chalk.hex("#C75050"),
};

// Default model to auto-pull (small, fast, good for coding)
const DEFAULT_LOCAL_MODEL = "llama3.2";

function isOllamaInstalled(): boolean {
  try {
    execSync("which ollama", { stdio: "pipe", timeout: 3000 });
    return true;
  } catch { return false; }
}

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
    execSync("curl -s --max-time 3 https://1.1.1.1", { timeout: 5000, stdio: "pipe" });
    return true;
  } catch { return false; }
}

async function waitForOllama(maxWaitSec: number = 15): Promise<boolean> {
  for (let i = 0; i < maxWaitSec; i++) {
    if (isOllamaRunning()) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

function pullModel(model: string, onStatus?: (msg: string) => void): boolean {
  onStatus?.(`Downloading ${model}... (this may take a few minutes on first run)`);
  try {
    execSync(`ollama pull ${model}`, {
      timeout: 600000, // 10 minutes for large models
      stdio: "pipe",
      encoding: "utf-8",
    });
    return true;
  } catch { return false; }
}

/**
 * Full auto-setup: install Ollama → start it → pull model → register → switch
 * Everything happens automatically. User just types /offline on.
 */
async function fullAutoSetup(onStatus: (msg: string) => void): Promise<{ success: boolean; model: string; error?: string }> {
  // Step 1: Install Ollama if missing
  if (!isOllamaInstalled()) {
    onStatus("🔧 Installing Ollama...");

    if (process.platform === "darwin") {
      const result = ensureInstalled("ollama", { brew: "ollama" }, onStatus);
      if (!result.success) {
        return { success: false, model: "", error: "Could not install Ollama. Install manually: brew install ollama" };
      }
    } else if (process.platform === "linux") {
      onStatus("🔧 Installing Ollama for Linux...");
      try {
        execSync("curl -fsSL https://ollama.com/install.sh | sh", {
          timeout: 120000, stdio: "pipe", encoding: "utf-8",
        });
      } catch {
        return { success: false, model: "", error: "Could not install Ollama. Install manually: curl -fsSL https://ollama.com/install.sh | sh" };
      }
    } else {
      return { success: false, model: "", error: "Auto-install not supported on this platform. Download from ollama.com" };
    }

    if (!isOllamaInstalled()) {
      return { success: false, model: "", error: "Ollama installed but not found in PATH. Restart your terminal." };
    }
    onStatus("✅ Ollama installed!");
  }

  // Step 2: Start Ollama if not running
  if (!isOllamaRunning()) {
    onStatus("🚀 Starting Ollama server...");
    try {
      spawn("ollama", ["serve"], { detached: true, stdio: "ignore" }).unref();
    } catch {}

    const started = await waitForOllama(15);
    if (!started) {
      return { success: false, model: "", error: "Could not start Ollama. Try running 'ollama serve' manually in another terminal." };
    }
    onStatus("✅ Ollama server running!");
  }

  // Step 3: Pull a model if none exist
  let models = getOllamaModels();
  if (models.length === 0) {
    onStatus(`📦 No local models found. Pulling ${DEFAULT_LOCAL_MODEL}...`);
    onStatus(`   This is a one-time download (~4GB). TaseesCode will be fully free after this.`);

    const pulled = pullModel(DEFAULT_LOCAL_MODEL, onStatus);
    if (!pulled) {
      // Try a smaller model
      onStatus(`   ${DEFAULT_LOCAL_MODEL} failed. Trying phi3 (smaller, ~2GB)...`);
      const pulledSmall = pullModel("phi3", onStatus);
      if (!pulledSmall) {
        return { success: false, model: "", error: "Could not download any model. Check your internet connection and try: ollama pull llama3.2" };
      }
    }

    models = getOllamaModels();
    if (models.length === 0) {
      return { success: false, model: "", error: "Model pulled but not found. Try: ollama list" };
    }
    onStatus(`✅ Model ready: ${models[0]}`);
  }

  // Step 4: Register Ollama as a model
  const bestModel = models.find(m =>
    m.includes("llama3") || m.includes("codellama") || m.includes("qwen")
  ) || models[0];

  // Register in-memory
  if (!MODEL_REGISTRY["custom:ollama"]) {
    registerCustomModel("ollama", "http://localhost:11434/v1");
  }

  // Persist to config so it loads on next session
  const cfg = getConfig();
  const customApis = (cfg as any).customApis || {};
  customApis["ollama"] = {
    name: "ollama",
    baseUrl: "http://localhost:11434/v1",
    apiKey: "ollama",
    model: bestModel,
    addedAt: new Date().toISOString(),
  };
  setNestedConfig("customApis", customApis);

  return { success: true, model: bestModel };
}

export async function handleOffline(args: string): Promise<string> {
  const subCmd = args.trim().toLowerCase();

  if (subCmd === "help") {
    return [
      "",
      p.white.bold("📡 Offline Mode — Run TaseesCode 100% Free"),
      p.gray("━".repeat(45)),
      "",
      "  /offline on           Set up & switch to local models (fully automatic)",
      "  /offline off          Switch back to cloud models",
      "  /offline              Check status",
      "  /offline models       List local models",
      "  /offline pull <model> Download a specific model",
      "  /offline setup        Manual setup guide",
      "",
      p.white("  What /offline on does automatically:"),
      "  1. Installs Ollama (if not installed)",
      "  2. Starts the Ollama server",
      "  3. Downloads a free AI model (~4GB, one-time)",
      "  4. Switches TaseesCode to use it",
      "",
      p.green("  After setup: TaseesCode runs 100% free, 100% offline."),
      p.green("  Your code never leaves your machine. Zero API costs."),
      "",
      p.dim("  Popular models:"),
      p.dim("  llama3.2        8B, great for coding (default)"),
      p.dim("  codellama       Specialized for code"),
      p.dim("  mistral         7B, fast and capable"),
      p.dim("  phi3            3.8B, tiny and fast"),
      p.dim("  qwen2.5-coder   Code-optimized"),
      "",
    ].join("\n");
  }

  if (subCmd === "on") {
    const statusMessages: string[] = [];
    const onStatus = (msg: string) => { statusMessages.push(`  ${msg}`); };

    const result = await fullAutoSetup(onStatus);

    if (!result.success) {
      return [
        "",
        ...statusMessages,
        "",
        p.red(`  ❌ ${result.error}`),
        "",
      ].join("\n");
    }

    // Save config and switch model
    setConfig("offlineEnabled", true);
    setConfig("offlineModel", "custom:ollama");
    setConfig("defaultModel", "custom:ollama");

    return [
      "",
      p.green.bold("  ✅ Offline mode is ready!"),
      "",
      ...statusMessages,
      "",
      `  ${p.gray("Local model:")}   ${p.white(result.model)}`,
      `  ${p.gray("Cost:")}          ${p.green("FREE — forever")}`,
      `  ${p.gray("Privacy:")}       ${p.green("100% local — code never leaves your machine")}`,
      "",
      p.dim("  You're now using TaseesCode completely free."),
      p.dim("  Switch back anytime with: /offline off"),
      p.dim("  Download more models: /offline pull codellama"),
      "",
    ].join("\n");
  }

  if (subCmd === "off") {
    const cfg = getConfig();
    // Switch back to the best available cloud model
    const cloudModel = cfg.apiKeys?.deepseek ? "deepseek-v3"
      : cfg.apiKeys?.groq ? "llama-3.3-70b"
      : "deepseek-v3";
    setConfig("offlineEnabled", false);
    setConfig("defaultModel", cloudModel);
    return [
      p.green("✅ Switched back to cloud models."),
      `  ${p.dim("Now using:")} ${p.white(MODEL_REGISTRY[cloudModel]?.name || cloudModel)}`,
    ].join("\n");
  }

  if (subCmd.startsWith("pull ")) {
    const modelName = subCmd.replace("pull ", "").trim();
    if (!modelName) return "Usage: /offline pull <model-name>";

    if (!isOllamaRunning()) {
      return p.yellow("Ollama is not running. Run /offline on first.").toString();
    }

    const pulled = pullModel(modelName, (msg) => {});
    if (pulled) {
      return p.green(`✅ Downloaded: ${modelName}\n  Switch to it by setting the model in Ollama.`).toString();
    }
    return p.red(`❌ Failed to pull ${modelName}. Check the model name at ollama.com/library`).toString();
  }

  if (subCmd === "models") {
    if (!isOllamaRunning()) {
      return p.yellow("Ollama is not running. Run /offline on to set everything up.").toString();
    }
    const models = getOllamaModels();
    if (models.length === 0) return "No local models. Run /offline on to download one automatically.";
    return [
      "",
      p.white.bold("📡 Local Models"),
      p.gray("━".repeat(30)),
      "",
      ...models.map(m => `  • ${p.white(m)}`),
      "",
      p.dim("  Download more: /offline pull <model>"),
      p.dim("  Browse: ollama.com/library"),
      "",
    ].join("\n");
  }

  if (subCmd === "setup") {
    return [
      "",
      p.white.bold("📡 Manual Setup Guide"),
      p.gray("━".repeat(40)),
      "",
      p.dim("  Usually you don't need this — /offline on does everything."),
      p.dim("  But if auto-setup failed, follow these steps:"),
      "",
      p.white("  1. Install Ollama"),
      p.dim("     macOS:   brew install ollama"),
      p.dim("     Linux:   curl -fsSL https://ollama.com/install.sh | sh"),
      p.dim("     Windows: Download from ollama.com"),
      "",
      p.white("  2. Start the server"),
      p.dim("     ollama serve"),
      "",
      p.white("  3. Pull a model"),
      p.dim("     ollama pull llama3.2"),
      "",
      p.white("  4. Enable in TaseesCode"),
      p.dim("     /offline on"),
      "",
    ].join("\n");
  }

  // Default: show status
  const installed = isOllamaInstalled();
  const running = isOllamaRunning();
  const online = isOnline();
  const models = running ? getOllamaModels() : [];
  const cfg = getConfig();

  return [
    "",
    p.white.bold("📡 Offline Status"),
    p.gray("━".repeat(35)),
    "",
    `  ${p.gray("Internet:")}      ${online ? p.green("✅ Online") : p.red("❌ Offline")}`,
    `  ${p.gray("Ollama:")}        ${!installed ? p.dim("Not installed") : running ? p.green("✅ Running") : p.yellow("Installed (not running)")}`,
    `  ${p.gray("Mode:")}          ${cfg.offlineEnabled ? p.green("🟢 LOCAL — free") : p.dim("☁️  Cloud")}`,
    `  ${p.gray("Local models:")}  ${models.length > 0 ? p.white(models.join(", ")) : p.dim("none")}`,
    "",
    !cfg.offlineEnabled
      ? p.dim("  Run /offline on to use TaseesCode 100% free with local models.")
      : p.dim("  Running fully offline. Zero API costs."),
    "",
  ].join("\n");
}
