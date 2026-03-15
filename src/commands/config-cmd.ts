import chalk from "chalk";
import { getConfig, setConfig } from "../utils/config";

const c = {
  white:  chalk.hex("#E8E8E8"),
  silver: chalk.hex("#ABABAB"),
  gray:   chalk.hex("#8B8B8B"),
  dim:    chalk.hex("#4A4A4A"),
  green:  chalk.hex("#7ACC7A"),
  red:    chalk.hex("#E87B7B"),
  yellow: chalk.hex("#E8C56B"),
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return c.dim("null");
  if (typeof v === "boolean") return v ? c.green("true") : c.red("false");
  if (typeof v === "string" && v.length > 40) return c.silver(v.slice(0, 8) + "..." + v.slice(-4));
  return c.silver(String(v));
}

function parseValue(raw: string): unknown {
  if (raw === "true")  return true;
  if (raw === "false") return false;
  if (raw === "null")  return null;
  if (!isNaN(Number(raw)) && raw !== "") return Number(raw);
  return raw;
}

export function configCommand(args: string[]): string {
  const cfg = getConfig();

  // /config  or  /config show
  if (args.length === 0 || args[0] === "show") {
    const lines = [
      "",
      c.white.bold("TaseesCode Configuration"),
      c.gray("─".repeat(45)),
      "",
      `  ${c.silver("defaultModel")}         ${c.white(cfg.defaultModel)}`,
      `  ${c.silver("language")}             ${c.white(cfg.language)}`,
      `  ${c.silver("theme")}                ${c.white(cfg.theme)}`,
      `  ${c.silver("costCurrency")}         ${c.white(cfg.costCurrency)}`,
      `  ${c.silver("costWarningThreshold")} ${c.white(String(cfg.costWarningThreshold))} SAR`,
      `  ${c.silver("autoCompact")}          ${c.white(String(cfg.autoCompact))}`,
      `  ${c.silver("contextLimit")}         ${c.white(String(cfg.contextLimit))}`,
      "",
      c.gray("  Permissions"),
      `    ${c.silver("allowFileWrite")}      ${c.white(cfg.permissions.allowFileWrite)}`,
      `    ${c.silver("allowCommandRun")}     ${c.white(cfg.permissions.allowCommandRun)}`,
      "",
      c.gray("  API Keys"),
      `    ${c.silver("deepseek")}   ${cfg.apiKeys.deepseek   ? c.green("✅ Set") : c.dim("not set")}`,
      `    ${c.silver("anthropic")}  ${cfg.apiKeys.anthropic  ? c.green("✅ Set") : c.dim("not set")}`,
      `    ${c.silver("openai")}     ${cfg.apiKeys.openai     ? c.green("✅ Set") : c.dim("not set")}`,
      `    ${c.silver("qwen")}       ${cfg.apiKeys.qwen       ? c.green("✅ Set") : c.dim("not set")}`,
      `    ${c.silver("kimi")}       ${cfg.apiKeys.kimi       ? c.green("✅ Set") : c.dim("not set")}`,
      `    ${c.silver("groq")}       ${cfg.apiKeys.groq       ? c.green("✅ Set") : c.dim("not set  (free at console.groq.com)")}`,
      "",
      c.dim("  Usage: /config set [key] [value]"),
      c.dim("  Example: /config set apiKeys.deepseek sk-abc123"),
      c.dim("  Example: /config set defaultModel qwen-2.5-coder"),
      c.dim("  Example: /config set permissions.allowFileWrite ask"),
      "",
    ];
    return lines.join("\n");
  }

  // /config set [key] [value]
  const subCmd = args[0];
  if (subCmd === "set") {
    if (args.length < 3) {
      return c.red("Usage: /config set [key] [value]\n") +
             c.dim("Example: /config set apiKeys.deepseek sk-abc123");
    }
    const keyPath = args[1];
    const rawValue = args.slice(2).join(" ");
    const value = parseValue(rawValue);

    // Handle nested keys manually
    const parts = keyPath.split(".");

    if (parts.length === 1) {
      // Top-level key
      const key = parts[0] as keyof typeof cfg;
      if (!(key in cfg)) {
        return c.red(`Unknown config key: ${key}`);
      }
      setConfig(key, value as never);
      return `\n  ${c.green("✅")} ${c.white(keyPath)} = ${formatValue(value)}\n`;
    }

    if (parts.length === 2) {
      const [parent, child] = parts;

      if (parent === "apiKeys") {
        const validKeys = ["deepseek", "anthropic", "openai", "qwen", "kimi", "groq"];
        if (!validKeys.includes(child)) {
          return c.red(`Unknown API key: ${child}\n`) +
                 c.dim(`Valid: ${validKeys.join(", ")}`);
        }
        const current = getConfig().apiKeys;
        const updated = { ...current, [child]: value as string };
        setConfig("apiKeys", updated);

        // Also check if we should switch to this model
        const modelMap: Record<string, string> = {
          deepseek:  "deepseek-v3",
          anthropic: "claude-sonnet",
          openai:    "gpt-4o",
          qwen:      "qwen-2.5-coder",
          kimi:      "kimi-k1.5",
          groq:      "llama-3.3-70b",
        };
        const suggestedModel = modelMap[child];
        const hint = suggestedModel
          ? c.dim(`\n  Tip: Switch to this model with /model ${suggestedModel}`)
          : "";
        return `\n  ${c.green("✅")} ${c.white("apiKeys." + child)} = ${formatValue(value)}${hint}\n`;
      }

      if (parent === "permissions") {
        const validPerms = ["allowFileWrite", "allowCommandRun"];
        if (!validPerms.includes(child)) {
          return c.red(`Unknown permission: ${child}`);
        }
        const validValues = ["ask", "always", "never"];
        if (!validValues.includes(String(value))) {
          return c.red(`Invalid value: ${value}\n`) +
                 c.dim(`Valid: ${validValues.join(", ")}`);
        }
        const current = getConfig().permissions;
        const updated = { ...current, [child]: value };
        setConfig("permissions", updated as never);
        return `\n  ${c.green("✅")} ${c.white("permissions." + child)} = ${formatValue(value)}\n`;
      }
    }

    return c.red(`Unknown config path: ${keyPath}`);
  }

  // /config reset
  if (subCmd === "reset") {
    return c.yellow("⚠️  To reset config, delete ~/.taseescode/config.json and restart.");
  }

  return [
    c.red(`Unknown config subcommand: ${subCmd}`),
    "",
    c.dim("  /config show                        — view all settings"),
    c.dim("  /config set [key] [value]           — set a value"),
    c.dim("  /config set apiKeys.deepseek KEY    — set DeepSeek API key"),
    c.dim("  /config set apiKeys.anthropic KEY   — set Claude API key"),
    c.dim("  /config set defaultModel qwen-2.5-coder"),
    "",
  ].join("\n");
}
