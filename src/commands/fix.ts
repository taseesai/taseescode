// /fix [error-message] — Analyze and fix an error
import { execFileSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { Agent } from '../core/agent';

interface ParsedError {
  filePath: string;
  line: number | null;
  column: number | null;
}

function parseErrorLocations(errorText: string): ParsedError[] {
  const results: ParsedError[] = [];
  const seen = new Set<string>();

  // Common patterns: file:line:col, file(line,col), file line X
  const patterns = [
    // TypeScript/ESLint: src/foo.ts(10,5) or src/foo.ts:10:5
    /([a-zA-Z0-9_.\-\/\\]+\.[a-zA-Z]{1,5})[:(](\d+)[,:](\d+)/g,
    // Python/generic: File "foo.py", line 10
    /(?:File\s+["'])([^"']+)["'],\s*line\s+(\d+)/g,
    // Simple: foo.ts:10
    /([a-zA-Z0-9_.\-\/\\]+\.[a-zA-Z]{1,5}):(\d+)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(errorText)) !== null) {
      const filePath = match[1];
      const line = parseInt(match[2], 10);
      const column = match[3] ? parseInt(match[3], 10) : null;
      const key = `${filePath}:${line}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ filePath, line, column });
      }
    }
  }

  return results;
}

async function readFileContext(filePath: string, line: number | null): Promise<string | null> {
  try {
    const resolved = path.resolve(process.cwd(), filePath);
    if (!await fs.pathExists(resolved)) return null;

    const content = await fs.readFile(resolved, 'utf8');
    const lines = content.split('\n');

    if (line !== null && lines.length > 20) {
      // Show context around the error line
      const start = Math.max(0, line - 10);
      const end = Math.min(lines.length, line + 10);
      const snippet = lines.slice(start, end)
        .map((l, i) => {
          const lineNum = start + i + 1;
          const marker = lineNum === line ? ' >>>' : '    ';
          return `${marker} ${lineNum}: ${l}`;
        })
        .join('\n');
      return `--- ${filePath} (lines ${start + 1}-${end}) ---\n${snippet}`;
    }

    // File is small enough to include entirely, or no line number
    const maxLines = 80;
    if (lines.length <= maxLines) {
      return `--- ${filePath} (full file) ---\n${content}`;
    }
    return `--- ${filePath} (first ${maxLines} lines) ---\n${lines.slice(0, maxLines).join('\n')}`;
  } catch {
    return null;
  }
}

function getRecentGitChanges(): string {
  try {
    const diff = execFileSync('git', ['diff', '--stat', 'HEAD~3', 'HEAD'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    return diff.trim() || '(no recent changes)';
  } catch {
    try {
      return execFileSync('git', ['diff', '--stat'], {
        encoding: 'utf8',
        timeout: 5000,
      }).trim() || '(no changes)';
    } catch {
      return '(git not available)';
    }
  }
}

export async function handleFix(args: string, agent: Agent): Promise<string> {
  if (!args.trim()) {
    return 'Usage: /fix <error-message>\nPaste the error message after /fix and I\'ll analyze and fix it.';
  }

  const errorText = args.trim();

  // Parse file locations from the error
  const locations = parseErrorLocations(errorText);

  // Read referenced files for context
  const fileContexts: string[] = [];
  const maxFiles = 5;
  for (const loc of locations.slice(0, maxFiles)) {
    const ctx = await readFileContext(loc.filePath, loc.line);
    if (ctx) fileContexts.push(ctx);
  }

  // Get recent git changes for additional context
  const recentChanges = getRecentGitChanges();

  // Build a rich prompt with all context
  const parts: string[] = [
    'I got this error. Analyze the root cause, explain what went wrong, and fix it.',
    'If you need to read additional files or run commands, use the available tools.',
    '',
    '## Error',
    '```',
    errorText,
    '```',
  ];

  if (fileContexts.length > 0) {
    parts.push('', '## Referenced Files', '```');
    parts.push(fileContexts.join('\n\n'));
    parts.push('```');
  }

  parts.push('', '## Recent Git Changes', '```', recentChanges, '```');

  await agent.processMessage(parts.join('\n'));
  return '';
}
