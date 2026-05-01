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

    const groupedResources = rankGroupedResources(
      collapseEmbySeriesGroups(groupResourcesWithSubtitles(resources)),
      keyword
    );

    for (const resource of groupedResources) {
      this.selectionCache.set(resource.id, resource);
    }

    console.log(`[ResourceSelectionService] selectable video resources: ${groupedResources.length}`);

    return groupedResources.map((resource) => {
      const sizeBytes = sumResourceSizes([...resource.videos, ...resource.subtitles]);
      const provider = resource.video.provider;

      return {
        id: resource.id,
        name: resource.name,
        size: provider === "xiaoya" ? "选择后估算" : formatFileSize(sizeBytes),
        sizeBytes,
        source: resource.source,
        provider,
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

function collapseEmbySeriesGroups(resources: ResourceWithSubtitles[]): ResourceWithSubtitles[] {
  const embyCollectionKeys = new Set<string>();
  const embyAggregateKeys = new Set<string>();

  for (const resource of resources) {
    if (resource.video.provider !== "emby" || resource.videos.length <= 1) {
      continue;
    }

    const key = getEmbySeriesKey(resource);
    if (!key || resource.kind === "single") {
      continue;
    }

    embyAggregateKeys.add(key);
    if (resource.kind === "collection") {
      embyCollectionKeys.add(key);
    }
  }

  if (embyAggregateKeys.size === 0) {
    return resources;
  }

  return resources.filter((resource) => {
    if (resource.video.provider !== "emby") {
      return true;
    }

    const key = getEmbySeriesKey(resource);
    if (!key) {
      return true;
    }

    if (resource.kind === "single" && embyAggregateKeys.has(key)) {
      return false;
    }

    if (resource.kind === "season" && embyCollectionKeys.has(key)) {
      return false;
    }

    return true;
  });
}

function getEmbySeriesKey(resource: ResourceWithSubtitles): string | undefined {
  return resource.video.collectionFolder || resource.video.parentFolder || resource.parentFolder;
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
