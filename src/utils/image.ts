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
