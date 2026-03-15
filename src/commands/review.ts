// /review [file] — AI reviews a file or staged changes
// If file provided, reads and asks AI to review
// If no file, reviews git staged changes
import { Agent } from '../core/agent';

export async function handleReview(args: string, agent: Agent): Promise<string> {
  if (args.trim()) {
    // Review specific file
    const filePath = args.trim();
    try {
      const fs = require('fs-extra');
      const path = require('path');
      const fullPath = path.resolve(process.cwd(), filePath);
      if (!(await fs.pathExists(fullPath))) {
        return `File not found: ${filePath}`;
      }
      const content = await fs.readFile(fullPath, 'utf8');
      const truncated = content.slice(0, 8000);
      // Send to AI as a user message
      await agent.processMessage(
        `Review this code file (${filePath}). Find bugs, security issues, performance problems, and suggest improvements. Be specific with line references.\n\n\`\`\`\n${truncated}\n\`\`\``
      );
      return '';
    } catch (e: any) {
      return `Error reading file: ${e.message}`;
    }
  } else {
    // Review staged changes
    try {
      const { execSync } = require('child_process');
      const diff = execSync('git diff --cached', { encoding: 'utf8', timeout: 10000 });
      if (!diff.trim()) {
        const unstaged = execSync('git diff', { encoding: 'utf8', timeout: 10000 });
        if (!unstaged.trim()) {
          return 'No staged or unstaged changes to review. Stage files with `git add` or specify a file: /review path/to/file';
        }
        await agent.processMessage(
          `Review these unstaged code changes. Find bugs, security issues, and suggest improvements.\n\n\`\`\`diff\n${unstaged.slice(0, 8000)}\n\`\`\``
        );
        return '';
      }
      await agent.processMessage(
        `Review these staged code changes. Find bugs, security issues, and suggest improvements.\n\n\`\`\`diff\n${diff.slice(0, 8000)}\n\`\`\``
      );
      return '';
    } catch (e: any) {
      return `Git error: ${e.message}`;
    }
  }
}
