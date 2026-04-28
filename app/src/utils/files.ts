import { createHash } from "node:crypto";
import * as path from "node:path";

export const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".wmv",
  ".flv",
  ".webm",
  ".m4v",
  ".ts",
  ".mpeg",
  ".mpg"
]);

export const SUBTITLE_EXTENSIONS = new Set([
  ".srt",
  ".ass",
  ".ssa",
  ".vtt",
  ".sub"
]);

const SUBTITLE_HINT_TOKENS = new Set([
  "ass",
  "big5",
  "chs",
  "cht",
  "cn",
  "en",
  "eng",
  "english",
  "gb",
  "sc",
  "ssa",
  "srt",
  "sub",
  "subtitle",
  "subtitles",
  "tc",
  "vtt",
  "zh",
  "zhcn",
  "zhtw",
  "chinese"
]);

export function classifyResourceType(fileName: string): "video" | "subtitle" | null {
  const extension = path.extname(fileName).toLowerCase();

  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }

  if (SUBTITLE_EXTENSIONS.has(extension)) {
    return "subtitle";
  }

  return null;
}

export function createStableResourceId(source: string, filePath: string): string {
  return createHash("sha1").update(`${source}:${filePath}`).digest("hex").slice(0, 16);
}

export function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    return "未知";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function normalizeOpenListPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/").replace(/\/+/g, "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export function joinOpenListPath(...parts: string[]): string {
  const joined = parts
    .filter(Boolean)
    .join("/")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/");

  return normalizeOpenListPath(joined);
}

export function getOpenListParent(filePath: string): string {
  const normalized = normalizeOpenListPath(filePath);
  const lastSlash = normalized.lastIndexOf("/");

  if (lastSlash <= 0) {
    return "/";
  }

  return normalized.slice(0, lastSlash);
}

export function getOpenListName(filePath: string): string {
  const normalized = normalizeOpenListPath(filePath);
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function getOpenListSource(parentFolder: string, fallbackSource: string): string {
  const firstSegment = normalizeOpenListPath(parentFolder).split("/").filter(Boolean)[0];
  return firstSegment || fallbackSource;
}

export function areFileNamesSimilar(videoName: string, subtitleName: string): boolean {
  const videoBase = normalizeBaseName(videoName);
  const subtitleBase = normalizeBaseName(subtitleName);

  if (!videoBase || !subtitleBase) {
    return false;
  }

  if (videoBase === subtitleBase || subtitleBase.includes(videoBase) || videoBase.includes(subtitleBase)) {
    return true;
  }

  const videoTokens = tokenizeBaseName(videoName).filter((token) => !SUBTITLE_HINT_TOKENS.has(token));
  const subtitleTokens = tokenizeBaseName(subtitleName).filter((token) => !SUBTITLE_HINT_TOKENS.has(token));

  if (videoTokens.length === 0 || subtitleTokens.length === 0) {
    return false;
  }

  const subtitleTokenSet = new Set(subtitleTokens);
  const matchedTokens = videoTokens.filter((token) => subtitleTokenSet.has(token));
  const score = matchedTokens.length / videoTokens.length;

  return matchedTokens.length >= 2 && score >= 0.5;
}

function normalizeBaseName(fileName: string): string {
  return path
    .basename(fileName, path.extname(fileName))
    .toLowerCase()
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeBaseName(fileName: string): string[] {
  return normalizeBaseName(fileName)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}
