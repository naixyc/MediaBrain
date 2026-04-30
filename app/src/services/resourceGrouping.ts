import {
  areFileNamesSimilar,
  createStableResourceId,
  getOpenListName
} from "../utils/files";
import type {
  OpenListResource,
  ResourceSelectionKind,
  ResourceWithSubtitles
} from "../types";

export function groupResourcesWithSubtitles(resources: OpenListResource[]): ResourceWithSubtitles[] {
  const resourcesByParent = groupBy(resources, (resource) => resource.parentFolder);
  const grouped: ResourceWithSubtitles[] = [];

  for (const [parentFolder, folderResources] of resourcesByParent.entries()) {
    const videos = sortResources(folderResources.filter((resource) => resource.type === "video"));
    const subtitles = sortResources(folderResources.filter((resource) => resource.type === "subtitle"));

    console.log(
      `[ResourceGrouping] folder ${parentFolder}: ${videos.length} videos, ${subtitles.length} subtitles`
    );

    for (const video of videos) {
      const matchedSubtitles = matchSubtitlesForVideo(video, subtitles, videos.length);

      console.log(
        `[ResourceGrouping] video ${video.name}: matched subtitles ${matchedSubtitles.length}`
      );

      grouped.push(createGroup("single", video.name, [video], matchedSubtitles, parentFolder));
    }

    if (videos.length > 1) {
      const collectionFolders = new Set(videos.map((video) => video.collectionFolder || video.parentFolder));
      const shouldCreateSeasonGroup =
        collectionFolders.size > 1 ||
        !collectionFolders.has(parentFolder);

      if (shouldCreateSeasonGroup) {
        grouped.push(
          createGroup(
            "season",
            createSeasonGroupName(parentFolder, videos),
            videos,
            subtitles,
            parentFolder
          )
        );
      }
    }
  }

  const resourcesByCollection = groupBy(
    resources,
    (resource) => resource.collectionFolder || resource.parentFolder
  );

  for (const [collectionFolder, collectionResources] of resourcesByCollection.entries()) {
    const videos = sortResources(collectionResources.filter((resource) => resource.type === "video"));
    if (videos.length <= 1) {
      continue;
    }

    const subtitles = sortResources(collectionResources.filter((resource) => resource.type === "subtitle"));
    if (!shouldCreateCollectionGroup(collectionFolder, videos)) {
      continue;
    }

    const collectionName =
      videos.find((video) => video.collectionName)?.collectionName ||
      getOpenListName(collectionFolder);

    grouped.push(
      createGroup(
        "collection",
        `${collectionName} (${videos.length} \u96c6)`,
        videos,
        subtitles,
        collectionFolder
      )
    );
  }

  return sortGroups(dedupeGroups(grouped));
}

function createSeasonGroupName(parentFolder: string, videos: OpenListResource[]): string {
  const parentName = getOpenListName(parentFolder);
  const collectionName = getSharedCollectionName(videos);
  const prefix =
    collectionName && collectionName !== parentName
      ? `${collectionName} - `
      : "";

  return `${prefix}${parentName} (${videos.length} \u96c6)`;
}

function createGroup(
  kind: ResourceSelectionKind,
  name: string,
  videos: OpenListResource[],
  subtitles: OpenListResource[],
  parentFolder: string
): ResourceWithSubtitles {
  const sortedVideos = sortResources(videos);
  const sortedSubtitles = sortResources(subtitles);
  const primaryVideo = sortedVideos[0];
  if (!primaryVideo) {
    throw new Error("resource group requires at least one video");
  }

  const source = primaryVideo?.source || sortedSubtitles[0]?.source || "unknown";
  const id = createStableResourceId(
    source,
    `${kind}:${parentFolder}:${sortedVideos.map((video) => video.id).join(",")}`
  );

  return {
    id,
    name,
    kind,
    video: primaryVideo,
    videos: sortedVideos,
    subtitles: sortedSubtitles,
    parentFolder,
    source
  };
}

export function matchSubtitlesForVideo(
  video: OpenListResource,
  subtitles: OpenListResource[],
  videosCountInFolder: number
): OpenListResource[] {
  return subtitles.filter((subtitle) => {
    if (areFileNamesSimilar(video.name, subtitle.name)) {
      return true;
    }

    return videosCountInFolder === 1;
  });
}

function dedupeGroups(groups: ResourceWithSubtitles[]): ResourceWithSubtitles[] {
  const map = new Map<string, ResourceWithSubtitles>();

  for (const group of groups) {
    map.set(group.id, group);
  }

  return Array.from(map.values());
}

function shouldCreateCollectionGroup(collectionFolder: string, videos: OpenListResource[]): boolean {
  const parentFolders = Array.from(new Set(videos.map((video) => video.parentFolder)));

  if (parentFolders.length === 1) {
    return (
      parentFolders[0] === collectionFolder &&
      hasEpisodeLikeVideoSet(videos) &&
      !isGenericCollectionFolderName(getOpenListName(collectionFolder))
    );
  }

  const seasonLikeFolders = parentFolders
    .map((folder) => getOpenListName(folder))
    .filter(isSeasonLikeFolderName);

  return seasonLikeFolders.length >= 2;
}

function getSharedCollectionName(resources: OpenListResource[]): string | undefined {
  const names = resources
    .map((resource) => resource.collectionName)
    .filter((name): name is string => Boolean(name));
  const uniqueNames = Array.from(new Set(names));

  return uniqueNames.length === 1 ? uniqueNames[0] : undefined;
}

function isSeasonLikeFolderName(value: string): boolean {
  return /(?:season|series|s\d{1,2}|\u7b2c\s*\d+\s*[\u5b63\u90e8]|part\s*\d+)/i.test(value);
}

function isGenericCollectionFolderName(value: string): boolean {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return true;
  }

  return (
    /^[a-z]$/i.test(normalized) ||
    /^bd\d{4,}$/i.test(normalized) ||
    /^\d{1,3}$/.test(normalized) ||
    /^\d{1,3}\s*(?:\u7535\u89c6\u5267\u96c6|\u5267\u96c6|\u52a8\u6f2b)$/i.test(normalized) ||
    /(?:\u6587\u4ef6|\u6587\u4ef6\u5939)\d*/i.test(normalized) ||
    /(?:\u84dd\u5149\u539f\u76d8|remux|iso|top\s*\d+)/i.test(normalized)
  );
}

function hasEpisodeLikeVideoSet(videos: OpenListResource[]): boolean {
  if (videos.length <= 1) {
    return false;
  }

  const episodeLikeVideos = videos.filter((video) => isEpisodeLikeVideoName(video.name));
  return episodeLikeVideos.length >= Math.min(2, videos.length);
}

function isEpisodeLikeVideoName(fileName: string): boolean {
  const baseName = getOpenListName(fileName).replace(/\.[^.]+$/, "");
  const normalized = baseName.replace(/[\s._-]+/g, " ").trim();

  return (
    /^\d{1,3}$/i.test(normalized) ||
    /\bs\d{1,2}e\d{1,3}\b/i.test(normalized) ||
    /\b(?:ep|episode|e)\s*\d{1,3}\b/i.test(normalized) ||
    /(?:\u7b2c\s*\d{1,4}\s*[\u96c6\u8bdd\u8a71]|[\u7b2c\[【(\uff08]\s*\d{1,4}\s*[\]】)\uff09\u96c6\u8bdd\u8a71])/.test(normalized)
  );
}

function sortGroups(groups: ResourceWithSubtitles[]): ResourceWithSubtitles[] {
  const kindOrder: Record<ResourceSelectionKind, number> = {
    collection: 0,
    season: 1,
    single: 2
  };

  return groups.sort((left, right) => {
    const kindDiff = kindOrder[left.kind] - kindOrder[right.kind];
    if (kindDiff !== 0) {
      return kindDiff;
    }

    return left.name.localeCompare(right.name, "zh-Hans-CN", {
      numeric: true,
      sensitivity: "base"
    });
  });
}

function sortResources(resources: OpenListResource[]): OpenListResource[] {
  return resources.slice().sort((left, right) =>
    left.name.localeCompare(right.name, "zh-Hans-CN", {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    const group = map.get(key) || [];
    group.push(item);
    map.set(key, group);
  }

  return map;
}
