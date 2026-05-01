import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { DownloadProgress, DownloadTarget } from "../types";

type Aria2Status = "active" | "waiting" | "paused" | "error" | "complete" | "removed";

type DownloadProgressHandler = (progress: DownloadProgress) => void;

interface Aria2TellStatus {
  status: Aria2Status;
  errorMessage?: string;
  totalLength?: string;
  completedLength?: string;
  downloadSpeed?: string;
}

interface Aria2Response<T> {
  id: string;
  jsonrpc: string;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

export class Aria2Service {
  private readonly rpcUrl = process.env.ARIA2_RPC_URL;
  private readonly secret = process.env.ARIA2_RPC_SECRET;
  private readonly pollIntervalMs = readPositiveInteger(process.env.ARIA2_POLL_INTERVAL_MS, 2000, 250);
  private readonly rpcRequestTimeoutMs = readPositiveInteger(
    process.env.ARIA2_RPC_TIMEOUT_MS,
    15000,
    1000
  );
  private readonly noProgressTimeoutMs = readPositiveInteger(
    process.env.ARIA2_DOWNLOAD_TIMEOUT_MS,
    30 * 60 * 1000,
    0
  );
  private readonly statusPollRetryAttempts = readPositiveInteger(
    process.env.ARIA2_STATUS_POLL_RETRY_ATTEMPTS,
    3,
    1
  );
  private readonly statusPollRetryDelayMs = readPositiveInteger(
    process.env.ARIA2_STATUS_POLL_RETRY_DELAY_MS,
    1000,
    0
  );

  async addDownloads(downloads: DownloadTarget[]): Promise<string[]> {
    if (!this.rpcUrl) {
      const gids = downloads.map((_, index) => `mock-gid-${Date.now()}-${index}`);
      for (const download of downloads) {
        console.log(`[Aria2Service] mock addUri: ${download.url} -> ${download.outputPath}`);
      }
      return gids;
    }

    const gids: string[] = [];

    for (const download of downloads) {
      await mkdir(download.dir, { recursive: true });
      console.log(`[Aria2Service] addUri: ${download.url} -> ${download.outputPath}`);
      const gid = await this.call<string>("aria2.addUri", [
        [download.url],
        {
          dir: download.dir,
          out: download.out,
          continue: true,
          ...(download.headers ? { header: download.headers } : {}),
          ...(download.aria2Options || {})
        }
      ]);
      gids.push(gid);
    }

    return gids;
  }

  async waitForDownloads(
    gids: string[],
    downloads: DownloadTarget[],
    onProgress?: DownloadProgressHandler
  ): Promise<string[]> {
    if (!this.rpcUrl) {
      for (const download of downloads) {
        await mkdir(download.dir, { recursive: true });
        if (download.url.startsWith("file:///")) {
          const sourcePath = fileURLToPath(download.url);
          await copyFile(sourcePath, download.outputPath);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      gids.forEach((gid, index) => {
        const download = downloads[index];
        if (!download) {
          return;
        }

        onProgress?.({
          gid,
          sourcePath: download.sourcePath,
          outputPath: download.outputPath,
          status: "complete",
          totalLength: 0,
          completedLength: 0,
          downloadSpeed: 0,
          progress: 100
        });
      });
      console.log(`[Aria2Service] mock downloads completed: ${gids.join(", ")}`);
      await this.validateDownloads(downloads);
      return downloads.map((download) => download.outputPath);
    }

    const pending = new Set(gids);
    const lastCompletedLengthByGid = new Map(gids.map((gid) => [gid, 0]));
    let lastProgressAt = Date.now();

    while (pending.size > 0) {
      for (const gid of Array.from(pending)) {
        const status = await this.tellStatusWithRetry(gid);
        if (!status) {
          continue;
        }

        console.log(`[Aria2Service] gid ${gid} status: ${status.status}`);
        const download = downloads[gids.indexOf(gid)];
        if (download) {
          onProgress?.(
            createDownloadProgress(gid, download, {
              status: status.status,
              errorMessage: status.errorMessage,
              totalLength: status.totalLength,
              completedLength: status.completedLength,
              downloadSpeed: status.downloadSpeed
            })
          );
        }

        if (hasDownloadActivity(status, lastCompletedLengthByGid.get(gid) || 0)) {
          lastProgressAt = Date.now();
        }
        lastCompletedLengthByGid.set(gid, Number(status.completedLength || 0));

        if (status.status === "complete") {
          pending.delete(gid);
          continue;
        }

        if (status.status === "error" || status.status === "removed") {
          throw new Error(`Aria2 download failed: ${gid} ${status.errorMessage || status.status}`);
        }
      }

      if (
        this.noProgressTimeoutMs > 0 &&
        pending.size > 0 &&
        Date.now() - lastProgressAt > this.noProgressTimeoutMs
      ) {
        throw new Error(
          `Aria2 download stalled for ${formatDuration(this.noProgressTimeoutMs)}: ${Array.from(pending).join(", ")}`
        );
      }

      if (pending.size > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      }
    }

    await this.validateDownloads(downloads);
    return downloads.map((download) => download.outputPath);
  }

  async cancelDownloads(gids: string[]): Promise<void> {
    if (!this.rpcUrl || gids.length === 0) {
      return;
    }

    await Promise.all(
      gids.map(async (gid) => {
        try {
          await this.call<string>("aria2.remove", [gid]);
        } catch (error) {
          const message = formatError(error);
          if (!/not found|not active|already/i.test(message)) {
            await this.call<string>("aria2.forceRemove", [gid]);
          }
        }
      })
    );
  }

  private async validateDownloads(downloads: DownloadTarget[]): Promise<void> {
    for (const download of downloads) {
      await validateDownloadedFile(download);
    }
  }

  private async tellStatusWithRetry(gid: string): Promise<Aria2TellStatus | null> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.statusPollRetryAttempts; attempt += 1) {
      try {
        return await this.call<Aria2TellStatus>(
          "aria2.tellStatus",
          [gid, ["status", "errorMessage", "totalLength", "completedLength", "downloadSpeed"]]
        );
      } catch (error) {
        lastError = error;
        if (attempt < this.statusPollRetryAttempts && this.statusPollRetryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.statusPollRetryDelayMs));
        }
      }
    }

    console.log(
      `[Aria2Service] gid ${gid} status poll failed after ${this.statusPollRetryAttempts} attempts: ${formatError(lastError)}`
    );
    return null;
  }

  private async call<T>(method: string, params: unknown[]): Promise<T> {
    if (!this.rpcUrl) {
      throw new Error("ARIA2_RPC_URL is not configured");
    }

    const rpcParams = this.secret ? [`token:${this.secret}`, ...params] : params;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.rpcRequestTimeoutMs);
    let response: Response;

    try {
      response = await fetch(this.rpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `${Date.now()}-${Math.random()}`,
          method,
          params: rpcParams
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const body = (await response.json()) as Aria2Response<T>;

    if (!response.ok || body.error) {
      throw new Error(body.error?.message || response.statusText);
    }

    if (body.result === undefined) {
      throw new Error(`Aria2 ${method} returned empty result`);
    }

    return body.result;
  }
}

async function validateDownloadedFile(download: DownloadTarget): Promise<void> {
  let fileStat;
  try {
    fileStat = await stat(download.outputPath);
  } catch {
    throw new Error(`Downloaded file is missing: ${download.outputPath}`);
  }

  const actualSize = fileStat.size;
  const expectedSize = Number(download.expectedSize || 0);

  if (expectedSize > 0 && actualSize < expectedSize * 0.95) {
    throw new Error(
      `Downloaded file is too small for ${download.sourcePath}: expected ${formatBytes(expectedSize)}, got ${formatBytes(actualSize)}`
    );
  }

  if (actualSize <= 64 * 1024) {
    const preview = await readSmallText(download.outputPath);
    const errorMessage = detectErrorResponse(preview);
    if (errorMessage) {
      throw new Error(`Downloaded file is an error response for ${download.sourcePath}: ${errorMessage}`);
    }
  }
}

async function readSmallText(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return buffer.subarray(0, 4096).toString("utf8").trim();
}

function detectErrorResponse(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return "server returned an HTML page instead of media";
  }

  if (/^[{[]/.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed) as {
        code?: unknown;
        state?: unknown;
        message?: unknown;
        msg?: unknown;
        error?: unknown;
      };
      const message = String(parsed.message || parsed.msg || parsed.error || "unknown error");
      const code = Number(parsed.code || 0);

      if (code >= 400 || parsed.state === false || parsed.message || parsed.msg || parsed.error) {
        return message;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function createDownloadProgress(
  gid: string,
  download: DownloadTarget,
  status: {
    status: string;
    errorMessage?: string;
    totalLength?: string;
    completedLength?: string;
    downloadSpeed?: string;
  }
): DownloadProgress {
  const totalLength = Number(status.totalLength || 0);
  const completedLength = Number(status.completedLength || 0);
  const downloadSpeed = Number(status.downloadSpeed || 0);
  const progress = totalLength > 0 ? Math.min(100, (completedLength / totalLength) * 100) : 0;

  return {
    gid,
    sourcePath: download.sourcePath,
    outputPath: download.outputPath,
    status: status.status,
    totalLength,
    completedLength,
    downloadSpeed,
    progress,
    errorMessage: status.errorMessage
  };
}

function hasDownloadActivity(status: Aria2TellStatus, previousCompletedLength: number): boolean {
  if (status.status === "complete" || status.status === "waiting" || status.status === "paused") {
    return true;
  }

  const completedLength = Number(status.completedLength || 0);
  const downloadSpeed = Number(status.downloadSpeed || 0);

  return completedLength > previousCompletedLength || downloadSpeed > 0;
}

function readPositiveInteger(value: string | undefined, fallback: number, minimum: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, parsed);
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}
