export type ResourceType = "video" | "subtitle";
export type ResourceProvider = "openlist" | "xiaoya" | "local";

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
  kind: ResourceSelectionKind;
  videosCount: number;
  subtitlesCount: number;
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
  | "已选择资源"
  | "转存中"
  | "下载中"
  | "已完成"
  | "失败";

export interface TaskSnapshot {
  taskId: string;
  keyword: string;
  status: TaskStatus;
  candidates: ResourceSearchItem[];
  selectedResourceId?: string;
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
