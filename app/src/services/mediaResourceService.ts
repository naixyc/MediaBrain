import type { DownloadTarget, OpenListResource } from "../types";
import type { OpenListService } from "./openListService";
import type { XiaoyaService } from "./xiaoyaService";

type SearchProvider = "auto" | "xiaoya" | "openlist" | "hybrid";

export class MediaResourceService {
  private readonly provider = (
    process.env.SEARCH_PROVIDER ||
    process.env.RESOURCE_SEARCH_PROVIDER ||
    "auto"
  ).toLowerCase() as SearchProvider;

  constructor(
    private readonly openListService: OpenListService,
    private readonly xiaoyaService: XiaoyaService
  ) {}

  async searchAll(keyword: string): Promise<OpenListResource[]> {
    const provider = this.resolveProvider();

    if (provider === "xiaoya") {
      return this.xiaoyaService.searchAll(keyword);
    }

    if (provider === "openlist") {
      return this.openListService.searchAll(keyword);
    }

    const [xiaoyaResources, openListResources] = await Promise.all([
      this.xiaoyaService.isConfigured() ? this.xiaoyaService.searchAll(keyword) : Promise.resolve([]),
      this.openListService.searchAll(keyword)
    ]);
    return this.dedupeResources([...xiaoyaResources, ...openListResources]);
  }

  canCreateDirectDownloadTargets(resources: OpenListResource[]): boolean {
    return resources.length > 0 && resources.every((resource) => resource.provider === "xiaoya");
  }

  async createDirectDownloadTargets(resources: OpenListResource[]): Promise<DownloadTarget[]> {
    if (!this.canCreateDirectDownloadTargets(resources)) {
      throw new Error("direct download is only supported for XiaoYa resources");
    }

    return this.xiaoyaService.createDownloadTargets(resources);
  }

  async verifyXiaoyaMe(): Promise<unknown> {
    return this.xiaoyaService.verifyMe();
  }

  private resolveProvider(): SearchProvider {
    if (this.provider === "auto") {
      return this.xiaoyaService.isConfigured() ? "xiaoya" : "openlist";
    }

    if (this.provider === "xiaoya" || this.provider === "openlist" || this.provider === "hybrid") {
      return this.provider;
    }

    return this.xiaoyaService.isConfigured() ? "xiaoya" : "openlist";
  }

  private dedupeResources(resources: OpenListResource[]): OpenListResource[] {
    const map = new Map<string, OpenListResource>();

    for (const resource of resources) {
      map.set(resource.id, resource);
    }

    return Array.from(map.values());
  }
}
