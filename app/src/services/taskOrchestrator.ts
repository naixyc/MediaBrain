import { randomUUID } from "node:crypto";
import { groupResourcesWithSubtitles, matchSubtitlesForVideo } from "./resourceGrouping";
import { formatFileSize } from "../utils/files";
import type { AIServiceClient } from "./aiServiceClient";
import type { Aria2Service } from "./aria2Service";
import type { HermesClient } from "./hermesClient";
import type { MediaResourceService } from "./mediaResourceService";
import type { TransferService } from "./transferService";
import type {
  DownloadProgress,
  DownloadTarget,
  ResourceSearchItem,
  OpenListResource,
  ResourceWithSubtitles,
  TaskSnapshot,
  TaskStatus
} from "../types";

interface MediaTask {
  taskId: string;
  keyword: string;
  status: TaskStatus;
  candidateGroups: ResourceWithSubtitles[];
  candidates: ResourceSearchItem[];
  selectedResourceId?: string;
  selectedResource?: ResourceWithSubtitles;
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
  pipeline?: Promise<void>;
}

export class TaskOrchestrator {
  private readonly tasks = new Map<string, MediaTask>();

  constructor(
    private readonly mediaResourceService: MediaResourceService,
    private readonly transferService: TransferService,
    private readonly aria2Service: Aria2Service,
    private readonly aiServiceClient: AIServiceClient,
    private readonly hermesClient: HermesClient
  ) {}

  async createTask(keyword: string): Promise<TaskSnapshot> {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) {
      throw new Error("keyword is required");
    }

    const task: MediaTask = {
      taskId: randomUUID(),
      keyword: normalizedKeyword,
      status: "等待选择资源",
      candidateGroups: [],
      candidates: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.tasks.set(task.taskId, task);
    this.logStatus(task);

    const resources = await this.mediaResourceService.searchAll(normalizedKeyword);
    const candidateGroups = groupResourcesWithSubtitles(resources);
    task.candidateGroups = candidateGroups;
    task.candidates = this.createCandidateItems(candidateGroups);
    task.updatedAt = new Date().toISOString();

    console.log(
      `[TaskOrchestrator] task ${task.taskId} created with ${task.candidates.length} candidates`
    );

    return this.toSnapshot(task);
  }

  createTaskFromSelection(keyword: string | undefined, selectedResource: ResourceWithSubtitles): TaskSnapshot {
    const normalizedKeyword = (keyword || selectedResource.video.name).trim();
    if (!normalizedKeyword) {
      throw new Error("keyword is required");
    }

    const task: MediaTask = {
      taskId: randomUUID(),
      keyword: normalizedKeyword,
      status: "等待选择资源",
      candidateGroups: [selectedResource],
      candidates: this.createCandidateItems([selectedResource]),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.tasks.set(task.taskId, task);
    this.startSelectedTask(task, selectedResource);

    console.log(
      `[TaskOrchestrator] task ${task.taskId} created from selected resource ${selectedResource.name}`
    );

    return this.toSnapshot(task);
  }

  selectResource(taskId: string | undefined, resourceId: string): TaskSnapshot {
    const task = this.resolveTaskForSelection(taskId, resourceId);

    if (task.status !== "等待选择资源") {
      throw new Error(`task ${task.taskId} is not waiting for resource selection`);
    }

    const selectedResource = task.candidateGroups.find((group) => group.id === resourceId);
    if (!selectedResource) {
      throw new Error(`resource ${resourceId} not found in task ${task.taskId}`);
    }

    this.startSelectedTask(task, selectedResource);

    return this.toSnapshot(task);
  }

  getTask(taskId: string): TaskSnapshot | null {
    const task = this.tasks.get(taskId);
    return task ? this.toSnapshot(task) : null;
  }

  listTasks(): TaskSnapshot[] {
    return Array.from(this.tasks.values()).map((task) => this.toSnapshot(task));
  }

  private async runPipeline(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || !task.selectedResource) {
      throw new Error(`task ${taskId} has no selected resource`);
    }

    const selected = task.selectedResource;
    const selectedVideos = selected.videos.length > 0 ? selected.videos : [selected.video];
    const selectedFiles = dedupeResources([...selectedVideos, ...selected.subtitles]);

    console.log(
      `[TaskOrchestrator] task ${task.taskId} pipeline started for ${selected.name}`
    );
    console.log(
      `[TaskOrchestrator] task ${task.taskId} selected videos: ${selectedVideos.length}, subtitles: ${selected.subtitles.length}`
    );

    let downloadTargets: DownloadTarget[];
    let sourcePathByResourceId = new Map<string, string>();

    if (this.mediaResourceService.canCreateDirectDownloadTargets(selectedFiles)) {
      console.log(`[TaskOrchestrator] task ${task.taskId} using direct XiaoYa download links`);
      sourcePathByResourceId = new Map(selectedFiles.map((resource) => [resource.id, resource.path]));
      task.videoTargetPath = selectedVideos[0]?.path;
      task.videoTargetPaths = selectedVideos.map((video) => video.path);
      task.subtitleTargetPaths = selected.subtitles.map((subtitle) => subtitle.path);
      downloadTargets = await this.mediaResourceService.createDirectDownloadTargets(selectedFiles);
    } else {
      this.updateStatus(task, "转存中");
      const files = selectedFiles.map((resource) => ({
        path: resource.path
      }));
      const transferPaths = await this.transferService.transferFiles(files);
      sourcePathByResourceId = new Map(
        selectedFiles.map((resource, index) => [resource.id, transferPaths[index] || resource.path])
      );
      task.videoTargetPath = selectedVideos[0] ? sourcePathByResourceId.get(selectedVideos[0].id) : undefined;
      task.videoTargetPaths = selectedVideos
        .map((video) => sourcePathByResourceId.get(video.id))
        .filter((targetPath): targetPath is string => Boolean(targetPath));
      task.subtitleTargetPaths = selected.subtitles
        .map((subtitle) => sourcePathByResourceId.get(subtitle.id))
        .filter((targetPath): targetPath is string => Boolean(targetPath));

      console.log(
        `[TaskOrchestrator] task ${task.taskId} transferred files: ${transferPaths.join(", ")}`
      );

      downloadTargets = await this.transferService.createDownloadTargets(transferPaths);
    }

    this.updateStatus(task, "下载中");
    const gids = await this.aria2Service.addDownloads(downloadTargets);
    task.downloadProgress = gids.map((gid, index) => ({
      gid,
      sourcePath: downloadTargets[index]?.sourcePath || "",
      outputPath: downloadTargets[index]?.outputPath || "",
      status: "waiting",
      totalLength: 0,
      completedLength: 0,
      downloadSpeed: 0,
      progress: 0
    }));
    console.log(`[TaskOrchestrator] task ${task.taskId} aria2 gids: ${gids.join(", ")}`);

    const downloadPaths = await this.aria2Service.waitForDownloads(gids, downloadTargets, (progress) => {
      task.downloadProgress = mergeDownloadProgress(task.downloadProgress || [], progress);
      task.updatedAt = new Date().toISOString();
    });
    task.downloadPaths = downloadPaths;
    console.log(
      `[TaskOrchestrator] task ${task.taskId} downloads completed: ${downloadPaths.join(", ")}`
    );

    const downloadPathByResourceId = new Map(
      selectedFiles.map((resource, index) => [resource.id, downloadPaths[index]])
    );
    const finalVideoPaths: string[] = [];
    const finalSubtitlePaths: string[] = [];

    for (let index = 0; index < selectedVideos.length; index += 1) {
      const video = selectedVideos[index];
      const videoDownloadPath = downloadPathByResourceId.get(video.id);
      if (!videoDownloadPath) {
        throw new Error(`download path missing for ${video.name}`);
      }

      const matchedSubtitles = matchSubtitlesForVideo(video, selected.subtitles, selectedVideos.length);
      const subtitleDownloadPaths = matchedSubtitles
        .map((subtitle) => downloadPathByResourceId.get(subtitle.id))
        .filter((subtitlePath): subtitlePath is string => Boolean(subtitlePath));

      const finalTargetPath = await this.aiServiceClient.generateTargetPath({
        taskId: task.taskId,
        keyword: task.keyword,
        videoName: video.name,
        downloadPath: videoDownloadPath,
        subtitlePaths: subtitleDownloadPaths,
        collectionName: selectedVideos.length > 1 ? selected.name : undefined,
        selectionKind: selected.kind,
        episodeIndex: index + 1,
        batchSize: selectedVideos.length
      });

      const renameResult = await this.hermesClient.rename({
        taskId: task.taskId,
        fromPath: videoDownloadPath,
        toPath: finalTargetPath,
        subtitlePaths: subtitleDownloadPaths
      });

      finalVideoPaths.push(renameResult.videoPath);
      finalSubtitlePaths.push(...renameResult.subtitlePaths);
    }

    task.finalVideoPath = finalVideoPaths[0];
    task.finalVideoPaths = finalVideoPaths;
    task.finalSubtitlePaths = finalSubtitlePaths;
    this.updateStatus(task, "已完成");
  }

  private deferPipeline(taskId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        this.runPipeline(taskId).then(resolve, reject);
      }, 0);
    });
  }

  private startSelectedTask(task: MediaTask, selectedResource: ResourceWithSubtitles): void {
    task.selectedResourceId = selectedResource.id;
    task.selectedResource = selectedResource;
    this.updateStatus(task, "已选择资源");

    task.pipeline = this.deferPipeline(task.taskId).catch((error) => {
      const currentTask = this.tasks.get(task.taskId);
      if (!currentTask) {
        return;
      }

      currentTask.error = error instanceof Error ? error.message : String(error);
      this.updateStatus(currentTask, "失败");
    });
  }

  private createCandidateItems(candidateGroups: ResourceWithSubtitles[]): ResourceSearchItem[] {
    return candidateGroups.map((group) => {
      const sizeBytes = sumResourceSizes([...group.videos, ...group.subtitles]);

      return {
        id: group.id,
        name: group.name,
        size: formatFileSize(sizeBytes),
        sizeBytes,
        source: group.source,
        provider: group.video.provider,
        kind: group.kind,
        videosCount: group.videos.length,
        subtitlesCount: group.subtitles.length
      };
    });
  }

  private resolveTaskForSelection(taskId: string | undefined, resourceId: string): MediaTask {
    if (taskId) {
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new Error(`task ${taskId} not found`);
      }

      return task;
    }

    const matchingTasks = Array.from(this.tasks.values()).filter(
      (task) =>
        task.status === "等待选择资源" &&
        task.candidateGroups.some((group) => group.id === resourceId)
    );

    if (matchingTasks.length === 0) {
      throw new Error(`resource ${resourceId} not found in any waiting task`);
    }

    if (matchingTasks.length > 1) {
      throw new Error("taskId is required because multiple waiting tasks contain this resource");
    }

    return matchingTasks[0];
  }

  private updateStatus(task: MediaTask, status: TaskStatus): void {
    task.status = status;
    task.updatedAt = new Date().toISOString();
    this.logStatus(task);
  }

  private logStatus(task: MediaTask): void {
    console.log(`[TaskOrchestrator] task ${task.taskId} status -> ${task.status}`);
  }

  private toSnapshot(task: MediaTask): TaskSnapshot {
    return {
      taskId: task.taskId,
      keyword: task.keyword,
      status: task.status,
      candidates: task.candidates,
      selectedResourceId: task.selectedResourceId,
      videoTargetPath: task.videoTargetPath,
      videoTargetPaths: task.videoTargetPaths,
      subtitleTargetPaths: task.subtitleTargetPaths,
      downloadPaths: task.downloadPaths,
      downloadProgress: task.downloadProgress,
      finalVideoPath: task.finalVideoPath,
      finalVideoPaths: task.finalVideoPaths,
      finalSubtitlePaths: task.finalSubtitlePaths,
      error: task.error,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    };
  }
}

function mergeDownloadProgress(
  current: DownloadProgress[],
  next: DownloadProgress
): DownloadProgress[] {
  const map = new Map(current.map((item) => [item.gid, item]));
  map.set(next.gid, next);
  return Array.from(map.values());
}

function dedupeResources(resources: OpenListResource[]): OpenListResource[] {
  const map = new Map<string, OpenListResource>();

  for (const resource of resources) {
    map.set(resource.id, resource);
  }

  return Array.from(map.values());
}

function sumResourceSizes(resources: { size: number }[]): number {
  return resources.reduce((total, resource) => total + (Number(resource.size) || 0), 0);
}
