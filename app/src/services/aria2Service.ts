import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { DownloadTarget } from "../types";

type Aria2Status = "active" | "waiting" | "paused" | "error" | "complete" | "removed";

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
  private readonly pollIntervalMs = Number(process.env.ARIA2_POLL_INTERVAL_MS || 2000);
  private readonly timeoutMs = Number(process.env.ARIA2_DOWNLOAD_TIMEOUT_MS || 30 * 60 * 1000);

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

  async waitForDownloads(gids: string[], downloads: DownloadTarget[]): Promise<string[]> {
    if (!this.rpcUrl) {
      for (const download of downloads) {
        await mkdir(download.dir, { recursive: true });
        if (download.url.startsWith("file:///")) {
          const sourcePath = fileURLToPath(download.url);
          await copyFile(sourcePath, download.outputPath);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log(`[Aria2Service] mock downloads completed: ${gids.join(", ")}`);
      return downloads.map((download) => download.outputPath);
    }

    const pending = new Set(gids);
    const startedAt = Date.now();

    while (pending.size > 0) {
      if (Date.now() - startedAt > this.timeoutMs) {
        throw new Error(`Aria2 download timeout: ${Array.from(pending).join(", ")}`);
      }

      for (const gid of Array.from(pending)) {
        const status = await this.call<{ status: Aria2Status; errorMessage?: string }>(
          "aria2.tellStatus",
          [gid, ["status", "errorMessage"]]
        );

        console.log(`[Aria2Service] gid ${gid} status: ${status.status}`);

        if (status.status === "complete") {
          pending.delete(gid);
          continue;
        }

        if (status.status === "error" || status.status === "removed") {
          throw new Error(`Aria2 download failed: ${gid} ${status.errorMessage || status.status}`);
        }
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
