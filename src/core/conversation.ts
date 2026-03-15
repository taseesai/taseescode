import { ChatMessage } from "../models";
import { ImageAttachment } from "../utils/image";

export class Conversation {
  private messages: ChatMessage[] = [];
  private maxTokens: number;

  constructor(maxTokens: number = 80000) {
    this.maxTokens = maxTokens;
  }

  addSystem(content: string): void {
    const idx = this.messages.findIndex((m) => m.role === "system");
    if (idx >= 0) {
      this.messages[idx].content = content;
    } else {
      this.messages.unshift({ role: "system", content });
    }
  }

  addUser(content: string): void {
    this.messages.push({ role: "user", content });
    this.compactIfNeeded();
  }

  addUserWithImages(content: string, images: ImageAttachment[]): void {
    this.messages.push({ role: "user", content, images });
    this.compactIfNeeded();
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
    let totalChars = 0;
    for (const m of this.messages) {
      totalChars += (m.content?.length || 0);
      // Tool calls add tokens too
      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          totalChars += (tc.function?.arguments?.length || 0) + 50;
        }
      }
    }
    // Arabic text uses ~2x tokens per char vs English
    const arabicChars = this.messages.reduce((sum, m) => {
      return sum + ((m.content || '').match(/[\u0600-\u06FF]/g) || []).length;
    }, 0);
    const arabicOverhead = arabicChars * 0.5; // Extra tokens for Arabic
    return Math.ceil((totalChars / 4) + arabicOverhead);
  }

  getMessageCount(): number {
    return this.messages.filter(m => m.role !== 'system').length;
  }

  /**
   * Get conversation messages suitable for session saving
   */
  getSerializableMessages(): Array<{role: string, content: string, timestamp: string}> {
    const now = new Date().toISOString();
    return this.messages
      .filter(m => m.role !== 'system' && m.role !== 'tool')
      .map(m => ({
        role: m.role,
        content: (m.content || '').slice(0, 500),
        timestamp: now,
      }));
  }

  /**
   * Auto-compact conversation when approaching token limit
   */
  private compactIfNeeded(): void {
    const estimate = this.getTokenEstimate();
    const threshold = this.maxTokens * 0.8; // Compact at 80% capacity

    if (estimate <= threshold) return;

    const system = this.messages.filter(m => m.role === 'system');
    const rest = this.messages.filter(m => m.role !== 'system');

    // Keep last 20 messages (10 exchanges), compact the rest
    const keepCount = Math.min(20, rest.length);
    const toCompact = rest.slice(0, rest.length - keepCount);
    const toKeep = rest.slice(rest.length - keepCount);

    if (toCompact.length === 0) return;

    // Build summary of older messages
    const summaryParts: string[] = [];
    for (const msg of toCompact) {
      if (msg.role === 'tool') continue; // Skip tool results in summary
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const content = (msg.content || '').slice(0, 150);
      if (content.trim()) {
        summaryParts.push(`[${role}]: ${content}`);
      }
    }

    const summary: ChatMessage = {
      role: 'system',
      content: `[Conversation compacted — ${toCompact.length} older messages summarized]\n${summaryParts.join('\n').slice(0, 2000)}`
    };

    this.messages = [...system, summary, ...toKeep];
  }
}
