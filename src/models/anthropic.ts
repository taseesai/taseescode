import axios from "axios";
import {
  ModelProvider,
  ChatMessage,
  ToolDefinition,
  ModelResponse,
  MODEL_REGISTRY,
  StreamCallback,
  ToolCall,
} from "./index";

function buildAnthropicMessages(messages: ChatMessage[]) {
  const systemMsg = messages.find((m) => m.role === "system");
  const conversationMsgs = messages.filter((m) => m.role !== "system");

  const anthropicMessages = conversationMsgs.map((m) => {
    if (m.role === "tool") {
      return {
        role: "user" as const,
        content: [
          {
            type: "tool_result" as const,
            tool_use_id: m.tool_call_id,
            content: m.content,
          },
        ],
      };
    }

    if (m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0) {
      const content: Array<Record<string, unknown>> = [];
      if (m.content) {
        content.push({ type: "text", text: m.content });
      }
      for (const tc of m.tool_calls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
      return { role: "assistant" as const, content };
    }

    // User message with images — multi-content block
    if (m.images && m.images.length > 0 && m.role === "user") {
      const content: Array<Record<string, unknown>> = [];
      for (const img of m.images) {
        if (img.type === "url") {
          content.push({ type: "image", source: { type: "url", url: img.url } });
        } else {
          content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
        }
      }
      content.push({ type: "text", text: m.content });
      return { role: "user" as const, content };
    }

    return {
      role: m.role as "user" | "assistant",
      content: m.content,
    };
  });

  return { systemMsg, anthropicMessages };
}

export class AnthropicProvider implements ModelProvider {
  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    apiKey: string,
    _modelId: string
  ): Promise<ModelResponse> {
    const config = MODEL_REGISTRY["claude-sonnet"];
    const { systemMsg, anthropicMessages } = buildAnthropicMessages(messages);

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: 4096,
      messages: anthropicMessages,
    };

    if (systemMsg) {
      body.system = systemMsg.content;
    }

    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      body,
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
      }
    );

    const data = response.data;

    // Parse Anthropic response format
    let content = "";
    const toolCalls: ToolCall[] = [];

    for (const block of data.content) {
      if (block.type === "text") {
        content += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    return {
      content,
      toolCalls,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
      finishReason: data.stop_reason || "end_turn",
    };
  }

  async chatStream(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    apiKey: string,
    _modelId: string,
    onChunk: StreamCallback
  ): Promise<ModelResponse> {
    const config = MODEL_REGISTRY["claude-sonnet"];
    const { systemMsg, anthropicMessages } = buildAnthropicMessages(messages);

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: 4096,
      messages: anthropicMessages,
      stream: true,
    };

    if (systemMsg) {
      body.system = systemMsg.content;
    }

    if (tools.length > 0) {
      body.tools = tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Anthropic stream error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body for streaming");

      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      const toolCalls: ToolCall[] = [];
      let inputTokens = 0;
      let outputTokens = 0;
      let finishReason = "end_turn";

      // Track current tool_use block being built
      let currentToolId = "";
      let currentToolName = "";
      let currentToolInput = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]" || !data) continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(data);
          } catch {
            continue;
          }

          const eventType = event.type as string;

          if (eventType === "message_start") {
            const message = event.message as Record<string, unknown>;
            const usage = message?.usage as Record<string, number> | undefined;
            if (usage) {
              inputTokens = usage.input_tokens || 0;
            }
          } else if (eventType === "content_block_start") {
            const block = event.content_block as Record<string, unknown>;
            if (block?.type === "tool_use") {
              currentToolId = (block.id as string) || "";
              currentToolName = (block.name as string) || "";
              currentToolInput = "";
            }
          } else if (eventType === "content_block_delta") {
            const delta = event.delta as Record<string, unknown>;
            if (delta?.type === "text_delta") {
              const text = (delta.text as string) || "";
              content += text;
              if (text) onChunk(text);
            } else if (delta?.type === "input_json_delta") {
              currentToolInput += (delta.partial_json as string) || "";
            }
          } else if (eventType === "content_block_stop") {
            if (currentToolId) {
              toolCalls.push({
                id: currentToolId,
                type: "function",
                function: {
                  name: currentToolName,
                  arguments: currentToolInput,
                },
              });
              currentToolId = "";
              currentToolName = "";
              currentToolInput = "";
            }
          } else if (eventType === "message_delta") {
            const delta = event.delta as Record<string, unknown>;
            if (delta?.stop_reason) {
              finishReason = delta.stop_reason as string;
            }
            const usage = event.usage as Record<string, number> | undefined;
            if (usage) {
              outputTokens = usage.output_tokens || 0;
            }
          }
        }
      }

      return {
        content,
        toolCalls,
        inputTokens,
        outputTokens,
        finishReason,
      };
    } catch {
      // Fall back to non-streaming
      return this.chat(messages, tools, apiKey, _modelId);
    }
  }
}
