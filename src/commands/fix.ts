// /fix [error-message] — Analyze and fix an error
import { Agent } from '../core/agent';

export async function handleFix(args: string, agent: Agent): Promise<string> {
  if (!args.trim()) {
    // Try to get last command output
    try {
      const { execSync } = require('child_process');
      // Common: user ran something that failed
      return 'Usage: /fix <error-message>\nPaste the error message after /fix and I\'ll analyze and fix it.';
    } catch {
      return 'Usage: /fix <error-message>';
    }
  }

  await agent.processMessage(
    `I got this error. Analyze the root cause, explain what went wrong, and fix it. If you need to read files or run commands, use the available tools.\n\nError:\n${args}`
  );
  return '';
}
