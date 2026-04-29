import { copyFile, mkdir } from "node:fs/promises";
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
  private readonly noProgressTimeoutMs = readPositiveInteger(
    process.env.ARIA2_DOWNLOAD_TIMEOUT_MS,
    30 * 60 * 1000,
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
          ...(download.headers ? { header: download.headers } : {})
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
      return downloads.map((download) => download.outputPath);
    }

    const pending = new Set(gids);
    const lastCompletedLengthByGid = new Map(gids.map((gid) => [gid, 0]));
    let lastProgressAt = Date.now();

    while (pending.size > 0) {
      for (const gid of Array.from(pending)) {
        const status = await this.call<Aria2TellStatus>(
          "aria2.tellStatus",
          [gid, ["status", "errorMessage", "totalLength", "completedLength", "downloadSpeed"]]
        );

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

    return downloads.map((download) => download.outputPath);
  }

  private async call<T>(method: string, params: unknown[]): Promise<T> {
    if (!this.rpcUrl) {
      throw new Error("ARIA2_RPC_URL is not configured");
    }

    const rpcParams = this.secret ? [`token:${this.secret}`, ...params] : params;
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `${Date.now()}-${Math.random()}`,
        method,
        params: rpcParams
      })
    });

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
