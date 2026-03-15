// /explain [file] — Explain what a file or code does
import { Agent } from '../core/agent';

export async function handleExplain(args: string, agent: Agent): Promise<string> {
  const filePath = args.trim();
  if (!filePath) {
    return 'Usage: /explain <file-path>\nExample: /explain src/app.tsx';
  }

  try {
    const fs = require('fs-extra');
    const path = require('path');
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!(await fs.pathExists(fullPath))) {
      return `File not found: ${filePath}`;
    }
    const content = await fs.readFile(fullPath, 'utf8');
    const truncated = content.slice(0, 8000);
    await agent.processMessage(
      `Explain this code file (${filePath}) clearly. What does it do? How does it work? What are the key functions/classes? Explain the architecture and any patterns used.\n\n\`\`\`\n${truncated}\n\`\`\``
    );
    return '';
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}
