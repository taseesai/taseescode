// Approximate token counter (4 chars ~ 1 token, but smarter)
export function countTokens(text: string): number {
  if (!text) return 0;
  // Better estimation: split by whitespace and punctuation
  const words = text.split(/\s+/).length;
  const chars = text.length;
  // Average: 0.75 tokens per word for English, ~1.5 for Arabic
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const arabicRatio = arabicChars / (chars || 1);
  const tokensPerWord = 0.75 + (arabicRatio * 0.75); // Arabic uses more tokens
  return Math.ceil(words * tokensPerWord) + 10; // +10 for message overhead
}

export function countMessageTokens(messages: Array<{role: string; content: string}>): number {
  let total = 0;
  for (const msg of messages) {
    total += countTokens(msg.content || '') + 4; // 4 tokens per message overhead
  }
  return total;
}

// Compact conversation by summarizing old messages
export function compactMessages(
  messages: Array<{role: string; content: string}>,
  maxTokens: number
): Array<{role: string; content: string}> {
  const system = messages.filter(m => m.role === 'system');
  const rest = messages.filter(m => m.role !== 'system');

  let totalTokens = countMessageTokens(system);
  const kept: Array<{role: string; content: string}> = [];

  // Always keep recent messages (last 10 exchanges)
  const recent = rest.slice(-20);
  const older = rest.slice(0, -20);

  const recentTokens = countMessageTokens(recent);
  totalTokens += recentTokens;

  if (totalTokens < maxTokens || older.length === 0) {
    return messages; // No compaction needed
  }

  // Summarize older messages into a single system message
  const summary = older.map(m => {
    const role = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : m.role;
    const content = (m.content || '').slice(0, 200);
    return `[${role}]: ${content}`;
  }).join('\n');

  const compactedMsg = {
    role: 'system' as const,
    content: `[Previous conversation summary - ${older.length} messages compacted]:\n${summary.slice(0, 2000)}`
  };

  return [...system, compactedMsg, ...recent];
}
