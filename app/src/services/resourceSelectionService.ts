import { groupResourcesWithSubtitles } from "./resourceGrouping";
import { formatFileSize } from "../utils/files";
import type {
  ResourceSearchItem,
  ResourceWithSubtitles
} from "../types";
import type { MediaResourceService } from "./mediaResourceService";

export class ResourceSelectionService {
  private readonly selectionCache = new Map<string, ResourceWithSubtitles>();

  constructor(private readonly mediaResourceService: MediaResourceService) {}

  async search(keyword: string): Promise<ResourceSearchItem[]> {
    const resources = await this.mediaResourceService.searchAll(keyword);

    if (resources.length === 0) {
      console.log(`[ResourceSelectionService] keyword="${keyword}" found no resources`);
      return [];
    }

    const groupedResources = rankGroupedResources(groupResourcesWithSubtitles(resources), keyword);

    for (const resource of groupedResources) {
      this.selectionCache.set(resource.id, resource);
    }

    console.log(`[ResourceSelectionService] selectable video resources: ${groupedResources.length}`);

    return groupedResources.map((resource) => {
      const sizeBytes = sumResourceSizes([...resource.videos, ...resource.subtitles]);

      return {
        id: resource.id,
        name: resource.name,
        size: formatFileSize(sizeBytes),
        sizeBytes,
        source: resource.source,
        provider: resource.video.provider,
        kind: resource.kind,
        videosCount: resource.videos.length,
        subtitlesCount: resource.subtitles.length
      };
    });
  }

  getSelection(resourceId: string): ResourceWithSubtitles | null {
    return this.selectionCache.get(resourceId) ?? null;
  }
}

function sumResourceSizes(resources: { size: number }[]): number {
  return resources.reduce((total, resource) => total + (Number(resource.size) || 0), 0);
}

function rankGroupedResources(
  resources: ResourceWithSubtitles[],
  keyword: string
): ResourceWithSubtitles[] {
  const normalizedKeyword = normalizeSearchText(keyword);
  if (!normalizedKeyword) {
    return resources;
  }

  return resources.slice().sort((left, right) => {
    const rankDiff = scoreResource(left, normalizedKeyword) - scoreResource(right, normalizedKeyword);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    return left.name.localeCompare(right.name, "zh-Hans-CN", {
      numeric: true,
      sensitivity: "base"
    });
  });
}

function scoreResource(resource: ResourceWithSubtitles, normalizedKeyword: string): number {
  const name = normalizeSearchText(resource.name);
  const videoNames = resource.videos.map((video) => normalizeSearchText(video.name));
  const paths = resource.videos.map((video) => normalizeSearchText(video.path));
  const kindRank = scoreResourceKind(resource.kind);

  if (name.includes(normalizedKeyword)) {
    return kindRank;
  }

  if (videoNames.some((videoName) => videoName.includes(normalizedKeyword))) {
    return 10 + kindRank;
  }

  if (paths.some((filePath) => filePath.includes(normalizedKeyword))) {
    return 20 + kindRank;
  }

  return 30 + kindRank;
}

function scoreResourceKind(kind: ResourceWithSubtitles["kind"]): number {
  if (kind === "collection") {
    return 0;
  }

  if (kind === "season") {
    return 1;
  }

  return 2;
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}
