import type { DownloadTarget, OpenListResource } from "../types";
import type { EmbyService } from "./embyService";
import type { OpenListService } from "./openListService";
import type { XiaoyaService } from "./xiaoyaService";

type SearchProvider = "auto" | "xiaoya" | "openlist" | "emby" | "hybrid";

export class MediaResourceService {
  private readonly provider = (
    process.env.SEARCH_PROVIDER ||
    process.env.RESOURCE_SEARCH_PROVIDER ||
    "auto"
  ).toLowerCase() as SearchProvider;

  constructor(
    private readonly openListService: OpenListService,
    private readonly xiaoyaService: XiaoyaService,
    private readonly embyService: EmbyService
  ) {}

  async searchAll(keyword: string): Promise<OpenListResource[]> {
    const provider = this.resolveProvider();

    if (provider === "xiaoya") {
      return this.xiaoyaService.searchAll(keyword);
    }

    if (provider === "openlist") {
      return this.openListService.searchAll(keyword);
    }

    if (provider === "emby") {
      return this.embyService.searchAll(keyword);
    }

    const [xiaoyaResources, openListResources] = await Promise.all([
      this.xiaoyaService.isConfigured() ? this.xiaoyaService.searchAll(keyword) : Promise.resolve([]),
      this.openListService.searchAll(keyword)
    ]);
    const embyResources = this.embyService.isConfigured()
      ? await this.embyService.searchAll(keyword)
      : [];
    return this.dedupeResources([...xiaoyaResources, ...openListResources, ...embyResources]);
  }

  canCreateDirectDownloadTargets(resources: OpenListResource[]): boolean {
    return (
      (resources.length > 0 && resources.every((resource) => resource.provider === "xiaoya")) ||
      this.embyService.canCreateDownloadTargets(resources)
    );
  }

  async createDirectDownloadTargets(resources: OpenListResource[]): Promise<DownloadTarget[]> {
    if (resources.every((resource) => resource.provider === "xiaoya")) {
      return this.xiaoyaService.createDownloadTargets(resources);
    }

    if (this.embyService.canCreateDownloadTargets(resources)) {
      return this.embyService.createDownloadTargets(resources);
    }

    throw new Error("direct download is only supported for XiaoYa or Emby resources");
  }

  async verifyXiaoyaMe(): Promise<unknown> {
    return this.xiaoyaService.verifyMe();
  }

  private resolveProvider(): SearchProvider {
    if (this.provider === "auto") {
      return this.xiaoyaService.isConfigured() ? "xiaoya" : "openlist";
    }

    if (
      this.provider === "xiaoya" ||
      this.provider === "openlist" ||
      this.provider === "emby" ||
      this.provider === "hybrid"
    ) {
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
