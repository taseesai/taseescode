// /explain [file] — Explain what a file or code does
import fs from 'fs-extra';
import path from 'path';
import { Agent } from '../core/agent';

const MAX_CONTENT_LENGTH = 8000;

export async function handleExplain(args: string, agent: Agent): Promise<string> {
  const filePath = args.trim();
  if (!filePath) {
    return 'Usage: /explain <file-path>\nExample: /explain src/app.tsx';
  }

  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!(await fs.pathExists(fullPath))) {
      return `File not found: ${filePath}`;
    }
    const content = await fs.readFile(fullPath, 'utf8');
    let truncated: string;
    if (content.length > MAX_CONTENT_LENGTH) {
      truncated = content.slice(0, MAX_CONTENT_LENGTH) +
        `\n[... file truncated — showing ${MAX_CONTENT_LENGTH} of ${content.length} chars ...]`;
    } else {
      truncated = content;
    }
    await agent.processMessage(
      `Explain this code file (${filePath}) clearly. What does it do? How does it work? What are the key functions/classes? Explain the architecture and any patterns used.\n\n\`\`\`\n${truncated}\n\`\`\``
    );
    return '';
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}
