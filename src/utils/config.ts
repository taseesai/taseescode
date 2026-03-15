import Conf from "conf";
import path from "path";
import fs from "fs-extra";

export interface TaseesConfig {
  hasCompletedOnboarding: boolean;
  defaultModel: string;
  language: "auto" | "ar" | "en";
  theme: "silver" | "minimal" | "dark";
  costCurrency: string;
  costWarningThreshold: number;
  autoCompact: boolean;
  contextLimit: number;
  permissions: {
    allowFileWrite: "ask" | "always" | "never";
    allowCommandRun: "ask" | "always" | "never";
  };
  apiKeys: {
    deepseek: string | null;
    anthropic: string | null;
    openai: string | null;
    qwen: string | null;
    kimi: string | null;
    groq: string | null;
  };
}

const defaults: TaseesConfig = {
  hasCompletedOnboarding: false,
  defaultModel: "deepseek-v3",
  language: "auto",
  theme: "silver",
  costCurrency: "SAR",
  costWarningThreshold: 10,
  autoCompact: true,
  contextLimit: 80000,
  permissions: {
    allowFileWrite: "ask",
    allowCommandRun: "ask",
  },
  apiKeys: {
    deepseek: null,
    anthropic: null,
    openai: null,
    qwen: null,
    kimi: null,
    groq: null,
  },
};

const configDir = path.join(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".taseescode"
);

// Ensure config directory exists
fs.ensureDirSync(configDir);

const config = new Conf<TaseesConfig>({
  projectName: "taseescode",
  cwd: configDir,
  configName: "config",
  defaults,
});

export function getConfig(): TaseesConfig {
  return config.store;
}

export function setConfig<K extends keyof TaseesConfig>(
  key: K,
  value: TaseesConfig[K]
): void {
  config.set(key, value);
}

export function setNestedConfig(keyPath: string, value: unknown): void {
  config.set(keyPath, value);
}

export function getConfigDir(): string {
  return configDir;
}

export default config;
