import { ChatMessage } from "../models";

export class Conversation {
  private messages: ChatMessage[] = [];

  addSystem(content: string): void {
    // Replace existing system message or add new one
    const idx = this.messages.findIndex((m) => m.role === "system");
    if (idx >= 0) {
      this.messages[idx].content = content;
    } else {
      this.messages.unshift({ role: "system", content });
    }
  }

  addUser(content: string): void {
    this.messages.push({ role: "user", content });
  }

  addAssistant(content: string, toolCalls?: ChatMessage["tool_calls"]): void {
    const msg: ChatMessage = { role: "assistant", content };
    if (toolCalls && toolCalls.length > 0) {
      msg.tool_calls = toolCalls;
    }
    this.messages.push(msg);
  }

  addToolResult(toolCallId: string, content: string, name?: string): void {
    this.messages.push({
      role: "tool",
      content,
      tool_call_id: toolCallId,
      name,
    });
  }

  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  clear(): void {
    const system = this.messages.find((m) => m.role === "system");
    this.messages = [];
    if (system) {
      this.messages.push(system);
    }
  }

  getTokenEstimate(): number {
    // Rough estimate: ~4 chars per token
    const totalChars = this.messages.reduce(
      (sum, m) => sum + (m.content?.length || 0),
      0
    );
    return Math.ceil(totalChars / 4);
  }
}
