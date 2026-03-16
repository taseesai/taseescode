import chalk from "chalk";
import { MODEL_REGISTRY } from "../models";
import { getConfig, setNestedConfig } from "../utils/config";
import { loadCustomModelsFromConfig } from "../models";
import { startAuthServer } from "../utils/auth-server";
import axios from "axios";

const c = {
  white:  chalk.hex("#E8E8E8"),
  silver: chalk.hex("#ABABAB"),
  gray:   chalk.hex("#8B8B8B"),
  dim:    chalk.hex("#4A4A4A"),
  green:  chalk.hex("#7ACC7A"),
  yellow: chalk.hex("#E8C56B"),
  red:    chalk.hex("#E87B7B"),
  cyan:   chalk.hex("#7AC8C8"),
};

// Which providers need an API key
const REQUIRES_KEY: Record<string, string> = {
  anthropic: "anthropic",
  openai:    "openai",
  qwen:      "qwen",
  kimi:      "kimi",
  groq:      "groq",
};

// Free providers (no key needed at all)
const FREE_PROVIDERS = ["deepseek"];

// Providers that need a key but the key is free to get
const FREE_KEY_PROVIDERS = ["groq"];

function getApiKeyStatus(provider: string): "free" | "free-key" | "set" | "missing" {
  if (FREE_PROVIDERS.includes(provider)) return "free";
  const cfg = getConfig();
  const apiKeys = (cfg as unknown as Record<string, unknown>).apiKeys as Record<string, string | null> | undefined;
  const keyField = REQUIRES_KEY[provider];
  if (!keyField || !apiKeys) {
    return FREE_KEY_PROVIDERS.includes(provider) ? "free-key" : "missing";
  }
  const key = apiKeys[keyField];
  if (key && key.length > 10) return "set";
  if (FREE_KEY_PROVIDERS.includes(provider)) return "free-key";
  return "missing";
}

function keyStatusBadge(status: "free" | "free-key" | "set" | "missing"): string {
  if (status === "free")     return c.green("✦ No key needed");
  if (status === "free-key") return c.cyan("✦ Free key (console.groq.com)");
  if (status === "set")      return c.green("✅ Key set");
  return c.red("🔒 Needs API key");
}

function costLabel(input: number, output: number): string {
  if (input === 0 && output === 0) return c.green("✦ Free");
  if (input < 0.1 && output < 0.5) return c.cyan("◆ Low cost");
  return "";
}

export function modelCommand(args: string[], currentModel: string): string {
  const config = getConfig();

  // /model  → show current
  if (args.length === 0) {
    const m = MODEL_REGISTRY[currentModel];
    const status = getApiKeyStatus(m?.provider || "");
    return [
      "",
      c.white.bold("Current Model"),
      c.gray("─".repeat(40)),
      `  ${c.white.bold(m?.name || currentModel)}  ${c.dim(`(${currentModel})`)}`,
      `  Provider:  ${c.silver(m?.provider || "unknown")}`,
      `  Context:   ${c.silver((m?.contextWindow / 1000).toFixed(0) + "K tokens")}`,
      `  Cost in:   ${c.silver(m?.inputCostSARPerMToken === 0 ? "Free" : m?.inputCostSARPerMToken + " SAR/M")}`,
      `  Cost out:  ${c.silver(m?.outputCostSARPerMToken === 0 ? "Free" : m?.outputCostSARPerMToken + " SAR/M")}`,
      `  Status:    ${keyStatusBadge(status)}`,
      m?.bestFor ? `  Best for:  ${c.silver(m.bestFor)}` : "",
      "",
      c.dim("  Use /model list to see all models"),
      c.dim("  Use /model [id] to switch"),
      "",
    ].join("\n");
  }

  // /model list  → show all with key status
  if (args[0] === "list") {
    const lines: string[] = [
      "",
      c.white.bold("Available Models"),
      c.gray("─".repeat(60)),
    ];

    const freeModels: string[]  = [];
    const freeKeyModels: string[] = [];
    const paidModels: string[]  = [];

    for (const [id, m] of Object.entries(MODEL_REGISTRY)) {
      const status = getApiKeyStatus(m.provider);
      const active = id === currentModel ? c.green(" ● ") : "   ";
      const costIn  = m.inputCostSARPerMToken  === 0 ? "Free" : `${m.inputCostSARPerMToken} SAR/M`;
      const costOut = m.outputCostSARPerMToken === 0 ? "Free" : `${m.outputCostSARPerMToken} SAR/M`;
      const ctx     = `${(m.contextWindow / 1000).toFixed(0)}K`;
      const badge   = keyStatusBadge(status);
      const label   = costLabel(m.inputCostSARPerMToken, m.outputCostSARPerMToken);

      const bestFor = m.bestFor ? `      ${c.dim("✦ " + m.bestFor)}` : "";
      const block = [
        `${active}${c.white.bold(m.name.padEnd(22))} ${c.dim(id)}  ${label}`,
        `      ${badge}  ${c.dim(`│`)}  Context: ${c.silver(ctx)}  ${c.dim(`│`)}  In: ${c.silver(costIn)}  Out: ${c.silver(costOut)}`,
        bestFor,
      ].filter(Boolean).join("\n");

      if (status === "free") {
        freeModels.push(block);
      } else if (status === "free-key" || (status === "set" && FREE_KEY_PROVIDERS.includes(m.provider))) {
        freeKeyModels.push(block);
      } else {
        paidModels.push(block);
      }
    }

    if (freeModels.length) {
      lines.push("", c.silver("  ✦ Free Models (no API key needed)"));
      lines.push(...freeModels);
    }
    if (freeKeyModels.length) {
      lines.push("", c.silver("  ✦ Free Models (free key from console.groq.com)"));
      lines.push(...freeKeyModels);
    }
    if (paidModels.length) {
      lines.push("", c.silver("  ◆ Paid Models (bring your own API key)"));
      lines.push(...paidModels);
      lines.push(
        "",
        c.dim("  Set a key: /config set apiKeys.anthropic sk-ant-..."),
        c.dim("             /config set apiKeys.openai sk-..."),
        c.dim("             /config set apiKeys.qwen your-key"),
        c.dim("             /config set apiKeys.kimi your-key"),
        c.dim("             /config set apiKeys.groq your-key  (free)"),
      );
    }

    // Custom APIs section
    const customModels = Object.entries(MODEL_REGISTRY).filter(([id]) => id.startsWith("custom:"));
    if (customModels.length > 0) {
      lines.push("", c.silver("  ⚡ Custom APIs (connected via /api add)"));
      for (const [id, m] of customModels) {
        const active = id === currentModel ? c.green(" ● ") : "   ";
        lines.push(
          `${active}${c.white.bold(m.name.padEnd(22))} ${c.dim(id)}`,
          `      ${c.green("✦ Connected")}  ${c.dim(`│`)}  ${c.dim(m.bestFor || "")}`,
        );
      }
    }

    lines.push("", c.dim("  Switch model: /model [id]"), "");
    return lines.join("\n");
  }

  // /model [id]  → switch with key check
  const modelId = args[0];

  // Ensure custom models are loaded
  loadCustomModelsFromConfig();

  const m = MODEL_REGISTRY[modelId];

  if (!m) {
    const ids = Object.keys(MODEL_REGISTRY).join(", ");
    return c.red(`Unknown model: ${modelId}\n`) + c.dim(`Available: ${ids}`);
  }

  // Custom models don't need API key validation
  if (m.provider === "custom") {
    return `__SWITCH__${modelId}`;
  }

  const status = getApiKeyStatus(m.provider);

  if (status === "missing" || status === "free-key") {
    if (status === "free-key") {
      return [
        "",
        c.cyan(`✦ ${m.name} is FREE but needs an API key`),
        c.gray("─".repeat(40)),
        `  Get your free key at: ${c.white("console.groq.com")}`,
        `  (takes 30 seconds)`,
        "",
        `  Then set it:`,
        c.white(`  /config set apiKeys.groq YOUR_KEY_HERE`),
        "",
      ].join("\n");
    }

    // For Anthropic — launch OAuth flow
    if (m.provider === "anthropic") {
      return `__AUTH_ANTHROPIC__${modelId}`;
    }

    const keyField = REQUIRES_KEY[m.provider];
    return [
      "",
      c.red(`🔒 Cannot switch to ${m.name}`),
      c.gray("─".repeat(40)),
      `  This model requires an API key for ${c.white(m.provider)}.`,
      "",
      `  To set your key:`,
      c.white(`  /config set apiKeys.${keyField} YOUR_KEY_HERE`),
      "",
      c.dim(`  Get a key at:`),
      m.provider === "openai"    ? c.dim("  platform.openai.com/api-keys") : "",
      m.provider === "qwen"      ? c.dim("  dashscope.console.aliyun.com") : "",
      m.provider === "kimi"      ? c.dim("  platform.moonshot.cn") : "",
      "",
      c.dim("  Or use a free model: /model llama-3.3-70b"),
      "",
    ].filter(l => l !== undefined).join("\n");
  }

  return `__SWITCH__${modelId}`;
}

/**
 * Launch Anthropic OAuth flow — opens browser for authentication
 */
export async function launchAnthropicAuth(): Promise<{ success: boolean; key: string }> {
  const validateKey = async (key: string): Promise<boolean> => {
    try {
      await axios.post("https://api.anthropic.com/v1/messages",
        { model: "claude-sonnet-4-6", max_tokens: 1, messages: [{ role: "user", content: "hi" }] },
        { headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }, timeout: 10000 }
      );
      return true;
    } catch { return false; }
  };

  const result = await startAuthServer("Anthropic", "https://console.anthropic.com/settings/keys", validateKey);

  if (result.success && result.key) {
    setNestedConfig("apiKeys.anthropic", result.key);
    return { success: true, key: result.key };
  }
  return { success: false, key: "" };
}
