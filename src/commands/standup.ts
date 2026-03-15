// /standup — Generate standup from recent git activity
import { Agent } from '../core/agent';

export async function handleStandup(args: string, agent: Agent): Promise<string> {
  try {
    const { execSync } = require('child_process');

    const since = args.trim() || '24 hours ago';

    // Get recent commits
    let commits = '';
    try {
      commits = execSync(`git log --oneline --since="${since}" --author="$(git config user.name)" 2>/dev/null || git log --oneline -10 --since="${since}"`, {
        encoding: 'utf8', timeout: 10000
      });
    } catch {
      commits = execSync('git log --oneline -10', { encoding: 'utf8', timeout: 10000 });
    }

    // Get current diff stats
    let diffStat = '';
    try {
      diffStat = execSync('git diff --stat HEAD~5 HEAD 2>/dev/null || git diff --stat', {
        encoding: 'utf8', timeout: 10000
      });
    } catch {
      diffStat = '(no diff stats available)';
    }

    // Get current branch
    let branch = '';
    try {
      branch = execSync('git branch --show-current', { encoding: 'utf8', timeout: 5000 }).trim();
    } catch {
      branch = 'unknown';
    }

    if (!commits.trim()) {
      return `No commits found in the last ${since}. Try: /standup 48 hours ago`;
    }

    await agent.processMessage(
      `Generate a concise daily standup report from this git activity. Format it as:\n- Done (yesterday)\n- In Progress (today)\n- Blockers\n\nBranch: ${branch}\n\nRecent commits:\n${commits}\n\nDiff stats:\n${diffStat}`
    );
    return '';
  } catch (e: any) {
    return `Git error: ${e.message}. Make sure you're in a git repository.`;
  }
}
