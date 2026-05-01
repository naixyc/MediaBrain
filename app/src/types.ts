export type ResourceType = "video" | "subtitle";
export type ResourceProvider = "openlist" | "xiaoya" | "emby" | "local";

export interface EmbyResourceMetadata {
  serverId: string;
  itemId: string;
  itemType: "Movie" | "Episode";
  mediaSourceId?: string;
  container?: string;
  seriesId?: string;
  seriesName?: string;
  seasonId?: string;
  seasonName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  productionYear?: number;
}

export interface SourceHealth {
  id: string;
  name: string;
  provider: ResourceProvider;
  configured: boolean;
  healthy: boolean;
  detail?: string;
  proxyUrl?: string;
}

export interface EmbyServerSummary {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  enabled: boolean;
  hasPassword: boolean;
  proxyUrl?: string;
  aria2ProxyUrl?: string;
  readonly?: boolean;
}

export interface OpenListResource {
  id: string;
  name: string;
  size: number;
  path: string;
  source: string;
  type: ResourceType;
  parentFolder: string;
  collectionFolder?: string;
  collectionName?: string;
  provider?: ResourceProvider;
  emby?: EmbyResourceMetadata;
}

export type ResourceSelectionKind = "collection" | "season" | "single";

export interface ResourceWithSubtitles {
  id: string;
  name: string;
  kind: ResourceSelectionKind;
  video: OpenListResource;
  videos: OpenListResource[];
  subtitles: OpenListResource[];
  parentFolder: string;
  source: string;
}

export interface ResourceSearchItem {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  source: string;
  provider?: ResourceProvider;
  kind: ResourceSelectionKind;
  videosCount: number;
  subtitlesCount: number;
}

export interface TaskPreflightSummary {
  provider?: ResourceProvider;
  fileCount: number;
  videoCount: number;
  subtitleCount: number;
  size: string;
  sizeBytes: number;
  sizeKnown: boolean;
  warning?: string;
}

export interface TransferTarget {
  path: string;
}

export interface DownloadTarget {
  sourcePath: string;
  url: string;
  outputPath: string;
  dir: string;
  out: string;
  expectedSize?: number;
  headers?: string[];
  aria2Options?: Record<string, unknown>;
}

export interface DownloadProgress {
  gid: string;
  sourcePath: string;
  outputPath: string;
  status: string;
  totalLength: number;
  completedLength: number;
  downloadSpeed: number;
  progress: number;
  errorMessage?: string;
}

export type TaskStatus =
  | "等待选择资源"
  | "等待确认"
  | "已选择资源"
  | "转存中"
  | "下载中"
  | "已完成"
  | "失败"
  | "已取消";

export interface TaskSnapshot {
  taskId: string;
  keyword: string;
  status: TaskStatus;
  candidates: ResourceSearchItem[];
  selectedResourceId?: string;
  preflight?: TaskPreflightSummary;
  videoTargetPath?: string;
  videoTargetPaths?: string[];
  subtitleTargetPaths?: string[];
  downloadPaths?: string[];
  downloadProgress?: DownloadProgress[];
  finalVideoPath?: string;
  finalVideoPaths?: string[];
  finalSubtitlePaths?: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}
