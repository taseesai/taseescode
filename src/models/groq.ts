import axios from "axios";
import {
  ModelProvider,
  ChatMessage,
  ToolDefinition,
  ModelResponse,
  StreamCallback,
} from "./index";
import { parseOpenAICompatibleSSE } from "./stream-utils";

const TOOL_SUPPORTED_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "moonshotai/kimi-k2-instruct",
  "qwen/qwen3-32b",
  // groq/compound, allam-2-7b — do NOT support tool calling
];

export class GroqProvider implements ModelProvider {
  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    apiKey: string,
    modelId: string
  ): Promise<ModelResponse> {
    // Import at runtime to avoid circular dependency
    const { MODEL_REGISTRY } = require("./index");
    const config = MODEL_REGISTRY[modelId];
    const body: Record<string, unknown> = {
      model: config.model,
      messages: messages.map((m) => {
        const msg: Record<string, unknown> = {
          role: m.role,
          content: m.content,
        };
        // User message with images — OpenAI-compatible vision format
        if (m.images && m.images.length > 0 && m.role === "user") {
          const content: Array<Record<string, unknown>> = [];
          for (const img of m.images) {
            if (img.type === "url") {
              content.push({ type: "image_url", image_url: { url: img.url } });
            } else {
              content.push({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.data}` } });
            }
          }
          content.push({ type: "text", text: m.content });
          msg.content = content;
        }
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if (m.name) msg.name = m.name;
        return msg;
      }),
      temperature: 0.7,
      max_tokens: config.contextWindow <= 4096 ? 1024 : config.contextWindow <= 8192 ? 2048 : 4096,
    };

    if (tools.length > 0 && TOOL_SUPPORTED_MODELS.includes(config.model)) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await axios.post(
      `${config.apiBase}/chat/completions`,
      body,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const choice = response.data.choices[0];
    const usage = response.data.usage || {};

    return {
      content: choice.message.content || "",
      toolCalls: choice.message.tool_calls || [],
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      finishReason: choice.finish_reason || "stop",
    };
  }

  async chatStream(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    apiKey: string,
    modelId: string,
    onChunk: StreamCallback
  ): Promise<ModelResponse> {
    const { MODEL_REGISTRY } = require("./index");
    const config = MODEL_REGISTRY[modelId];
    const body: Record<string, unknown> = {
      model: config.model,
      messages: messages.map((m) => {
        const msg: Record<string, unknown> = {
          role: m.role,
          content: m.content,
        };
        if (m.images && m.images.length > 0 && m.role === "user") {
          const content: Array<Record<string, unknown>> = [];
          for (const img of m.images) {
            if (img.type === "url") {
              content.push({ type: "image_url", image_url: { url: img.url } });
            } else {
              content.push({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.data}` } });
            }
          }
          content.push({ type: "text", text: m.content });
          msg.content = content;
        }
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if (m.name) msg.name = m.name;
        return msg;
      }),
      temperature: 0.7,
      max_tokens: config.contextWindow <= 4096 ? 1024 : config.contextWindow <= 8192 ? 2048 : 4096,
      stream: true,
    };

    if (tools.length > 0 && TOOL_SUPPORTED_MODELS.includes(config.model)) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    try {
      return await parseOpenAICompatibleSSE(
        `${config.apiBase}/chat/completions`,
        body,
        { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        onChunk
      );
    } catch {
      return this.chat(messages, tools, apiKey, modelId);
    }
  }
}
