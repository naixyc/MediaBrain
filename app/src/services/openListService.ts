import { readdir, stat } from "node:fs/promises";
import * as path from "node:path";
import {
  classifyResourceType,
  createStableResourceId,
  getOpenListSource,
  joinOpenListPath,
  normalizeOpenListPath
} from "../utils/files";
import type { OpenListResource } from "../types";
import { OpenListClient } from "./openListClient";

interface OpenListSearchResponse {
  code?: number;
  message?: string;
  data?: {
    content?: OpenListSearchItem[];
    total?: number;
  };
}

interface OpenListListResponse {
  code?: number;
  message?: string;
  data?: {
    content?: OpenListSearchItem[];
    total?: number;
  };
}

interface OpenListSearchItem {
  name?: string;
  size?: number;
  is_dir?: boolean;
  parent?: string;
  path?: string;
}

export class OpenListService {
  private readonly baseUrl = process.env.OPENLIST_BASE_URL?.replace(/\/+$/, "");
  private readonly client = this.baseUrl ? new OpenListClient(this.baseUrl) : null;
  private readonly searchParent = process.env.OPENLIST_SEARCH_PARENT || "/";
  private readonly pathPassword = process.env.OPENLIST_PATH_PASSWORD || "";
  private readonly pageSize = Number(process.env.OPENLIST_PAGE_SIZE || 100);
  private readonly scanMaxDepth = Number(process.env.OPENLIST_SCAN_MAX_DEPTH || 4);
  private readonly scanMaxItems = Number(process.env.OPENLIST_SCAN_MAX_ITEMS || 5000);
  private readonly fallbackSource = process.env.OPENLIST_SOURCE_NAME || "OpenList";
  private readonly mockRoot = process.env.OPENLIST_MOCK_ROOT;

  async searchAll(keyword: string): Promise<OpenListResource[]> {
    const normalizedKeyword = keyword.trim();

    if (!normalizedKeyword) {
      console.log("[OpenListService] empty keyword, returning []");
      return [];
    }

    console.log(`[OpenListService] searching resources, keyword="${normalizedKeyword}"`);

    const matchedResources = this.baseUrl
      ? await this.searchRemoteOpenList(normalizedKeyword)
      : await this.searchLocalMockRoot(normalizedKeyword);
    const resources = await this.enrichWithFolderResources(matchedResources);

    console.log(`[OpenListService] found ${resources.length} video/subtitle resources`);
    for (const resource of resources) {
      console.log(
        `[OpenListService] resource: ${resource.name} / ${resource.size} bytes / ${resource.source}`
      );
    }

    return resources;
  }

  async verifyMe(): Promise<unknown> {
    if (!this.client) {
      throw new Error("OPENLIST_BASE_URL is not configured");
    }

    return this.client.verifyMe();
  }

  private async searchRemoteOpenList(keyword: string): Promise<OpenListResource[]> {
    if (!this.client) {
      return [];
    }

    const results: OpenListResource[] = [];
    let page = 1;

    while (true) {
      const payload = {
        parent: this.searchParent,
        keywords: keyword,
        scope: 2,
        page,
        per_page: this.pageSize,
        password: this.pathPassword
      };

      const body = await this.client.post<OpenListSearchResponse["data"]>("/api/fs/search", payload);

      if (body.code !== 200) {
        if (/search not available/i.test(body.message || "")) {
          console.log("[OpenListService] /api/fs/search is not available, falling back to recursive /api/fs/list scan");
          return this.searchRemoteByListing(keyword);
        }

        throw new Error(`OpenList search failed: ${body.message || "unknown error"}`);
      }

      const content = body.data?.content ?? [];
      results.push(...content.flatMap((item) => this.mapOpenListItem(item)));

      const total = body.data?.total ?? 0;
      const loaded = page * this.pageSize;
      if (content.length === 0 || (total > 0 && loaded >= total)) {
        break;
      }

      page += 1;
    }

    return results;
  }

  private async listRemoteFolder(parentFolder: string): Promise<OpenListResource[]> {
    const content = await this.listRemoteFolderItems(parentFolder);
    return content.flatMap((item) => this.mapOpenListItem(item, parentFolder));
  }

  private async listRemoteFolderItems(parentFolder: string): Promise<OpenListSearchItem[]> {
    if (!this.client) {
      return [];
    }

    const results: OpenListSearchItem[] = [];
    let page = 1;

    while (true) {
      const body = await this.client.post<OpenListListResponse["data"]>("/api/fs/list", {
        path: parentFolder,
        password: this.pathPassword,
        page,
        per_page: this.pageSize,
        refresh: false
      });

      if (body.code !== 200) {
        throw new Error(`OpenList list failed for ${parentFolder}: ${body.message || "unknown error"}`);
      }

      const content = body.data?.content ?? [];
      results.push(...content);

      const total = body.data?.total ?? 0;
      const loaded = page * this.pageSize;
      if (content.length === 0 || (total > 0 && loaded >= total)) {
        break;
      }

      page += 1;
    }

    return results;
  }

  private async searchRemoteByListing(keyword: string): Promise<OpenListResource[]> {
    const normalizedKeyword = keyword.toLowerCase();
    const results = new Map<string, OpenListResource>();
    const queue: Array<{ folder: string; depth: number; parentMatched: boolean }> = [
      {
        folder: normalizeOpenListPath(this.searchParent),
        depth: 0,
        parentMatched: false
      }
    ];
    let scannedItems = 0;

    while (queue.length > 0 && scannedItems < this.scanMaxItems) {
      const current = queue.shift();
      if (!current) {
        break;
      }

      let items: OpenListSearchItem[];
      try {
        items = await this.listRemoteFolderItems(current.folder);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`[OpenListService] skip folder ${current.folder}: ${message}`);
        continue;
      }

      scannedItems += items.length;

      for (const item of items) {
        if (!item.name) {
          continue;
        }

        const itemPath = normalizeOpenListPath(item.path || joinOpenListPath(current.folder, item.name));
        const itemMatched = item.name.toLowerCase().includes(normalizedKeyword);

        if (item.is_dir) {
          if (current.depth < this.scanMaxDepth) {
            queue.push({
              folder: itemPath,
              depth: current.depth + 1,
              parentMatched: current.parentMatched || itemMatched
            });
          }
          continue;
        }

        const shouldInclude = current.parentMatched || itemMatched;
        if (!shouldInclude) {
          continue;
        }

        const mapped = this.mapOpenListItem(
          {
            ...item,
            path: itemPath,
            parent: current.folder
          },
          current.folder
        );

        for (const resource of mapped) {
          results.set(resource.id, resource);
        }
      }
    }

    console.log(
      `[OpenListService] recursive list scan checked ${scannedItems} items, matched ${results.size} resources`
    );

    return Array.from(results.values());
  }

  private async searchLocalMockRoot(keyword: string): Promise<OpenListResource[]> {
    if (!this.mockRoot) {
      console.log(
        "[OpenListService] OPENLIST_BASE_URL and OPENLIST_MOCK_ROOT are not configured, returning []"
      );
      return [];
    }

    const root = path.resolve(this.mockRoot);
    const resources: OpenListResource[] = [];
    await this.walkLocalDirectory(root, keyword.toLowerCase(), resources);
    return resources;
  }

  private async walkLocalDirectory(
    currentDirectory: string,
    keyword: string,
    resources: OpenListResource[]
  ): Promise<void> {
    const entries = await readdir(currentDirectory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        await this.walkLocalDirectory(absolutePath, keyword, resources);
        continue;
      }

      const type = classifyResourceType(entry.name);
      if (!type || !entry.name.toLowerCase().includes(keyword)) {
        continue;
      }

      const fileStat = await stat(absolutePath);
      const parentFolder = path.dirname(absolutePath);
      const filePath = absolutePath;
      const source = this.fallbackSource;

      resources.push({
        id: createStableResourceId(source, filePath),
        name: entry.name,
        size: fileStat.size,
        path: filePath,
        source,
        type,
        parentFolder,
        collectionFolder: parentFolder,
        collectionName: path.basename(parentFolder),
        provider: "local"
      });
    }
  }

  private async listLocalFolder(parentFolder: string): Promise<OpenListResource[]> {
    const resources: OpenListResource[] = [];
    const entries = await readdir(parentFolder, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        continue;
      }

      const type = classifyResourceType(entry.name);
      if (!type) {
        continue;
      }

      const absolutePath = path.join(parentFolder, entry.name);
      const fileStat = await stat(absolutePath);
      const source = this.fallbackSource;

      resources.push({
        id: createStableResourceId(source, absolutePath),
        name: entry.name,
        size: fileStat.size,
        path: absolutePath,
        source,
        type,
        parentFolder,
        collectionFolder: parentFolder,
        collectionName: path.basename(parentFolder),
        provider: "local"
      });
    }

    return resources;
  }

  private async enrichWithFolderResources(resources: OpenListResource[]): Promise<OpenListResource[]> {
    if (resources.length === 0) {
      return resources;
    }

    const resourceMap = new Map<string, OpenListResource>();
    const parents = new Set(resources.map((resource) => resource.parentFolder));
    const matchedVideoIds = new Set(
      resources.filter((resource) => resource.type === "video").map((resource) => resource.id)
    );
    const parentsWithMatchedVideos = new Set(
      resources.filter((resource) => resource.type === "video").map((resource) => resource.parentFolder)
    );

    for (const resource of resources) {
      resourceMap.set(resource.id, resource);
    }

    for (const parent of parents) {
      let folderResources: OpenListResource[];
      try {
        folderResources = this.client
          ? await this.listRemoteFolder(parent)
          : await this.listLocalFolder(parent);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`[OpenListService] skip subtitle enrichment for ${parent}: ${message}`);
        continue;
      }

      for (const folderResource of folderResources) {
        const shouldInclude =
          folderResource.type === "subtitle" ||
          matchedVideoIds.has(folderResource.id) ||
          !parentsWithMatchedVideos.has(parent);

        if (shouldInclude) {
          resourceMap.set(folderResource.id, folderResource);
        }
      }
    }

    return Array.from(resourceMap.values());
  }

  private mapOpenListItem(item: OpenListSearchItem, fallbackParent?: string): OpenListResource[] {
    if (item.is_dir || !item.name) {
      return [];
    }

    const type = classifyResourceType(item.name);
    if (!type) {
      return [];
    }

    const parentFolder = normalizeOpenListPath(item.parent || fallbackParent || this.searchParent);
    const filePath = normalizeOpenListPath(item.path || joinOpenListPath(parentFolder, item.name));
    const source = getOpenListSource(parentFolder, this.fallbackSource);

    return [
      {
        id: createStableResourceId(source, filePath),
        name: item.name,
        size: Number(item.size || 0),
        path: filePath,
        source,
        type,
        parentFolder,
        collectionFolder: parentFolder,
        collectionName: getOpenListSource(parentFolder, this.fallbackSource),
        provider: "openlist"
      }
    ];
  }

}
