import fs from "fs-extra";
import path from "path";

const IMAGE_URL_PATTERN = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)(\?[^\s]*)?/gi;
const LOCAL_PATH_PATTERN = /(?:^|\s)((?:\/|~\/|\.\/)[^\s]+\.(?:jpg|jpeg|png|gif|webp|bmp))/gi;

export interface ImageAttachment {
  type: "url" | "base64";
  url?: string;
  data?: string;
  mediaType: string;
  source: string; // original path/url for display
}

/** Detect image paths and URLs mentioned in user message */
export function detectImages(text: string): string[] {
  const found: string[] = [];

  // URLs
  const urlMatches = text.match(IMAGE_URL_PATTERN) || [];
  found.push(...urlMatches);

  // Local paths
  const pathMatches = [...text.matchAll(LOCAL_PATH_PATTERN)];
  for (const m of pathMatches) found.push(m[1].trim());

  return [...new Set(found)];
}

/** Load image as base64 (local) or return URL reference (remote) */
export async function loadImage(source: string): Promise<ImageAttachment> {
  const mediaType = getMediaType(source);

  if (source.startsWith("http")) {
    return { type: "url", url: source, mediaType, source };
  }

  // Local file — expand ~ and resolve
  const resolved = source.startsWith("~")
    ? source.replace("~", process.env.HOME || "")
    : path.resolve(source);

  if (!(await fs.pathExists(resolved))) {
    throw new Error(`Image not found: ${resolved}`);
  }

  const buffer = await fs.readFile(resolved);
  const data = buffer.toString("base64");
  return { type: "base64", data, mediaType, source };
}

function getMediaType(src: string): string {
  const ext = path.extname(src.split("?")[0]).toLowerCase();
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".tiff": "image/tiff",
  };
  return map[ext] || "image/jpeg";
}

// ── VIDEO SUPPORT ──────────────────────────────────────────

import { execSync } from "child_process";
import os from "os";

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".wmv", ".flv", ".3gp"];
const VIDEO_PATH_PATTERN = /(?:^|\s)((?:\/|~\/|\.\/)[^\s]+\.(?:mp4|mov|avi|mkv|webm|m4v|wmv|flv|3gp))/gi;

export function detectVideos(text: string): string[] {
  const found: string[] = [];
  const matches = [...text.matchAll(VIDEO_PATH_PATTERN)];
  for (const m of matches) found.push(m[1].trim());
  return [...new Set(found)];
}

export interface VideoFrames {
  source: string;
  frames: ImageAttachment[];
  duration: number;  // seconds
  frameCount: number;
}

export async function extractVideoFrames(
  videoPath: string,
  maxFrames = 6
): Promise<VideoFrames> {
  // Resolve path
  const resolved = videoPath.startsWith("~")
    ? videoPath.replace("~", process.env.HOME || os.homedir())
    : path.resolve(videoPath);

  if (!(await fs.pathExists(resolved))) {
    throw new Error(`Video not found: ${resolved}`);
  }

  // Get video duration
  let duration = 0;
  try {
    const probe = execSync(
      `ffprobe -v quiet -print_format json -show_format "${resolved}"`,
      { encoding: "utf-8", timeout: 10000 }
    );
    const info = JSON.parse(probe);
    duration = parseFloat(info.format?.duration || "0");
  } catch {
    duration = 30; // assume 30s if can't probe
  }

  // Create temp dir for frames
  const tmpDir = path.join(os.tmpdir(), `taseescode-frames-${Date.now()}`);
  await fs.ensureDir(tmpDir);

  // Extract evenly-spaced frames
  const interval = duration > 0 ? Math.max(1, Math.floor(duration / maxFrames)) : 5;
  const fps = `1/${interval}`;

  try {
    execSync(
      `ffmpeg -i "${resolved}" -vf "fps=${fps},scale=1280:-1" -frames:v ${maxFrames} "${tmpDir}/frame%03d.jpg" -y -loglevel quiet`,
      { timeout: 30000 }
    );
  } catch (err) {
    await fs.remove(tmpDir);
    throw new Error(`Failed to extract frames: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Load extracted frames
  const frameFiles = (await fs.readdir(tmpDir))
    .filter(f => f.endsWith(".jpg"))
    .sort()
    .slice(0, maxFrames);

  const frames: ImageAttachment[] = [];
  for (let i = 0; i < frameFiles.length; i++) {
    const framePath = path.join(tmpDir, frameFiles[i]);
    const buffer = await fs.readFile(framePath);
    frames.push({
      type: "base64",
      data: buffer.toString("base64"),
      mediaType: "image/jpeg",
      source: `${path.basename(resolved)} — frame ${i + 1}/${frameFiles.length} (${Math.round((i / frameFiles.length) * duration)}s)`,
    });
  }

  // Cleanup temp frames
  await fs.remove(tmpDir);

  return { source: resolved, frames, duration, frameCount: frames.length };
}
