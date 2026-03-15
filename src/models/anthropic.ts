import axios from "axios";
import {
  ModelProvider,
  ChatMessage,
  ToolDefinition,
  ModelResponse,
  MODEL_REGISTRY,
} from "./index";

export class AnthropicProvider implements ModelProvider {
  async chat(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    apiKey: string,
    _modelId: string
  ): Promise<ModelResponse> {
    const config = MODEL_REGISTRY["claude-sonnet"];

    // Separate system message from conversation
    const systemMsg = messages.find((m) => m.role === "system");
    const conversationMsgs = messages.filter((m) => m.role !== "system");

    // Convert messages to Anthropic format
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

      return {
        role: m.role as "user" | "assistant",
        content: m.content,
      };
    });

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
    const toolCalls: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }> = [];

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
}
