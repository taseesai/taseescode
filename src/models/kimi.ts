import axios from "axios";
import {
  ModelProvider,
  ChatMessage,
  ToolDefinition,
  ModelResponse,
  StreamCallback,
} from "./index";
import { parseOpenAICompatibleSSE } from "./stream-utils";

export class KimiProvider implements ModelProvider {
  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    apiKey: string,
    _modelId: string
  ): Promise<ModelResponse> {
    // Import at runtime to avoid circular dependency
    const { MODEL_REGISTRY } = require("./index");
    const config = MODEL_REGISTRY["kimi-k1.5"];
    const body: Record<string, unknown> = {
      model: config.model,
      messages: messages.map((m) => {
        const msg: Record<string, unknown> = {
          role: m.role,
          content: m.content,
        };
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if (m.name) msg.name = m.name;
        return msg;
      }),
      temperature: 0.7,
      max_tokens: 4096,
    };

    if (tools.length > 0) {
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
    _modelId: string,
    onChunk: StreamCallback
  ): Promise<ModelResponse> {
    const { MODEL_REGISTRY } = require("./index");
    const config = MODEL_REGISTRY["kimi-k1.5"];
    const body: Record<string, unknown> = {
      model: config.model,
      messages: messages.map((m) => {
        const msg: Record<string, unknown> = {
          role: m.role,
          content: m.content,
        };
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if (m.name) msg.name = m.name;
        return msg;
      }),
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
    };

    if (tools.length > 0) {
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
      return this.chat(messages, tools, apiKey, _modelId);
    }
  }
}
