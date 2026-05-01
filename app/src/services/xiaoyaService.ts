import * as path from "node:path";
import {
  classifyResourceType,
  createStableResourceId,
  getOpenListName,
  getOpenListParent,
  joinOpenListPath,
  normalizeOpenListPath
} from "../utils/files";
import type { DownloadTarget, OpenListResource } from "../types";

interface AListResponse<T> {
  code?: number;
  message?: string;
  data?: T;
}

interface AListFileInfo {
  raw_url?: string;
  size?: number | string;
}

interface AListListData {
  content?: AListListItem[];
}

interface AListListItem {
  name?: string;
  size?: number | string;
  is_dir?: boolean;
}

interface XiaoyaSearchAnchor {
  href: string;
  label: string;
}

export class XiaoyaService {
  private readonly baseUrl = process.env.XIAOYA_BASE_URL?.replace(/\/+$/, "");
  private readonly sourceName = process.env.XIAOYA_SOURCE_NAME || "小雅AList";
  private readonly searchType = process.env.XIAOYA_SEARCH_TYPE || "video";
  private readonly maxResults = Number(process.env.XIAOYA_MAX_RESULTS || 300);
  private readonly authMode = process.env.XIAOYA_AUTH_MODE || "none";
  private readonly username = process.env.XIAOYA_USERNAME;
  private readonly password = process.env.XIAOYA_PASSWORD;
  private readonly pathPassword = process.env.XIAOYA_PATH_PASSWORD || "";
  private readonly shouldLookupFileSizes =
    (process.env.XIAOYA_LOOKUP_FILE_SIZE || "false").toLowerCase() === "true";
  private readonly sizeLookupConcurrency = readPositiveInteger(
    process.env.XIAOYA_SIZE_LOOKUP_CONCURRENCY,
    6,
    1
  );
  private readonly sizeLookupTimeoutMs = readPositiveInteger(
    process.env.XIAOYA_SIZE_LOOKUP_TIMEOUT_MS,
    5000,
    1000
  );
  private readonly downloadLinkTimeoutMs = readPositiveInteger(
    process.env.XIAOYA_DOWNLOAD_LINK_TIMEOUT_MS,
    30000,
    1000
  );
  private readonly downloadLinkConcurrency = readPositiveInteger(
    process.env.XIAOYA_DOWNLOAD_LINK_CONCURRENCY,
    1,
    1
  );
  private readonly folderScanMaxDepth = readPositiveInteger(
    process.env.XIAOYA_FOLDER_SCAN_MAX_DEPTH,
    4,
    0
  );
  private readonly folderScanMaxItems = readPositiveInteger(
    process.env.XIAOYA_FOLDER_SCAN_MAX_ITEMS,
    1200,
    1
  );
  private readonly folderExpansionMaxFolders = readPositiveInteger(
    process.env.XIAOYA_FOLDER_EXPANSION_MAX_FOLDERS,
    20,
    1
  );
  private readonly downloadRoot = path.resolve(
    process.env.ARIA2_DOWNLOAD_DIR || path.join(process.cwd(), "downloads")
  );

  isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  async searchAll(keyword: string): Promise<OpenListResource[]> {
    const normalizedKeyword = keyword.trim();

    if (!normalizedKeyword) {
      console.log("[XiaoyaService] empty keyword, returning []");
      return [];
    }

    if (!this.baseUrl) {
      console.log("[XiaoyaService] XIAOYA_BASE_URL is not configured, returning []");
      return [];
    }

    const searchUrl = new URL("/search", `${this.baseUrl}/`);
    searchUrl.searchParams.set("box", normalizedKeyword);
    searchUrl.searchParams.set("url", "");
    searchUrl.searchParams.set("type", this.searchType);

    console.log(`[XiaoyaService] searching resources, keyword="${normalizedKeyword}"`);
    const response = await fetch(searchUrl, {
      headers: this.createFetchHeaders()
    });

    if (!response.ok) {
      throw new Error(`XiaoYa search failed: HTTP ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const resources = await this.enrichResourceSizes(await this.parseSearchHtml(html));

    console.log(`[XiaoyaService] found ${resources.length} video/subtitle resources`);
    for (const resource of resources) {
      console.log(
        `[XiaoyaService] resource: ${resource.name} / ${resource.size || "unknown"} bytes / ${resource.source}`
      );
    }

    return resources;
  }

  async verifyMe(): Promise<unknown> {
    if (!this.baseUrl) {
      throw new Error("XIAOYA_BASE_URL is not configured");
    }

    const response = await fetch(`${this.baseUrl}/api/me`, {
      headers: this.createFetchHeaders()
    });
    const body = (await response.json()) as AListResponse<unknown>;

    if (!response.ok || body.code !== 200 || !body.data) {
      throw new Error(`XiaoYa /api/me failed: ${body.message || response.statusText}`);
    }

    return body.data;
  }

  async createDownloadTargets(resources: OpenListResource[]): Promise<DownloadTarget[]> {
    if (!this.baseUrl) {
      throw new Error("XIAOYA_BASE_URL is not configured");
    }

    const headers = this.createAria2Headers();

    return mapWithConcurrency(resources, this.downloadLinkConcurrency, async (resource) => {
      const output = this.createDownloadOutput(resource.path);
      const fileInfo = await this.fetchFileInfo(resource.path, this.downloadLinkTimeoutMs);
      const url = this.resolveRawDownloadUrl(fileInfo.raw_url, resource.path);
      const expectedSize = toPositiveFileSize(fileInfo.size) || resource.size || undefined;

      console.log(`[XiaoyaService] direct download link ready: ${resource.path} -> ${url}`);
      return {
        sourcePath: resource.path,
        url,
        outputPath: output.outputPath,
        dir: output.dir,
        out: output.out,
        expectedSize,
        headers: headers.length > 0 ? headers : undefined
      };
    });
  }

  private async parseSearchHtml(html: string): Promise<OpenListResource[]> {
    const resources = new Map<string, OpenListResource>();
    const folders: { path: string; name: string }[] = [];

    for (const anchor of parseAnchors(html)) {
      const href = decodeHtmlEntity(anchor.href).trim();
      const label = stripHtml(decodeHtmlEntity(anchor.label)).trim();
      const resource = this.mapAnchorToResource(href, label);

      if (resource) {
        resources.set(resource.id, resource);
      } else {
        const folder = this.mapAnchorToFolder(href, label);
        if (folder && !folders.some((item) => item.path === folder.path)) {
          folders.push(folder);
        }
      }

      if (resources.size >= this.maxResults) {
        break;
      }
    }

    for (const folder of folders.slice(0, this.folderExpansionMaxFolders)) {
      if (resources.size >= this.maxResults) {
        break;
      }

      const folderResources = await this.listFolderResources(folder.path, folder.path, folder.name);
      for (const resource of folderResources) {
        resources.set(resource.id, resource);
        if (resources.size >= this.maxResults) {
          break;
        }
      }
    }

    return Array.from(resources.values());
  }

  private mapAnchorToResource(href: string, label: string): OpenListResource | null {
    if (!this.baseUrl || !href || href === "/" || href.startsWith("#")) {
      return null;
    }

    let url: URL;
    try {
      url = new URL(href, `${this.baseUrl}/`);
    } catch {
      return null;
    }

    if (url.origin !== new URL(this.baseUrl).origin) {
      return null;
    }

    let resourcePath = url.pathname;
    if (resourcePath.startsWith("/d/")) {
      resourcePath = resourcePath.slice("/d".length);
    }

    resourcePath = normalizeOpenListPath(safeDecodeURIComponent(resourcePath));
    const displayPath = label ? normalizeOpenListPath(label) : resourcePath;
    const name = getOpenListName(displayPath || resourcePath);
    const type = classifyResourceType(name);

    if (!type) {
      return null;
    }

    const parentFolder = getOpenListParent(resourcePath);
    const source = this.createSourceName(resourcePath);

    return {
      id: createStableResourceId(source, resourcePath),
      name,
      size: 0,
      path: resourcePath,
      source,
      type,
      parentFolder,
      collectionFolder: parentFolder,
      collectionName: getOpenListName(parentFolder),
      provider: "xiaoya"
    };
  }

  private mapAnchorToFolder(href: string, label: string): { path: string; name: string } | null {
    if (!this.baseUrl || !href || href === "/" || href.startsWith("#")) {
      return null;
    }

    let url: URL;
    try {
      url = new URL(href, `${this.baseUrl}/`);
    } catch {
      return null;
    }

    if (url.origin !== new URL(this.baseUrl).origin) {
      return null;
    }

    let folderPath = url.pathname;
    if (folderPath.startsWith("/d/")) {
      folderPath = folderPath.slice("/d".length);
    }

    folderPath = normalizeOpenListPath(safeDecodeURIComponent(folderPath));
    const displayPath = label ? normalizeOpenListPath(label) : folderPath;
    const name = getOpenListName(displayPath || folderPath);

    if (!name || classifyResourceType(name)) {
      return null;
    }

    return {
      path: folderPath,
      name
    };
  }

  private async listFolderResources(
    folderPath: string,
    collectionFolder: string,
    collectionName: string,
    depth = 0,
    scanned = { count: 0 }
  ): Promise<OpenListResource[]> {
    if (depth > this.folderScanMaxDepth || scanned.count >= this.folderScanMaxItems) {
      return [];
    }

    const body = await this.fetchFolderList(folderPath).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[XiaoyaService] skip folder expansion ${folderPath}: ${message}`);
      return null;
    });

    const items = body?.data?.content || [];
    const resources: OpenListResource[] = [];

    for (const item of items) {
      if (scanned.count >= this.folderScanMaxItems || !item.name) {
        break;
      }
      scanned.count += 1;

      const itemPath = joinOpenListPath(folderPath, item.name);

      if (item.is_dir) {
        resources.push(
          ...(await this.listFolderResources(
            itemPath,
            collectionFolder,
            collectionName,
            depth + 1,
            scanned
          ))
        );
        continue;
      }

      const type = classifyResourceType(item.name);
      if (!type) {
        continue;
      }

      const parentFolder = normalizeOpenListPath(folderPath);
      const source = this.createSourceName(itemPath);

      resources.push({
        id: createStableResourceId(source, itemPath),
        name: item.name,
        size: Number(item.size || 0),
        path: itemPath,
        source,
        type,
        parentFolder,
        collectionFolder,
        collectionName,
        provider: "xiaoya"
      });
    }

    return resources;
  }

  private async fetchFolderList(folderPath: string): Promise<AListResponse<AListListData>> {
    if (!this.baseUrl) {
      throw new Error("XIAOYA_BASE_URL is not configured");
    }

    const headers = new Headers(this.createFetchHeaders());
    headers.set("Content-Type", "application/json");

    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/fs/list`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        path: normalizeOpenListPath(folderPath),
        password: this.pathPassword,
        page: 1,
        per_page: this.folderScanMaxItems,
        refresh: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as AListResponse<AListListData>;
    if (body.code !== 200) {
      throw new Error(body.message || "XiaoYa list failed");
    }

    return body;
  }

  private async enrichResourceSizes(resources: OpenListResource[]): Promise<OpenListResource[]> {
    if (!this.shouldLookupFileSizes || resources.length === 0) {
      return resources;
    }

    return mapWithConcurrency(resources, this.sizeLookupConcurrency, async (resource) => {
      if (resource.size > 0) {
        return resource;
      }

      const size = await this.lookupResourceSize(resource.path);
      return size > 0 ? { ...resource, size } : resource;
    });
  }

  private async lookupResourceSize(resourcePath: string): Promise<number> {
    const metadataSize = await this.fetchMetadataSize(resourcePath).catch(() => 0);
    if (metadataSize > 0) {
      return metadataSize;
    }

    return this.fetchDownloadHeaderSize(resourcePath).catch(() => 0);
  }

  private async fetchMetadataSize(resourcePath: string): Promise<number> {
    const body = await this.fetchFileInfo(resourcePath, this.sizeLookupTimeoutMs);
    return toPositiveFileSize(body.size);
  }

  private async fetchFileInfo(resourcePath: string, timeoutMs: number): Promise<AListFileInfo> {
    if (!this.baseUrl) {
      throw new Error("XIAOYA_BASE_URL is not configured");
    }

    const headers = new Headers(this.createFetchHeaders());
    headers.set("Content-Type", "application/json");

    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/fs/get`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          path: normalizeOpenListPath(resourcePath),
          password: this.pathPassword
        })
      },
      timeoutMs
    );

    if (!response.ok) {
      throw new Error(`XiaoYa get file failed for ${getOpenListName(resourcePath)}: HTTP ${response.status}`);
    }

    const body = (await response.json()) as AListResponse<AListFileInfo>;
    if (body.code !== 200) {
      throw new Error(`XiaoYa get file failed for ${getOpenListName(resourcePath)}: ${body.message || "unknown error"}`);
    }

    return body.data || {};
  }

  private async fetchDownloadHeaderSize(resourcePath: string): Promise<number> {
    const url = this.createDownloadUrl(resourcePath);
    let size = 0;

    try {
      const headHeaders = new Headers(this.createFetchHeaders());
      const headResponse = await this.fetchWithTimeout(url, {
        method: "HEAD",
        headers: headHeaders
      });
      size = getResponseFileSize(headResponse.headers);
      await headResponse.body?.cancel();
    } catch {
      size = 0;
    }

    if (size > 0) {
      return size;
    }

    try {
      const rangeHeaders = new Headers(this.createFetchHeaders());
      rangeHeaders.set("Range", "bytes=0-0");
      const rangeResponse = await this.fetchWithTimeout(url, {
        method: "GET",
        headers: rangeHeaders
      });
      size = getResponseFileSize(rangeResponse.headers);
      await rangeResponse.body?.cancel();
    } catch {
      size = 0;
    }

    return size;
  }

  private async fetchWithTimeout(
    input: string,
    init: RequestInit,
    timeoutMs = this.sizeLookupTimeoutMs
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(input, {
        ...init,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private createDownloadUrl(resourcePath: string): string {
    if (!this.baseUrl) {
      throw new Error("XIAOYA_BASE_URL is not configured");
    }

    const relativePath = normalizeOpenListPath(resourcePath).replace(/^\/+/, "");
    const encodedPath = relativePath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");

    return `${this.baseUrl}/d/${encodedPath}`;
  }

  private resolveRawDownloadUrl(rawUrl: string | undefined, resourcePath: string): string {
    if (!this.baseUrl) {
      throw new Error("XIAOYA_BASE_URL is not configured");
    }

    if (!rawUrl) {
      throw new Error(`XiaoYa download link is empty for ${getOpenListName(resourcePath)}`);
    }

    if (/^https?:\/\//i.test(rawUrl)) {
      return rawUrl;
    }

    return `${this.baseUrl}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
  }

  private createDownloadOutput(sourcePath: string): { outputPath: string; dir: string; out: string } {
    const relativePath = normalizeOpenListPath(sourcePath).replace(/^\/+/, "");
    const segments = relativePath.split("/").filter(Boolean).map(sanitizeLocalPathSegment);
    const out = segments.pop() || sanitizeLocalPathSegment(path.basename(sourcePath) || "media");
    const dir = path.join(this.downloadRoot, "xiaoya", ...segments);

    return {
      outputPath: path.join(dir, out),
      dir,
      out
    };
  }

  private createSourceName(resourcePath: string): string {
    const firstSegment = normalizeOpenListPath(resourcePath).split("/").filter(Boolean)[0];
    return firstSegment ? `${this.sourceName}/${firstSegment}` : this.sourceName;
  }

  private createFetchHeaders(): HeadersInit {
    const headers: Record<string, string> = {};

    if (this.authMode === "basic") {
      headers.Authorization = this.createBasicAuthHeader();
    }

    return headers;
  }

  private createAria2Headers(): string[] {
    if (this.authMode !== "basic") {
      return [];
    }

    return [`Authorization: ${this.createBasicAuthHeader()}`];
  }

  private createBasicAuthHeader(): string {
    if (!this.username || !this.password) {
      throw new Error("XIAOYA_USERNAME and XIAOYA_PASSWORD are required when XIAOYA_AUTH_MODE=basic");
    }

    return `Basic ${Buffer.from(`${this.username}:${this.password}`, "utf8").toString("base64")}`;
  }
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function parseAnchors(html: string): XiaoyaSearchAnchor[] {
  const anchors: XiaoyaSearchAnchor[] = [];
  const anchorPattern = /<a\s+href=(?:"([^"]+)"|([^>\s]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    anchors.push({
      href: match[1] || match[2] || "",
      label: match[3] || ""
    });
  }

  return anchors;
}

function decodeHtmlEntity(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizeLocalPathSegment(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  return sanitized || "unnamed";
}

function toPositiveFileSize(value: unknown): number {
  const size = Number(value || 0);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

function getResponseFileSize(headers: Headers): number {
  const contentRange = headers.get("content-range");
  const totalFromRange = contentRange?.match(/\/(\d+)\s*$/)?.[1];
  const rangeSize = toPositiveFileSize(totalFromRange);

  if (rangeSize > 0) {
    return rangeSize;
  }

  return toPositiveFileSize(headers.get("content-length"));
}

function readPositiveInteger(value: string | undefined, fallback: number, minimum: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, parsed);
}

async function mapWithConcurrency<T, U = T>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index], index);
      }
    })
  );

  return results;
}
