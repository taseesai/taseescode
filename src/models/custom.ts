import axios from "axios";
import {
  ModelProvider,
  ChatMessage,
  ToolDefinition,
  ModelResponse,
  MODEL_REGISTRY,
  StreamCallback,
} from "./index";
import { getConfig } from "../utils/config";
import { parseOpenAICompatibleSSE } from "./stream-utils";

export class CustomProvider implements ModelProvider {
  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    _apiKey: string,
    modelId: string
  ): Promise<ModelResponse> {
    const apiName = modelId.replace("custom:", "");
    const cfg = getConfig();
    const api = cfg.customApis?.[apiName];

    if (!api) {
      throw new Error(`Custom API "${apiName}" not found. Add it with: /api add ${apiName} <url>`);
    }

    const modelConfig = MODEL_REGISTRY[modelId];
    const modelToUse = api.model || modelConfig?.model || "default";

    const body: Record<string, unknown> = {
      model: modelToUse,
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
      max_tokens: 4096,
    };

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const baseUrl = api.baseUrl.replace(/\/+$/, "");

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (api.apiKey) {
        headers["Authorization"] = `Bearer ${api.apiKey}`;
      }

      const response = await axios.post(
        `${baseUrl}/chat/completions`,
        body,
        { headers, timeout: 30000 }
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
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.code === "ECONNREFUSED") {
          throw new Error(`Cannot connect to ${baseUrl}. Is the server running?`);
        }
        if (err.code === "ECONNABORTED") {
          throw new Error(`Connection to ${apiName} timed out after 30s.`);
        }
        if (err.response?.status === 401) {
          throw new Error(`Invalid API key for ${apiName}. Check with: /api test ${apiName}`);
        }
        if (err.response?.status === 404) {
          throw new Error(`Endpoint not found at ${baseUrl}/chat/completions. Check the URL.`);
        }
        if (err.response?.status === 400) {
          // Retry without tools if they were included
          if (tools.length > 0) {
            try {
              delete body.tools;
              delete body.tool_choice;
              const headers: Record<string, string> = {
                "Content-Type": "application/json",
              };
              if (api.apiKey) {
                headers["Authorization"] = `Bearer ${api.apiKey}`;
              }
              const retryResponse = await axios.post(
                `${baseUrl}/chat/completions`,
                body,
                { headers, timeout: 30000 }
              );
              const choice = retryResponse.data.choices[0];
              const usage = retryResponse.data.usage || {};
              return {
                content: choice.message.content || "",
                toolCalls: [],
                inputTokens: usage.prompt_tokens || 0,
                outputTokens: usage.completion_tokens || 0,
                finishReason: choice.finish_reason || "stop",
              };
            } catch {
              // Fall through to original error
            }
          }
          throw new Error(`Bad request to ${apiName}. The API may not support tool calling.`);
        }
        const data = err.response?.data;
        const msg = typeof data === "object" ? JSON.stringify(data).slice(0, 200) : String(data || err.message);
        throw new Error(`${apiName} API error: ${msg}`);
      }
      throw err;
    }
  }

  async chatStream(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    _apiKey: string,
    modelId: string,
    onChunk: StreamCallback
  ): Promise<ModelResponse> {
    const apiName = modelId.replace("custom:", "");
    const cfg = getConfig();
    const api = cfg.customApis?.[apiName];

    if (!api) {
      throw new Error(`Custom API "${apiName}" not found. Add it with: /api add ${apiName} <url>`);
    }

    const modelConfig = MODEL_REGISTRY[modelId];
    const modelToUse = api.model || modelConfig?.model || "default";

    const body: Record<string, unknown> = {
      model: modelToUse,
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
      max_tokens: 4096,
      stream: true,
    };

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const baseUrl = api.baseUrl.replace(/\/+$/, "");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (api.apiKey) {
      headers["Authorization"] = `Bearer ${api.apiKey}`;
    }

    try {
      return await parseOpenAICompatibleSSE(
        `${baseUrl}/chat/completions`,
        body,
        headers,
        onChunk
      );
    } catch {
      // Fall back to non-streaming
      return this.chat(messages, tools, _apiKey, modelId);
    }
  }
}
