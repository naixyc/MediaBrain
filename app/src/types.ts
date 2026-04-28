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
  provider?: ResourceProvider;
}

export interface ResourceWithSubtitles {
  video: OpenListResource;
  subtitles: OpenListResource[];
}

export interface ResourceSearchItem {
  id: string;
  name: string;
  size: string;
  source: string;
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
  subtitleTargetPaths?: string[];
  downloadPaths?: string[];
  downloadProgress?: DownloadProgress[];
  finalVideoPath?: string;
  finalSubtitlePaths?: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}
