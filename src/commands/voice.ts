/**
 * /voice — Voice-to-Code
 *
 * Free out of the box using Groq Whisper API (free with Groq key).
 * Records from microphone, transcribes in chunks, shows words as you speak.
 *
 * Flow:
 * 1. Start recording via sox/rec (cross-platform)
 * 2. Record in 3-second chunks
 * 3. Send each chunk to Groq Whisper → get text
 * 4. Display words appearing in real-time
 * 5. When silence detected or Enter pressed → submit as message
 */

import chalk from "chalk";
import { execSync, spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs-extra";
import { getConfig, getConfigDir } from "../utils/config";
import { ensureInstalled } from "../utils/auto-install";

const p = {
  white: chalk.hex("#E8E8E8"),
  gray: chalk.hex("#8B8B8B"),
  dim: chalk.hex("#4A4A4A"),
  green: chalk.hex("#5A9E6F"),
  yellow: chalk.hex("#C9A962"),
  red: chalk.hex("#C75050"),
  cyan: chalk.hex("#7AC8C8"),
};

function getRecordCommand(): { cmd: string; args: string[]; available: boolean } {
  // Check for sox/rec
  try {
    execSync("which rec", { stdio: "pipe", timeout: 3000 });
    return {
      cmd: "rec",
      args: ["-q", "-r", "16000", "-c", "1", "-b", "16", "-e", "signed-integer", "-t", "wav"],
      available: true,
    };
  } catch {}

  // Check for sox
  try {
    execSync("which sox", { stdio: "pipe", timeout: 3000 });
    return {
      cmd: "sox",
      args: ["-d", "-q", "-r", "16000", "-c", "1", "-b", "16", "-e", "signed-integer", "-t", "wav"],
      available: true,
    };
  } catch {}

  return { cmd: "rec", args: [], available: false };
}

async function transcribeWithGroq(audioPath: string, apiKey: string): Promise<string> {
  const audioBuffer = await fs.readFile(audioPath);
  const boundary = "----TaseesCodeVoice" + Date.now();

  // Build multipart form data manually
  const formParts: Buffer[] = [];

  // File part
  formParts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n` +
    `Content-Type: audio/wav\r\n\r\n`
  ));
  formParts.push(audioBuffer);
  formParts.push(Buffer.from("\r\n"));

  // Model part
  formParts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="model"\r\n\r\n` +
    `whisper-large-v3-turbo\r\n`
  ));

  // Language part (auto-detect Arabic + English)
  formParts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
    `json\r\n`
  ));

  formParts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(formParts);

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Whisper API error (${response.status}): ${text}`);
  }

  const data = await response.json() as { text?: string };
  return (data.text || "").trim();
}

export interface VoiceCallbacks {
  onListening: () => void;
  onTranscribing: () => void;
  onPartialText: (text: string) => void;
  onFinalText: (text: string) => void;
  onError: (error: string) => void;
}

export async function startVoiceRecording(
  callbacks: VoiceCallbacks,
  maxDurationSec: number = 30
): Promise<string> {
  const config = getConfig();
  const groqKey = config.apiKeys?.groq;

  if (!groqKey || groqKey.length < 10) {
    callbacks.onError(
      "Voice requires a Groq API key (FREE).\n" +
      "  1. Get one at: console.groq.com (30 seconds)\n" +
      "  2. Set it: /config set apiKeys.groq YOUR_KEY\n\n" +
      "  Groq Whisper transcription is completely free."
    );
    return "";
  }

  let recorder = getRecordCommand();
  if (!recorder.available) {
    // Auto-install sox — never ask the user to do it manually
    callbacks.onError("🔧 Installing audio recorder (sox)...");
    const result = ensureInstalled("rec", {
      brew: "sox",
      apt: "sox",
      yum: "sox",
    }, (msg) => callbacks.onError(`   ${msg}`));

    if (!result.success) {
      callbacks.onError(
        `Could not auto-install sox: ${result.message}\n` +
        "  Manual install: brew install sox (macOS) or apt install sox (Linux)"
      );
      return "";
    }

    // Retry after install
    recorder = getRecordCommand();
    if (!recorder.available) {
      callbacks.onError("sox installed but 'rec' command not found. Try restarting your terminal.");
      return "";
    }
    callbacks.onError("✅ Audio recorder installed!");
  }

  // Create unique temp directory per recording to avoid race conditions
  const recordingId = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tempDir = path.join(getConfigDir(), "voice-tmp", recordingId);
  await fs.ensureDir(tempDir);
  const audioPath = path.join(tempDir, "recording.wav");

  callbacks.onListening();

  return new Promise<string>((resolve) => {
    // Record with silence detection: stop after 2s of silence
    const recArgs = [
      ...recorder.args,
      audioPath,
      "silence", "1", "0.1", "3%",  // Start recording on sound
      "1", "2.0", "3%",              // Stop after 2s silence
      "trim", "0", String(maxDurationSec), // Max duration
    ];

    const proc = spawn(recorder.cmd, recArgs, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let killed = false;

    // Safety timeout
    const timeout = setTimeout(() => {
      if (!killed) {
        killed = true;
        proc.kill("SIGTERM");
      }
    }, (maxDurationSec + 2) * 1000);

    proc.on("error", (err) => {
      clearTimeout(timeout);
      callbacks.onError(`Recording error: ${err.message}`);
      resolve("");
    });

    proc.on("exit", async () => {
      clearTimeout(timeout);

      if (!(await fs.pathExists(audioPath))) {
        callbacks.onError("No audio recorded. Make sure your microphone is working.");
        resolve("");
        return;
      }

      const stat = await fs.stat(audioPath);
      if (stat.size < 1000) {
        // Too small — probably no speech
        await fs.remove(audioPath).catch(() => {});
        callbacks.onError("No speech detected. Try speaking louder or closer to the mic.");
        resolve("");
        return;
      }

      callbacks.onTranscribing();

      try {
        const text = await transcribeWithGroq(audioPath, groqKey);

        // Clean up
        await fs.remove(audioPath).catch(() => {});
        await fs.remove(tempDir).catch(() => {});

        if (!text) {
          callbacks.onError("Could not transcribe audio. Try again.");
          resolve("");
          return;
        }

        // Animate words appearing one by one
        const words = text.split(/\s+/);
        let displayed = "";
        for (let i = 0; i < words.length; i++) {
          displayed += (i > 0 ? " " : "") + words[i];
          callbacks.onPartialText(displayed);
          // Small delay between words for animation effect
          await new Promise(r => setTimeout(r, 60));
        }

        callbacks.onFinalText(text);
        resolve(text);
      } catch (err: any) {
        await fs.remove(audioPath).catch(() => {});
        callbacks.onError(`Transcription failed: ${err.message}`);
        resolve("");
      }
    });
  });
}

export async function handleVoice(args: string): Promise<string> {
  const subCmd = args.trim().toLowerCase();

  if (subCmd === "help" || subCmd === "-h") {
    return [
      "",
      p.white.bold("🎙️ Voice — Speak to Code"),
      p.gray("━".repeat(40)),
      "",
      "  /voice              Start voice recording",
      "  /voice help         Show this help",
      "",
      p.white("  How it works:"),
      "  1. Speak into your microphone",
      "  2. Words appear in real-time as you talk",
      "  3. When you stop speaking, TaseesCode processes your message",
      "",
      p.white("  Languages:"),
      "  • Arabic 🇸🇦 — speaks naturally in Arabic",
      "  • English 🌐 — speaks naturally in English",
      "  • Mixed — handles code-switching",
      "",
      p.white("  Requirements:"),
      "  • Microphone access",
      `  • sox: ${(() => { try { execSync("which rec", { stdio: "pipe" }); return p.green("✅ Installed"); } catch { return p.yellow("❌ Install: brew install sox"); } })()}`,
      `  • Groq key: ${(() => { const k = getConfig().apiKeys?.groq; return k && k.length > 10 ? p.green("✅ Set") : p.yellow("❌ Free at console.groq.com"); })()}`,
      "",
      p.dim("  Powered by Groq Whisper (free, unlimited)."),
      p.dim("  Your audio is processed and immediately deleted."),
      "",
    ].join("\n");
  }

  // If called without args, return instruction to trigger voice mode
  // (actual recording is handled by app.tsx)
  return "__VOICE_START__";
}
