import * as fs from 'fs-extra';
import * as path from 'path';
import { getConfigDir } from './config';

export interface SessionRecord {
  id: string;
  startedAt: string;
  endedAt?: string;
  model: string;
  cwd: string;
  messageCount: number;
  totalCostSAR: number;
  messages: Array<{role: string; content: string; timestamp: string}>;
}

function getHistoryDir(): string {
  return path.join(getConfigDir(), 'history');
}

export function generateSessionId(): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
  const rand = Math.random().toString(36).slice(2, 6);
  return `${date}_${time}_${rand}`;
}

export async function saveSession(session: SessionRecord): Promise<void> {
  const dir = getHistoryDir();
  await fs.ensureDir(dir);
  const filePath = path.join(dir, `${session.id}.json`);
  await fs.writeJSON(filePath, session, { spaces: 2 });
}

export async function loadSession(id: string): Promise<SessionRecord | null> {
  const filePath = path.join(getHistoryDir(), `${id}.json`);
  if (await fs.pathExists(filePath)) {
    return fs.readJSON(filePath);
  }
  return null;
}

export async function listSessions(limit: number = 20): Promise<SessionRecord[]> {
  const dir = getHistoryDir();
  if (!(await fs.pathExists(dir))) return [];

  const files = await fs.readdir(dir);
  const sessions: SessionRecord[] = [];

  const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse().slice(0, limit);

  for (const file of jsonFiles) {
    try {
      const session = await fs.readJSON(path.join(dir, file));
      sessions.push(session);
    } catch {
      // Skip corrupted files
    }
  }

  return sessions;
}

export async function deleteSession(id: string): Promise<boolean> {
  const filePath = path.join(getHistoryDir(), `${id}.json`);
  if (await fs.pathExists(filePath)) {
    await fs.remove(filePath);
    return true;
  }
  return false;
}

export async function clearHistory(): Promise<number> {
  const dir = getHistoryDir();
  if (!(await fs.pathExists(dir))) return 0;
  const files = await fs.readdir(dir);
  const count = files.filter(f => f.endsWith('.json')).length;
  await fs.emptyDir(dir);
  return count;
}
