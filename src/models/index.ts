import { ImageAttachment } from "../utils/image";

export interface ModelConfig {
  name: string;
  provider: "deepseek" | "anthropic" | "openai" | "qwen" | "kimi" | "groq" | "custom";
  apiBase?: string;
  model: string;
  inputCostSARPerMToken: number;
  outputCostSARPerMToken: number;
  contextWindow: number;
  bestFor?: string;
  supportsVision?: boolean;
}

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  "deepseek-v3": {
    name: "DeepSeek V3",
    provider: "deepseek",
    apiBase: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    inputCostSARPerMToken: 0.054,
    outputCostSARPerMToken: 0.216,
    contextWindow: 128000,
    bestFor: "General coding · Arabic · Best value",
  },
  "claude-opus": {
    name: "Claude Opus 4.6",
    provider: "anthropic",
    model: "claude-opus-4-6",
    inputCostSARPerMToken: 56.25,
    outputCostSARPerMToken: 225.0,
    contextWindow: 200000,
    bestFor: "Most capable · Deep reasoning · Agentic · 200K context",
    supportsVision: true,
  },
  "claude-sonnet": {
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    inputCostSARPerMToken: 11.25,
    outputCostSARPerMToken: 56.25,
    contextWindow: 200000,
    bestFor: "Complex reasoning · Large codebases · Best value premium",
    supportsVision: true,
  },
  "gpt-4o": {
    name: "GPT-4o",
    provider: "openai",
    apiBase: "https://api.openai.com/v1",
    model: "gpt-4o",
    inputCostSARPerMToken: 9.37,
    outputCostSARPerMToken: 28.12,
    contextWindow: 128000,
    bestFor: "Multimodal · Vision · Broad knowledge",
    supportsVision: true,
  },
  "qwen-2.5-coder": {
    name: "Qwen 2.5 Coder",
    provider: "qwen",
    apiBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen2.5-coder-32b-instruct",
    inputCostSARPerMToken: 0,
    outputCostSARPerMToken: 0,
    contextWindow: 131072,
    bestFor: "Pure code generation · Completions · Refactoring",
  },
  "kimi-k1.5": {
    name: "Kimi K1.5",
    provider: "kimi",
    apiBase: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-128k",
    inputCostSARPerMToken: 0.21,
    outputCostSARPerMToken: 0.63,
    contextWindow: 128000,
    bestFor: "Long documents · Deep analysis · 128K context",
  },
  "llama-3.3-70b": {
    name: "Llama 3.3 70B",
    provider: "groq",
    apiBase: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    inputCostSARPerMToken: 0.0,
    outputCostSARPerMToken: 0.0,
    contextWindow: 128000,
    bestFor: "Free · Arabic · Fast · Best free model overall",
  },
  "llama-3.1-8b": {
    name: "Llama 3.1 8B",
    provider: "groq",
    apiBase: "https://api.groq.com/openai/v1",
    model: "llama-3.1-8b-instant",
    inputCostSARPerMToken: 0.0,
    outputCostSARPerMToken: 0.0,
    contextWindow: 128000,
    bestFor: "Free · Instant responses · Quick questions",
  },
  "llama-4-scout": {
    name: "Llama 4 Scout",
    provider: "groq",
    apiBase: "https://api.groq.com/openai/v1",
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    inputCostSARPerMToken: 0.0,
    outputCostSARPerMToken: 0.0,
    contextWindow: 131072,
    bestFor: "Free · Latest Llama 4 · Fast · Strong reasoning",
  },
  "kimi-k2": {
    name: "Kimi K2",
    provider: "groq",
    apiBase: "https://api.groq.com/openai/v1",
    model: "moonshotai/kimi-k2-instruct",
    inputCostSARPerMToken: 0.0,
    outputCostSARPerMToken: 0.0,
    contextWindow: 131072,
    bestFor: "Free · Agentic tasks · Code · Arabic",
  },
  "qwen3-32b": {
    name: "Qwen 3 32B",
    provider: "groq",
    apiBase: "https://api.groq.com/openai/v1",
    model: "qwen/qwen3-32b",
    inputCostSARPerMToken: 0.0,
    outputCostSARPerMToken: 0.0,
    contextWindow: 131072,
    bestFor: "Free · Strong coder · Multilingual · Arabic",
  },
  "allam-2": {
    name: "ALLAM 2 (Saudi)",
    provider: "groq",
    apiBase: "https://api.groq.com/openai/v1",
    model: "allam-2-7b",
    inputCostSARPerMToken: 0.0,
    outputCostSARPerMToken: 0.0,
    contextWindow: 4096,
    bestFor: "Free · Saudi Arabic · Chat only · KACST",
  },
  "compound": {
    name: "Groq Compound",
    provider: "groq",
    apiBase: "https://api.groq.com/openai/v1",
    model: "groq/compound",
    inputCostSARPerMToken: 0.0,
    outputCostSARPerMToken: 0.0,
    contextWindow: 131072,
    bestFor: "Free · Chat only · Groq compound reasoning",
  },
  
};

export type ModelId = keyof typeof MODEL_REGISTRY;

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  images?: ImageAttachment[];
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ModelResponse {
  content: string;
  toolCalls: ToolCall[];
  inputTokens: number;
  outputTokens: number;
  finishReason: string;
}

export type StreamCallback = (chunk: string) => void;

export interface ModelProvider {
  chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    apiKey: string,
    modelId: string
  ): Promise<ModelResponse>;

  chatStream?(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    apiKey: string,
    modelId: string,
    onChunk: StreamCallback
  ): Promise<ModelResponse>;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

import { DeepSeekProvider } from "./deepseek";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { QwenProvider } from "./qwen";
import { KimiProvider } from "./kimi";
import { GroqProvider } from "./groq";
import { CustomProvider } from "./custom";

const providers: Record<string, ModelProvider> = {
  deepseek: new DeepSeekProvider(),
  anthropic: new AnthropicProvider(),
  openai: new OpenAIProvider(),
  qwen: new QwenProvider(),
  kimi: new KimiProvider(),
  groq: new GroqProvider(),
  custom: new CustomProvider(),
};

export function getProvider(modelId: string): ModelProvider {
  const model = MODEL_REGISTRY[modelId];
  if (!model) throw new Error(`Unknown model: ${modelId}`);
  return providers[model.provider];
}

export function getModelConfig(modelId: string): ModelConfig {
  const model = MODEL_REGISTRY[modelId];
  if (!model) throw new Error(`Unknown model: ${modelId}`);
  return model;
}

export function registerCustomModel(name: string, baseUrl: string): void {
  MODEL_REGISTRY[`custom:${name}`] = {
    name: `Custom: ${name}`,
    provider: "custom",
    apiBase: baseUrl,
    model: "custom",
    inputCostSARPerMToken: 0,
    outputCostSARPerMToken: 0,
    contextWindow: 128000,
    bestFor: `Custom API — ${baseUrl}`,
  };
}

export function loadCustomModelsFromConfig(): void {
  // Lazy import to avoid circular dependency
  const { getConfig } = require("../utils/config");
  const cfg = getConfig();
  const customApis = cfg.customApis || {};
  for (const [name, api] of Object.entries(customApis)) {
    const a = api as { baseUrl: string; model: string | null };
    MODEL_REGISTRY[`custom:${name}`] = {
      name: `Custom: ${name}`,
      provider: "custom",
      apiBase: a.baseUrl,
      model: a.model || "custom",
      inputCostSARPerMToken: 0,
      outputCostSARPerMToken: 0,
      contextWindow: 128000,
      bestFor: `Custom API — ${a.baseUrl}`,
    };
  }
}
