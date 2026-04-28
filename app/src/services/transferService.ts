import { copyFile, mkdir } from "node:fs/promises";
import * as path from "node:path";
import {
  getOpenListName,
  getOpenListParent,
  joinOpenListPath,
  normalizeOpenListPath
} from "../utils/files";
import type { DownloadTarget, TransferTarget } from "../types";
import { OpenListClient } from "./openListClient";

interface OpenListMutationResponse {
  code?: number;
  message?: string;
  data?: unknown;
}

interface OpenListGetResponse {
  code?: number;
  message?: string;
  data?: {
    raw_url?: string;
  };
}

interface TransferGroup {
  srcDir: string;
  dstDir: string;
  names: string[];
}

export class TransferService {
  private readonly baseUrl = process.env.OPENLIST_BASE_URL?.replace(/\/+$/, "");
  private readonly client = this.baseUrl ? new OpenListClient(this.baseUrl) : null;
  private readonly pathPassword = process.env.OPENLIST_PATH_PASSWORD || "";
  private readonly openListTargetRoot = process.env.OPENLIST_TRANSFER_TARGET_ROOT || "/MediaBrain/Transfers";
  private readonly localTargetRoot = path.resolve(
    process.env.TRANSFER_TARGET_ROOT || path.join(process.cwd(), "transferred")
  );
  private readonly downloadRoot = path.resolve(
    process.env.ARIA2_DOWNLOAD_DIR || path.join(process.cwd(), "downloads")
  );

  async transferFile(file: TransferTarget): Promise<string> {
    const [targetPath] = await this.transferFiles([file]);
    return targetPath;
  }

  async transferFiles(files: TransferTarget[]): Promise<string[]> {
    if (files.length === 0) {
      return [];
    }

    console.log(`[TransferService] preparing to transfer ${files.length} files`);
    for (const file of files) {
      console.log(`[TransferService] transfer file: ${file.path}`);
    }

    if (this.client) {
      return this.transferOpenListFiles(files);
    }

    return this.transferLocalFiles(files);
  }

  async createDownloadTargets(targetPaths: string[]): Promise<DownloadTarget[]> {
    const targets: DownloadTarget[] = [];

    for (const targetPath of targetPaths) {
      const url = this.client
        ? await this.getOpenListDownloadUrl(targetPath)
        : this.createLocalFileUrl(targetPath);
      const output = this.createDownloadOutput(targetPath);

      console.log(`[TransferService] download link ready: ${targetPath} -> ${url}`);
      targets.push({
        sourcePath: targetPath,
        url,
        outputPath: output.outputPath,
        dir: output.dir,
        out: output.out
      });
    }

    return targets;
  }

  private async transferOpenListFiles(files: TransferTarget[]): Promise<string[]> {
    const groups = new Map<string, TransferGroup>();
    const targetPaths: string[] = [];

    for (const file of files) {
      const srcDir = getOpenListParent(file.path);
      const name = getOpenListName(file.path);
      const dstDir = this.createOpenListTargetDirectory(srcDir);
      const group = groups.get(srcDir) ?? { srcDir, dstDir, names: [] };

      group.names.push(name);
      groups.set(srcDir, group);
      targetPaths.push(joinOpenListPath(dstDir, name));
    }

    for (const group of groups.values()) {
      await this.ensureOpenListDirectory(group.dstDir);
      await this.withRetry(
        () =>
          this.postOpenListMutation("/api/fs/copy", {
            src_dir: group.srcDir,
            dst_dir: group.dstDir,
            names: group.names
          }),
        `OpenList copy ${group.names.join(", ")}`
      );
    }

    console.log(`[TransferService] transfer completed: ${targetPaths.join(", ")}`);
    return targetPaths;
  }

  private async transferLocalFiles(files: TransferTarget[]): Promise<string[]> {
    const targetPaths: string[] = [];

    for (const file of files) {
      const targetPath = this.createLocalTargetPath(file.path);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await this.withRetry(() => copyFile(file.path, targetPath), `local copy ${file.path}`);
      targetPaths.push(targetPath);
    }

    console.log(`[TransferService] transfer completed: ${targetPaths.join(", ")}`);
    return targetPaths;
  }

  private createOpenListTargetDirectory(srcDir: string): string {
    const relativeSourceDirectory = normalizeOpenListPath(srcDir).replace(/^\/+/, "");
    return joinOpenListPath(this.openListTargetRoot, relativeSourceDirectory);
  }

  private createLocalTargetPath(sourcePath: string): string {
    const relativePath = sourcePath
      .replace(/^[a-zA-Z]:[\\/]/, "")
      .replace(/^[/\\]+/, "")
      .replace(/[\\/]+/g, path.sep);

    return path.join(this.localTargetRoot, relativePath);
  }

  private async ensureOpenListDirectory(directory: string): Promise<void> {
    const segments = normalizeOpenListPath(directory).split("/").filter(Boolean);
    let current = "";

    for (const segment of segments) {
      current = joinOpenListPath(current, segment);

      try {
        await this.postOpenListMutation("/api/fs/mkdir", { path: current });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/exist|already/i.test(message)) {
          console.log(`[TransferService] mkdir ${current} failed, copy will still be attempted: ${message}`);
        }
      }
    }
  }

  private async postOpenListMutation(endpoint: string, payload: unknown): Promise<void> {
    if (!this.client) {
      throw new Error("OpenList transfer requires OPENLIST_BASE_URL");
    }

    const body = await this.client.post<OpenListMutationResponse["data"]>(endpoint, payload);

    if (body.code !== 200) {
      throw new Error(body.message || "unknown error");
    }
  }

  private async getOpenListDownloadUrl(filePath: string): Promise<string> {
    if (!this.baseUrl || !this.client) {
      throw new Error("OpenList download link requires OPENLIST_BASE_URL");
    }

    const body = await this.client.post<OpenListGetResponse["data"]>("/api/fs/get", {
      path: filePath,
      password: this.pathPassword
    });

    const rawUrl = body.data?.raw_url;

    if (body.code !== 200 || !rawUrl) {
      throw new Error(`OpenList get download link failed: ${body.message || "empty raw_url"}`);
    }

    if (/^https?:\/\//i.test(rawUrl)) {
      return rawUrl;
    }

    return `${this.baseUrl}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
  }

  private createLocalFileUrl(filePath: string): string {
    const absolutePath = path.resolve(filePath);
    return `file:///${absolutePath.replace(/\\/g, "/")}`;
  }

  private createDownloadOutput(sourcePath: string): { outputPath: string; dir: string; out: string } {
    const relativePath = sourcePath
      .replace(/^[a-zA-Z]:[\\/]/, "")
      .replace(/^[/\\]+/, "")
      .replace(/[\\/]+/g, path.sep);
    const dir = path.join(this.downloadRoot, path.dirname(relativePath));
    const out = path.basename(relativePath);

    return {
      outputPath: path.join(dir, out),
      dir,
      out
    };
  }

  private async withRetry<T>(operation: () => Promise<T>, description: string): Promise<T> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        console.log(`[TransferService] ${description}, attempt ${attempt}/${maxAttempts}`);
        return await operation();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`[TransferService] ${description} failed: ${message}`);

        if (attempt === maxAttempts) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }

    throw new Error(`${description} failed`);
  }
}
