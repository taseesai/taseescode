// Qwen2.5-Coder provider — placeholder for future integration
// Will use OpenAI-compatible API format similar to DeepSeek

import {
  ModelProvider,
  ChatMessage,
  ToolDefinition,
  ModelResponse,
} from "./index";

export class QwenProvider implements ModelProvider {
  async chat(
    _messages: ChatMessage[],
    _tools: ToolDefinition[],
    _apiKey: string,
    _modelId: string
  ): Promise<ModelResponse> {
    throw new Error(
      "Qwen provider not yet configured. Add Qwen API endpoint to model registry."
    );
  }
}
