// /review [file] — AI reviews a file or staged changes
// If file provided, reads and asks AI to review
// If no file, reviews git staged changes
import fs from 'fs-extra';
import path from 'path';
import { execFileSync } from 'child_process';
import { Agent } from '../core/agent';

const MAX_CONTENT_LENGTH = 8000;

function truncateWithWarning(content: string, label: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) return content;
  return content.slice(0, MAX_CONTENT_LENGTH) +
    `\n[... ${label} truncated — showing ${MAX_CONTENT_LENGTH} of ${content.length} chars ...]`;
}

export async function handleReview(args: string, agent: Agent): Promise<string> {
  if (args.trim()) {
    // Review specific file
    const filePath = args.trim();
    try {
      const fullPath = path.resolve(process.cwd(), filePath);
      if (!(await fs.pathExists(fullPath))) {
        return `File not found: ${filePath}`;
      }
      const content = await fs.readFile(fullPath, 'utf8');
      const truncated = truncateWithWarning(content, 'file content');
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
      const diff = execFileSync('git', ['diff', '--cached'], { encoding: 'utf8', timeout: 10000 });
      if (!diff.trim()) {
        const unstaged = execFileSync('git', ['diff'], { encoding: 'utf8', timeout: 10000 });
        if (!unstaged.trim()) {
          return 'No staged or unstaged changes to review. Stage files with `git add` or specify a file: /review path/to/file';
        }
        await agent.processMessage(
          `Review these unstaged code changes. Find bugs, security issues, and suggest improvements.\n\n\`\`\`diff\n${truncateWithWarning(unstaged, 'diff')}\n\`\`\``
        );
        return '';
      }
      await agent.processMessage(
        `Review these staged code changes. Find bugs, security issues, and suggest improvements.\n\n\`\`\`diff\n${truncateWithWarning(diff, 'diff')}\n\`\`\``
      );
      return '';
    } catch (e: any) {
      return `Git error: ${e.message}`;
    }
  }
}
