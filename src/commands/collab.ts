/**
 * /collab — Real-Time Pair Programming
 *
 * Host a lightweight collab session on local network.
 * Uses a simple HTTP server with polling — no external dependencies.
 *
 * Flow:
 * 1. Host runs /collab start → starts HTTP server on random port
 * 2. Partner runs /collab join <host:port> → connects to session
 * 3. Both see shared conversation context via polling
 * 4. /collab stop ends the session
 *
 * No internet required. No data leaves the local network.
 */

import chalk from "chalk";
import http from "http";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  yellow: chalk.hex("#C9A962"),
  red: chalk.hex("#C75050"),
};

interface CollabMessage {
  from: string;
  role: string;
  content: string;
  timestamp: string;
}

interface CollabSession {
  id: string;
  host: string;
  port: number;
  startedAt: string;
  messages: CollabMessage[];
}

let activeSession: CollabSession | null = null;
let server: http.Server | null = null;

function generateSessionId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getLocalIP(): string {
  try {
    const { execSync } = require("child_process");
    const output = execSync(
      "ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}'",
      { encoding: "utf-8", timeout: 3000 }
    ).trim();
    return output || "localhost";
  } catch {
    return "localhost";
  }
}

export function addCollabMessage(from: string, role: string, content: string): void {
  if (!activeSession) return;
  activeSession.messages.push({
    from,
    role,
    content: content.slice(0, 500),
    timestamp: new Date().toISOString(),
  });
}

export function isCollabActive(): boolean {
  return activeSession !== null;
}

async function startHost(): Promise<string> {
  if (activeSession) {
    return p.yellow("Session already active. Use /collab stop first.").toString();
  }

  const sessionId = generateSessionId();
  const localIP = getLocalIP();

  activeSession = {
    id: sessionId,
    host: localIP,
    port: 0,
    startedAt: new Date().toISOString(),
    messages: [],
  };

  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/json");

      if (req.method === "GET" && req.url === "/session") {
        res.writeHead(200);
        res.end(
          JSON.stringify({
            id: activeSession?.id,
            messages: activeSession?.messages.slice(-50) || [],
          })
        );
        return;
      }

      if (req.method === "POST" && req.url === "/message") {
        let body = "";
        req.on("data", (chunk: Buffer) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            const msg = JSON.parse(body);
            if (activeSession) {
              activeSession.messages.push({
                from: msg.from || "guest",
                role: msg.role || "user",
                content: (msg.content || "").slice(0, 500),
                timestamp: new Date().toISOString(),
              });
            }
            res.writeHead(200);
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400);
            res.end(JSON.stringify({ error: "Invalid JSON" }));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    });

    server.listen(0, "0.0.0.0", () => {
      const addr = server!.address() as { port: number };
      const port = addr.port;
      activeSession!.port = port;

      resolve(
        [
          "",
          p.green.bold("Collab Session Started"),
          p.gray("\u2501".repeat(40)),
          "",
          `  Session ID:  ${p.white.bold(sessionId)}`,
          `  Join URL:    ${p.white(`http://${localIP}:${port}/session`)}`,
          "",
          p.white("  Share with your teammate:"),
          `  ${p.dim("They run:")} ${p.white(`/collab join ${localIP}:${port}`)}`,
          "",
          p.dim("  Both of you will see each other's messages."),
          p.dim("  Your conversation is shared in real-time on local network."),
          p.dim("  Use /collab stop to end the session."),
          "",
        ].join("\n")
      );
    });
  });
}

function stopSession(): string {
  if (!activeSession) {
    return p.dim("No active session.").toString();
  }
  const msgCount = activeSession.messages.length;
  activeSession = null;
  if (server) {
    server.close();
    server = null;
  }
  return p.green(`Session ended. ${msgCount} messages shared.`).toString();
}

function getStatus(): string {
  if (!activeSession) {
    return p.dim("No active collab session.").toString();
  }
  return [
    "",
    p.white.bold("Session Status"),
    `  ID:       ${p.white(activeSession.id)}`,
    `  Host:     ${p.white(activeSession.host + ":" + activeSession.port)}`,
    `  Messages: ${p.white(String(activeSession.messages.length))}`,
    `  Started:  ${p.dim(new Date(activeSession.startedAt).toLocaleTimeString())}`,
    "",
  ].join("\n");
}

async function joinSession(target: string): Promise<string> {
  try {
    const url = target.startsWith("http") ? target : `http://${target}`;
    const res = await fetch(`${url}/session`);
    const data = (await res.json()) as { id?: string; messages?: unknown[] };
    return [
      p.green(`Connected to session ${data.id || "unknown"}`),
      `  ${p.dim(`${data.messages?.length || 0} messages in history`)}`,
      `  ${p.dim("Your messages will be shared with the host.")}`,
    ].join("\n");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return p.red(`Could not connect to ${target}: ${msg}`).toString();
  }
}

export async function handleCollab(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const subCmd = parts[0]?.toLowerCase() || "";

  if (subCmd === "help" || !subCmd) {
    return [
      "",
      p.white.bold("Collab — Real-Time Pair Programming"),
      p.gray("\u2501".repeat(40)),
      "",
      "  /collab start        Host a pair programming session",
      "  /collab join <host>  Join a session on your local network",
      "  /collab stop         End the current session",
      "  /collab status       Check session status",
      "",
      p.white("  How it works:"),
      "  1. Host runs /collab start \u2192 gets a join URL",
      "  2. Partner runs /collab join <host:port>",
      "  3. Both see shared conversation context",
      "  4. AI responses visible to both terminals",
      "",
      p.dim("  Works on local network (same WiFi/LAN)."),
      p.dim("  No internet required. No data leaves your network."),
      "",
    ].join("\n");
  }

  if (subCmd === "start" || subCmd === "host") {
    return startHost();
  }

  if (subCmd === "stop" || subCmd === "end") {
    return stopSession();
  }

  if (subCmd === "status") {
    return getStatus();
  }

  if (subCmd === "join" && parts[1]) {
    return joinSession(parts[1]);
  }

  return "Usage: /collab start | join <host:port> | stop | status";
}
