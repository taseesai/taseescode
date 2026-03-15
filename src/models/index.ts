export interface ModelConfig {
  name: string;
  provider: "deepseek" | "anthropic" | "openai" | "qwen" | "kimi" | "groq";
  apiBase?: string;
  model: string;
  inputCostSARPerMToken: number;
  outputCostSARPerMToken: number;
  contextWindow: number;
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
  },
  "claude-sonnet": {
    name: "Claude Sonnet",
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    inputCostSARPerMToken: 5.62,
    outputCostSARPerMToken: 16.87,
    contextWindow: 200000,
  },
  "gpt-4o": {
    name: "GPT-4o",
    provider: "openai",
    apiBase: "https://api.openai.com/v1",
    model: "gpt-4o",
    inputCostSARPerMToken: 9.37,
    outputCostSARPerMToken: 28.12,
    contextWindow: 128000,
  },
  "qwen-2.5-coder": {
    name: "Qwen 2.5 Coder",
    provider: "qwen",
    apiBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen2.5-coder-32b-instruct",
    inputCostSARPerMToken: 0,
    outputCostSARPerMToken: 0,
    contextWindow: 131072,
  },
  "kimi-k1.5": {
    name: "Kimi K1.5",
    provider: "kimi",
    apiBase: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-128k",
    inputCostSARPerMToken: 0.21,
    outputCostSARPerMToken: 0.63,
    contextWindow: 128000,
  },
  "llama-3.3-70b": {
    name: "Llama 3.3 70B",
    provider: "groq",
    apiBase: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    inputCostSARPerMToken: 0.0,
    outputCostSARPerMToken: 0.0,
    contextWindow: 128000,
  },
  "llama-3.1-8b": {
    name: "Llama 3.1 8B",
    provider: "groq",
    apiBase: "https://api.groq.com/openai/v1",
    model: "llama-3.1-8b-instant",
    inputCostSARPerMToken: 0.0,
    outputCostSARPerMToken: 0.0,
    contextWindow: 128000,
  },
  "mixtral-8x7b": {
    name: "Mixtral 8x7B",
    provider: "groq",
    apiBase: "https://api.groq.com/openai/v1",
    model: "mixtral-8x7b-32768",
    inputCostSARPerMToken: 0.0,
    outputCostSARPerMToken: 0.0,
    contextWindow: 32768,
  },
  "gemma2-9b": {
    name: "Gemma 2 9B",
    provider: "groq",
    apiBase: "https://api.groq.com/openai/v1",
    model: "gemma2-9b-it",
    inputCostSARPerMToken: 0.0,
    outputCostSARPerMToken: 0.0,
    contextWindow: 8192,
  },
};

export type ModelId = keyof typeof MODEL_REGISTRY;

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
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

export interface ModelProvider {
  chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    apiKey: string,
    modelId: string
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

const providers: Record<string, ModelProvider> = {
  deepseek: new DeepSeekProvider(),
  anthropic: new AnthropicProvider(),
  openai: new OpenAIProvider(),
  qwen: new QwenProvider(),
  kimi: new KimiProvider(),
  groq: new GroqProvider(),
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
