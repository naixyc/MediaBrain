import { randomUUID } from "node:crypto";
import { groupResourcesWithSubtitles } from "./resourceGrouping";
import { formatFileSize } from "../utils/files";
import type { AIServiceClient } from "./aiServiceClient";
import type { Aria2Service } from "./aria2Service";
import type { HermesClient } from "./hermesClient";
import type { MediaResourceService } from "./mediaResourceService";
import type { TransferService } from "./transferService";
import type {
  DownloadTarget,
  ResourceSearchItem,
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
  subtitleTargetPaths?: string[];
  downloadPaths?: string[];
  finalVideoPath?: string;
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
    task.candidates = candidateGroups.map((group) => ({
      id: group.video.id,
      name: group.video.name,
      size: formatFileSize(group.video.size),
      source: group.video.source,
      subtitlesCount: group.subtitles.length
    }));
    task.updatedAt = new Date().toISOString();

    console.log(
      `[TaskOrchestrator] task ${task.taskId} created with ${task.candidates.length} candidates`
    );

    return this.toSnapshot(task);
  }

  selectResource(taskId: string | undefined, resourceId: string): TaskSnapshot {
    const task = this.resolveTaskForSelection(taskId, resourceId);

    if (task.status !== "等待选择资源") {
      throw new Error(`task ${task.taskId} is not waiting for resource selection`);
    }

    const selectedResource = task.candidateGroups.find((group) => group.video.id === resourceId);
    if (!selectedResource) {
      throw new Error(`resource ${resourceId} not found in task ${task.taskId}`);
    }

    task.selectedResourceId = resourceId;
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
    const selectedFiles = [selected.video, ...selected.subtitles];

    console.log(
      `[TaskOrchestrator] task ${task.taskId} pipeline started for ${selected.video.name}`
    );
    console.log(
      `[TaskOrchestrator] task ${task.taskId} selected subtitles: ${selected.subtitles.length}`
    );

    let downloadTargets: DownloadTarget[];

    if (this.mediaResourceService.canCreateDirectDownloadTargets(selectedFiles)) {
      console.log(`[TaskOrchestrator] task ${task.taskId} using direct XiaoYa download links`);
      task.videoTargetPath = selected.video.path;
      task.subtitleTargetPaths = selected.subtitles.map((subtitle) => subtitle.path);
      downloadTargets = await this.mediaResourceService.createDirectDownloadTargets(selectedFiles);
    } else {
      this.updateStatus(task, "转存中");
      const files = selectedFiles.map((resource) => ({
        path: resource.path
      }));
      const transferPaths = await this.transferService.transferFiles(files);
      task.videoTargetPath = transferPaths[0];
      task.subtitleTargetPaths = transferPaths.slice(1);

      console.log(
        `[TaskOrchestrator] task ${task.taskId} transferred files: ${transferPaths.join(", ")}`
      );

      downloadTargets = await this.transferService.createDownloadTargets(transferPaths);
    }

    this.updateStatus(task, "下载中");
    const gids = await this.aria2Service.addDownloads(downloadTargets);
    console.log(`[TaskOrchestrator] task ${task.taskId} aria2 gids: ${gids.join(", ")}`);

    const downloadPaths = await this.aria2Service.waitForDownloads(gids, downloadTargets);
    task.downloadPaths = downloadPaths;
    console.log(
      `[TaskOrchestrator] task ${task.taskId} downloads completed: ${downloadPaths.join(", ")}`
    );

    const finalTargetPath = await this.aiServiceClient.generateTargetPath({
      taskId: task.taskId,
      keyword: task.keyword,
      videoName: selected.video.name,
      downloadPath: downloadPaths[0],
      subtitlePaths: downloadPaths.slice(1)
    });

    const renameResult = await this.hermesClient.rename({
      taskId: task.taskId,
      fromPath: downloadPaths[0],
      toPath: finalTargetPath,
      subtitlePaths: downloadPaths.slice(1)
    });

    task.finalVideoPath = renameResult.videoPath;
    task.finalSubtitlePaths = renameResult.subtitlePaths;
    this.updateStatus(task, "已完成");
  }

  private deferPipeline(taskId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        this.runPipeline(taskId).then(resolve, reject);
      }, 0);
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
        task.candidateGroups.some((group) => group.video.id === resourceId)
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
      subtitleTargetPaths: task.subtitleTargetPaths,
      downloadPaths: task.downloadPaths,
      finalVideoPath: task.finalVideoPath,
      finalSubtitlePaths: task.finalSubtitlePaths,
      error: task.error,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    };
  }
}
