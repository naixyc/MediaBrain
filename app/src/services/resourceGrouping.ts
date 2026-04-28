import { areFileNamesSimilar } from "../utils/files";
import type { OpenListResource, ResourceWithSubtitles } from "../types";

export function groupResourcesWithSubtitles(resources: OpenListResource[]): ResourceWithSubtitles[] {
  const resourcesByParent = new Map<string, OpenListResource[]>();

  for (const resource of resources) {
    const group = resourcesByParent.get(resource.parentFolder) ?? [];
    group.push(resource);
    resourcesByParent.set(resource.parentFolder, group);
  }

  const grouped: ResourceWithSubtitles[] = [];

  for (const [parentFolder, folderResources] of resourcesByParent.entries()) {
    const videos = folderResources.filter((resource) => resource.type === "video");
    const subtitles = folderResources.filter((resource) => resource.type === "subtitle");

    console.log(
      `[ResourceGrouping] folder ${parentFolder}: ${videos.length} videos, ${subtitles.length} subtitles`
    );

    for (const video of videos) {
      const matchedSubtitles = subtitles.filter((subtitle) => {
        if (areFileNamesSimilar(video.name, subtitle.name)) {
          return true;
        }

        return videos.length === 1;
      });

      console.log(
        `[ResourceGrouping] video ${video.name}: matched subtitles ${matchedSubtitles.length}`
      );

      grouped.push({
        video,
        subtitles: matchedSubtitles
      });
    }
  }

  return grouped;
}
