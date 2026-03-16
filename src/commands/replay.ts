import chalk from "chalk";
import path from "path";
import fs from "fs-extra";
import { getConfigDir } from "../utils/config";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  yellow: chalk.hex("#C9A962"),
  red: chalk.hex("#C75050"),
};

interface ReplayEntry {
  timestamp: string;
  type: "user" | "assistant" | "tool" | "system";
  content: string;
  toolName?: string;
}

let recording = false;
let currentRecording: ReplayEntry[] = [];
let recordingStartTime: string = "";
let recordingName: string = "";

export function isRecording(): boolean {
  return recording;
}

export function recordEntry(type: ReplayEntry["type"], content: string, toolName?: string): void {
  if (!recording) return;
  currentRecording.push({
    timestamp: new Date().toISOString(),
    type,
    content: content.slice(0, 500),
    toolName,
  });
}

async function saveRecording(name?: string): Promise<string> {
  const dir = path.join(getConfigDir(), "recordings");
  await fs.ensureDir(dir);
  const filename = name || `recording-${Date.now()}`;
  const filePath = path.join(dir, `${filename}.json`);

  await fs.writeJSON(filePath, {
    name: filename,
    startedAt: recordingStartTime,
    endedAt: new Date().toISOString(),
    entries: currentRecording,
    entryCount: currentRecording.length,
  }, { spaces: 2 });

  return filePath;
}

async function listRecordings(): Promise<string[]> {
  const dir = path.join(getConfigDir(), "recordings");
  if (!(await fs.pathExists(dir))) return [];
  const files = await fs.readdir(dir);
  return files.filter(f => f.endsWith(".json")).sort().reverse();
}

async function playRecording(filename: string): Promise<string> {
  const dir = path.join(getConfigDir(), "recordings");
  const filePath = path.join(dir, filename.endsWith(".json") ? filename : `${filename}.json`);

  if (!(await fs.pathExists(filePath))) {
    return p.red(`Recording not found: ${filename}`).toString();
  }

  const data = await fs.readJSON(filePath);
  const lines: string[] = [
    "",
    p.white.bold(`Replay: ${data.name}`),
    p.gray("\u2501".repeat(40)),
    p.dim(`  Started: ${new Date(data.startedAt).toLocaleString()}`),
    p.dim(`  Entries: ${data.entryCount}`),
    "",
  ];

  for (const entry of (data.entries || []).slice(0, 50)) {
    const time = new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false });
    const icon = entry.type === "user" ? ">" : entry.type === "assistant" ? "*" : entry.type === "tool" ? "!" : "i";
    const color = entry.type === "user" ? p.gray : entry.type === "assistant" ? p.white : entry.type === "tool" ? p.dim : p.dim;
    const content = entry.content.length > 200 ? entry.content.slice(0, 200) + "..." : entry.content;
    lines.push(`  ${p.dim(time)} ${icon} ${color(content)}`);
  }

  if (data.entries?.length > 50) {
    lines.push(p.dim(`  ... and ${data.entries.length - 50} more entries`));
  }

  lines.push("");
  return lines.join("\n");
}

async function exportToMarkdown(filename: string): Promise<string> {
  const dir = path.join(getConfigDir(), "recordings");
  const filePath = path.join(dir, filename.endsWith(".json") ? filename : `${filename}.json`);

  if (!(await fs.pathExists(filePath))) {
    return p.red(`Recording not found: ${filename}`).toString();
  }

  const data = await fs.readJSON(filePath);
  const mdLines = [
    `# TaseesCode Session: ${data.name}`,
    `> Recorded ${new Date(data.startedAt).toLocaleString()}`,
    "",
  ];

  for (const entry of data.entries || []) {
    if (entry.type === "user") mdLines.push(`**You:** ${entry.content}\n`);
    else if (entry.type === "assistant") mdLines.push(`**TaseesCode:** ${entry.content}\n`);
    else if (entry.type === "tool") mdLines.push(`> ${entry.toolName}: ${entry.content}\n`);
  }

  const outPath = path.resolve(process.cwd(), `${data.name}.md`);
  const exists = await fs.pathExists(outPath);
  await fs.writeFile(outPath, mdLines.join("\n"), "utf-8");
  const warning = exists ? p.yellow(`  (overwritten existing file)`) : "";
  return p.green(`Exported to: ${outPath}`).toString() + (warning ? `\n${warning}` : "");
}

export async function handleReplay(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const subCmd = parts[0]?.toLowerCase() || "";

  if (subCmd === "help" || (!subCmd && !recording)) {
    const recordings = await listRecordings();
    return [
      "",
      p.white.bold("Replay — Session Recording & Playback"),
      p.gray("\u2501".repeat(40)),
      "",
      "  /replay start [name]     Start recording this session",
      "  /replay stop             Stop recording and save",
      "  /replay list             List saved recordings",
      "  /replay play <name>      Play back a recording",
      "  /replay export <name>    Export to Markdown file",
      "  /replay delete <name>    Delete a recording",
      "",
      `  Status: ${recording ? p.red("Recording...") : p.dim("Not recording")}`,
      `  Saved recordings: ${recordings.length}`,
      "",
      p.dim("  Record your sessions to share, review, or create tutorials."),
      "",
    ].join("\n");
  }

  if (subCmd === "start") {
    if (recording) return p.yellow("Already recording. Use /replay stop to save.").toString();
    recording = true;
    currentRecording = [];
    recordingStartTime = new Date().toISOString();
    recordingName = parts[1] || `session-${Date.now()}`;
    return p.green(`Recording started: "${recordingName}"\n   All messages will be saved. Use /replay stop to finish.`).toString();
  }

  if (subCmd === "stop") {
    if (!recording) return p.yellow("Not recording. Use /replay start to begin.").toString();
    recording = false;
    const filePath = await saveRecording(recordingName || undefined);
    const count = currentRecording.length;
    currentRecording = [];
    return p.green(`Recording saved! ${count} entries.\n   File: ${filePath}\n   Play: /replay play ${path.basename(filePath, ".json")}`).toString();
  }

  if (subCmd === "list") {
    const recordings = await listRecordings();
    if (recordings.length === 0) return "No recordings yet. Start with /replay start";
    const lines = ["", p.white.bold("Saved Recordings"), p.gray("\u2501".repeat(30)), ""];
    for (const file of recordings.slice(0, 15)) {
      lines.push(`  * ${p.white(path.basename(file, ".json"))}`);
    }
    lines.push("", p.dim("  /replay play <name> to watch"), "");
    return lines.join("\n");
  }

  if (subCmd === "play" && parts[1]) {
    return playRecording(parts[1]);
  }

  if (subCmd === "export" && parts[1]) {
    return exportToMarkdown(parts[1]);
  }

  if (subCmd === "delete" && parts[1]) {
    const dir = path.join(getConfigDir(), "recordings");
    const file = parts[1].endsWith(".json") ? parts[1] : `${parts[1]}.json`;
    const filePath = path.join(dir, file);
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
      return p.green(`Deleted: ${parts[1]}`).toString();
    }
    return p.red(`Not found: ${parts[1]}`).toString();
  }

  return "Usage: /replay start|stop|list|play|export|delete";
}
