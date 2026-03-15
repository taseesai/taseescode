import { ModelResponse, StreamCallback, ToolCall } from "./index";

/**
 * Parse an OpenAI-compatible SSE stream (used by DeepSeek, OpenAI, Groq, Kimi, and custom providers).
 * Uses native fetch() for streaming support.
 */
export async function parseOpenAICompatibleSSE(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
  onChunk: StreamCallback
): Promise<ModelResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Stream request failed: ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body for streaming");

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let finishReason = "stop";
  let inputTokens = 0;
  let outputTokens = 0;

  // Accumulate tool calls by index
  const toolCallMap: Map<number, { id: string; name: string; arguments: string }> = new Map();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]" || !data) continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }

      // Extract usage if present (OpenAI stream_options: include_usage)
      const usage = parsed.usage as Record<string, number> | undefined;
      if (usage) {
        inputTokens = usage.prompt_tokens || inputTokens;
        outputTokens = usage.completion_tokens || outputTokens;
      }

      const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
      if (!choices || choices.length === 0) continue;

      const choice = choices[0];
      const delta = choice.delta as Record<string, unknown> | undefined;
      if (!delta) continue;

      // Finish reason
      if (choice.finish_reason) {
        finishReason = choice.finish_reason as string;
      }

      // Text content
      const deltaContent = delta.content as string | undefined;
      if (deltaContent) {
        content += deltaContent;
        onChunk(deltaContent);
      }

      // Tool calls (accumulate silently)
      const deltaToolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
      if (deltaToolCalls) {
        for (const tc of deltaToolCalls) {
          const index = (tc.index as number) ?? 0;
          const existing = toolCallMap.get(index);

          if (!existing) {
            const fn = tc.function as Record<string, unknown> | undefined;
            toolCallMap.set(index, {
              id: (tc.id as string) || "",
              name: (fn?.name as string) || "",
              arguments: (fn?.arguments as string) || "",
            });
          } else {
            const fn = tc.function as Record<string, unknown> | undefined;
            if (tc.id) existing.id = tc.id as string;
            if (fn?.name) existing.name = fn.name as string;
            if (fn?.arguments) existing.arguments += fn.arguments as string;
          }
        }
      }

      // Usage in choice (Groq style)
      const choiceUsage = choice.usage as Record<string, number> | undefined;
      if (choiceUsage) {
        inputTokens = choiceUsage.prompt_tokens || inputTokens;
        outputTokens = choiceUsage.completion_tokens || outputTokens;
      }
    }
  }

  // Convert tool call map to array
  const toolCalls: ToolCall[] = [];
  const sortedKeys = Array.from(toolCallMap.keys()).sort((a, b) => a - b);
  for (const key of sortedKeys) {
    const tc = toolCallMap.get(key)!;
    toolCalls.push({
      id: tc.id,
      type: "function",
      function: {
        name: tc.name,
        arguments: tc.arguments,
      },
    });
  }

  return {
    content,
    toolCalls,
    inputTokens,
    outputTokens,
    finishReason,
  };
}
