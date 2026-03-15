// /history — Browse past sessions
import { listSessions, loadSession, clearHistory } from '../utils/session';

export async function handleHistory(args: string): Promise<string> {
  const subCmd = args.trim().toLowerCase();

  if (subCmd === 'clear') {
    const count = await clearHistory();
    return `Cleared ${count} session(s).`;
  }

  if (subCmd && !isNaN(Number(subCmd))) {
    // Load specific session by index
    const sessions = await listSessions(50);
    const idx = parseInt(subCmd) - 1;
    if (idx < 0 || idx >= sessions.length) {
      return `Session #${subCmd} not found. Use /history to see available sessions.`;
    }
    const session = sessions[idx];
    const lines = [
      `Session: ${session.id}`,
      `Model: ${session.model}`,
      `Directory: ${session.cwd}`,
      `Started: ${session.startedAt}`,
      `Messages: ${session.messageCount}`,
      `Cost: ${session.totalCostSAR.toFixed(4)} SAR`,
      '',
      '--- Messages ---',
    ];

    for (const msg of (session.messages || []).slice(-20)) {
      const role = msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'TaseesCode' : msg.role;
      const content = (msg.content || '').slice(0, 200);
      lines.push(`[${role}]: ${content}`);
    }

    return lines.join('\n');
  }

  const sessions = await listSessions(15);

  if (sessions.length === 0) {
    return 'No session history yet. Sessions are saved automatically when you exit.';
  }

  const lines = ['Recent Sessions:', ''];
  sessions.forEach((s, i) => {
    const date = new Date(s.startedAt).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const cost = s.totalCostSAR > 0 ? ` | ${s.totalCostSAR.toFixed(4)} SAR` : ' | Free';
    lines.push(`  ${i + 1}. ${date} — ${s.model} — ${s.messageCount} msgs${cost}`);
    if (s.cwd) lines.push(`     ${s.cwd}`);
  });

  lines.push('');
  lines.push('Usage: /history <number> to view a session, /history clear to delete all');

  return lines.join('\n');
}
