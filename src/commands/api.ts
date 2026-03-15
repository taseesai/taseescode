import chalk from "chalk";
import axios from "axios";
import { getConfig, setNestedConfig } from "../utils/config";
import { registerCustomModel, MODEL_REGISTRY } from "../models";

const c = {
  white:  chalk.hex("#E8E8E8"),
  silver: chalk.hex("#ABABAB"),
  gray:   chalk.hex("#8B8B8B"),
  dim:    chalk.hex("#4A4A4A"),
  green:  chalk.hex("#7ACC7A"),
  red:    chalk.hex("#E87B7B"),
  cyan:   chalk.hex("#7AC8C8"),
};

export async function apiCommand(args: string[]): Promise<string> {
  if (args.length === 0) {
    return [
      "",
      c.white.bold("API Commands"),
      c.gray("─".repeat(40)),
      `  ${c.white("/api add [name] [url] [key?]")}   Connect any API`,
      `  ${c.white("/api list")}                       List connected APIs`,
      `  ${c.white("/api test [name]")}                Test API connection`,
      `  ${c.white("/api remove [name]")}              Remove an API`,
      "",
      c.dim("  Example:"),
      c.dim("  /api add ollama http://localhost:11434/v1"),
      c.dim("  /api add my-server https://myserver.com/v1 sk-mykey123"),
      "",
    ].join("\n");
  }

  const subCmd = args[0];

  switch (subCmd) {
    case "add":
      return await apiAdd(args.slice(1));
    case "list":
      return apiList();
    case "remove":
      return apiRemove(args.slice(1));
    case "test":
      return await apiTest(args.slice(1));
    default:
      return c.red(`Unknown subcommand: ${subCmd}`) + "\n" + c.dim("Use: /api add, /api list, /api test, /api remove");
  }
}

async function apiAdd(args: string[]): Promise<string> {
  if (args.length < 2) {
    return c.red("Usage: /api add [name] [url] [apiKey?]") + "\n" +
      c.dim("Example: /api add ollama http://localhost:11434/v1");
  }

  const name = args[0].toLowerCase();
  const baseUrl = args[1].replace(/\/+$/, "");
  const apiKey = args[2] || null;

  // Validate name
  if (!/^[a-z0-9_-]+$/.test(name)) {
    return c.red("API name must be lowercase letters, numbers, hyphens, or underscores.");
  }

  // Save to config
  const cfg = getConfig();
  const customApis = cfg.customApis || {};
  customApis[name] = {
    name,
    baseUrl,
    apiKey,
    model: null,
    addedAt: new Date().toISOString(),
  };
  setNestedConfig("customApis", customApis);

  // Register in MODEL_REGISTRY
  registerCustomModel(name, baseUrl);

  // Try to auto-detect models
  let modelsFound: string[] = [];
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const response = await axios.get(`${baseUrl}/models`, {
      headers,
      timeout: 5000,
    });
    if (response.data?.data && Array.isArray(response.data.data)) {
      modelsFound = response.data.data.map((m: { id: string }) => m.id);
    }
  } catch {
    // Auto-detect not available, skip gracefully
  }

  const lines: string[] = [
    "",
    c.green(`✅ Connected to ${name}`),
  ];

  if (modelsFound.length > 0) {
    lines.push(`   Models found: ${c.cyan(modelsFound.slice(0, 10).join(", "))}`);
    // Set first model as default
    const defaultModel = modelsFound[0];
    customApis[name].model = defaultModel;
    setNestedConfig("customApis", customApis);
    // Update registry with actual model name
    if (MODEL_REGISTRY[`custom:${name}`]) {
      MODEL_REGISTRY[`custom:${name}`].model = defaultModel;
    }
    lines.push(`   Default model set to: ${c.white(defaultModel)}`);
  }

  lines.push(`   Switch to it: ${c.white(`/model custom:${name}`)}`);
  lines.push("");

  return lines.join("\n");
}

function apiList(): string {
  const cfg = getConfig();
  const customApis = cfg.customApis || {};
  const names = Object.keys(customApis);

  if (names.length === 0) {
    return [
      "",
      c.gray("No custom APIs connected."),
      c.dim("Add one with: /api add [name] [url] [key?]"),
      "",
    ].join("\n");
  }

  const lines: string[] = [
    "",
    c.white.bold("Connected APIs"),
    c.gray("─".repeat(40)),
  ];

  for (const name of names) {
    const api = customApis[name];
    const hasKey = api.apiKey ? c.green("key set") : c.dim("no key");
    const model = api.model ? c.silver(api.model) : c.dim("default");
    lines.push(`  ${c.white.bold(name)}`);
    lines.push(`    URL:   ${c.silver(api.baseUrl)}`);
    lines.push(`    Model: ${model}  │  ${hasKey}`);
    lines.push(`    Use:   ${c.dim(`/model custom:${name}`)}`);
    lines.push("");
  }

  return lines.join("\n");
}

function apiRemove(args: string[]): string {
  if (args.length === 0) {
    return c.red("Usage: /api remove [name]");
  }

  const name = args[0].toLowerCase();
  const cfg = getConfig();
  const customApis = cfg.customApis || {};

  if (!customApis[name]) {
    return c.red(`API "${name}" not found.`) + "\n" + c.dim("Use /api list to see connected APIs.");
  }

  delete customApis[name];
  setNestedConfig("customApis", customApis);

  // Remove from MODEL_REGISTRY
  delete MODEL_REGISTRY[`custom:${name}`];

  return c.green(`✅ Removed API: ${name}`);
}

async function apiTest(args: string[]): Promise<string> {
  if (args.length === 0) {
    return c.red("Usage: /api test [name]");
  }

  const name = args[0].toLowerCase();
  const cfg = getConfig();
  const customApis = cfg.customApis || {};
  const api = customApis[name];

  if (!api) {
    return c.red(`API "${name}" not found.`) + "\n" + c.dim("Use /api list to see connected APIs.");
  }

  const baseUrl = api.baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (api.apiKey) {
    headers["Authorization"] = `Bearer ${api.apiKey}`;
  }

  const body = {
    model: api.model || "default",
    messages: [{ role: "user", content: "Say hi in one sentence." }],
    temperature: 0.7,
    max_tokens: 100,
  };

  const start = Date.now();

  try {
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      body,
      { headers, timeout: 15000 }
    );

    const elapsed = Date.now() - start;
    const content = response.data?.choices?.[0]?.message?.content || "(no response)";
    const preview = content.length > 100 ? content.slice(0, 100) + "..." : content;

    return [
      "",
      c.green(`✅ ${name} is responding (${elapsed}ms)`),
      `   "${c.silver(preview)}"`,
      "",
    ].join("\n");
  } catch (err) {
    const elapsed = Date.now() - start;

    if (axios.isAxiosError(err)) {
      if (err.code === "ECONNREFUSED") {
        return [
          "",
          c.red(`❌ Cannot connect to ${name} (${elapsed}ms)`),
          `   Server not running at ${c.white(baseUrl)}`,
          c.dim("   Make sure the server is started."),
          "",
        ].join("\n");
      }
      if (err.code === "ECONNABORTED") {
        return [
          "",
          c.red(`❌ ${name} timed out (${elapsed}ms)`),
          c.dim("   Server may be overloaded or unreachable."),
          "",
        ].join("\n");
      }
      if (err.response?.status === 401) {
        return [
          "",
          c.red(`❌ ${name} returned 401 Unauthorized`),
          c.dim("   API key is wrong or missing."),
          c.dim(`   Update with: /api add ${name} ${baseUrl} NEW_KEY`),
          "",
        ].join("\n");
      }
      if (err.response?.status === 404) {
        return [
          "",
          c.red(`❌ ${name} endpoint not found (404)`),
          c.dim(`   Tried: ${baseUrl}/chat/completions`),
          c.dim("   Check that the URL is correct."),
          "",
        ].join("\n");
      }

      const data = err.response?.data;
      const msg = typeof data === "object" ? JSON.stringify(data).slice(0, 200) : String(data || err.message);
      return [
        "",
        c.red(`❌ ${name} error (${err.response?.status || "unknown"})`),
        `   ${c.dim(msg)}`,
        "",
      ].join("\n");
    }

    return c.red(`❌ ${name} error: ${err instanceof Error ? err.message : String(err)}`);
  }
}
