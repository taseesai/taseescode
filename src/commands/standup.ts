// /standup — Generate standup from recent git activity
import { execFileSync } from 'child_process';
import { Agent } from '../core/agent';

const TIME_ALIASES: Record<string, string> = {
  'yesterday': '1 days ago',
  'today': '12 hours ago',
  'last week': '7 days ago',
  'last month': '30 days ago',
  'this week': '5 days ago',
};

function isSafeTimeExpr(since: string): boolean {
  return /^\d+\s+(hours?|days?|weeks?|months?)\s+ago$/.test(since);
}

function getGitUserName(): string {
  try {
    return execFileSync('git', ['config', 'user.name'], {
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
  } catch {
    return '';
  }
}

export async function handleStandup(args: string, agent: Agent): Promise<string> {
  try {
    const rawInput = args.trim().toLowerCase();

    // Resolve time expression
    let since: string;
    if (!rawInput) {
      since = '24 hours ago';
    } else if (TIME_ALIASES[rawInput]) {
      since = TIME_ALIASES[rawInput];
    } else if (isSafeTimeExpr(rawInput)) {
      since = rawInput;
    } else {
      return 'Invalid time format. Use: /standup 48 hours ago, /standup yesterday, /standup last week';
    }

    // Get recent commits using execFileSync (no shell injection)
    let commits = '';
    const userName = getGitUserName();
    try {
      const gitArgs = ['log', '--oneline', `--since=${since}`];
      if (userName) {
        gitArgs.push(`--author=${userName}`);
      }
      commits = execFileSync('git', gitArgs, {
        encoding: 'utf8',
        timeout: 10000,
      });
    } catch {
      try {
        commits = execFileSync('git', ['log', '--oneline', '-10'], {
          encoding: 'utf8',
          timeout: 10000,
        });
      } catch {
        commits = '';
      }
    }

    // Get current diff stats
    let diffStat = '';
    try {
      diffStat = execFileSync('git', ['diff', '--stat', 'HEAD~5', 'HEAD'], {
        encoding: 'utf8', timeout: 10000,
      });
    } catch {
      try {
        diffStat = execFileSync('git', ['diff', '--stat'], {
          encoding: 'utf8', timeout: 10000,
        });
      } catch {
        diffStat = '(no diff stats available)';
      }
    }

    // Get current branch
    let branch = '';
    try {
      branch = execFileSync('git', ['branch', '--show-current'], {
        encoding: 'utf8', timeout: 5000,
      }).trim();
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
