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

    const groupedResources = groupResourcesWithSubtitles(resources);

    for (const resource of groupedResources) {
      this.selectionCache.set(resource.id, resource);
    }

    console.log(`[ResourceSelectionService] selectable video resources: ${groupedResources.length}`);

    return groupedResources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      size: formatFileSize(sumResourceSizes([...resource.videos, ...resource.subtitles])),
      source: resource.source,
      kind: resource.kind,
      videosCount: resource.videos.length,
      subtitlesCount: resource.subtitles.length
    }));
  }

  getSelection(resourceId: string): ResourceWithSubtitles | null {
    return this.selectionCache.get(resourceId) ?? null;
  }
}

function sumResourceSizes(resources: { size: number }[]): number {
  return resources.reduce((total, resource) => total + (Number(resource.size) || 0), 0);
}
