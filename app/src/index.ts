import { createServer } from "node:http";
import { AIServiceClient } from "./services/aiServiceClient";
import { Aria2Service } from "./services/aria2Service";
import { EmbyService } from "./services/embyService";
import { HermesClient } from "./services/hermesClient";
import { MediaResourceService } from "./services/mediaResourceService";
import { OpenListService } from "./services/openListService";
import { ResourceSelectionService } from "./services/resourceSelectionService";
import { TaskOrchestrator } from "./services/taskOrchestrator";
import { TransferService } from "./services/transferService";
import { XiaoyaService } from "./services/xiaoyaService";
import { readJsonBody, sendJson, sendNoContent } from "./http";
import { renderUiPage } from "./uiPage";

const port = Number(process.env.PORT ?? process.env.APP_PORT ?? 42180);
const openListService = new OpenListService();
const xiaoyaService = new XiaoyaService();
const embyService = new EmbyService();
const mediaResourceService = new MediaResourceService(openListService, xiaoyaService, embyService);
const resourceSelectionService = new ResourceSelectionService(mediaResourceService);
const transferService = new TransferService();
const taskOrchestrator = new TaskOrchestrator(
  mediaResourceService,
  transferService,
  new Aria2Service(),
  new AIServiceClient(),
  new HermesClient()
);

interface CreateTaskRequest {
  keyword?: string;
}

interface SelectResourceRequest {
  taskId?: string;
  resourceId?: string;
  keyword?: string;
}

interface CreateEmbyServerRequest {
  name?: string;
  baseUrl?: string;
  username?: string;
  password?: string;
  enabled?: boolean;
  proxyUrl?: string;
  aria2ProxyUrl?: string;
  verify?: boolean;
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendNoContent(response);
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  try {
    if (request.method === "GET" && url.pathname === "/") {
      sendJson(response, 200, {
        service: "MediaBrain API",
        status: "ok",
        endpoints: [
          "GET /ui",
          "POST /task/create",
          "GET /task/:taskId",
          "GET /tasks",
          "GET /openlist/me",
          "GET /xiaoya/me",
          "GET /sources/health",
          "GET /emby/servers",
          "POST /emby/servers",
          "PUT /emby/servers/:serverId",
          "DELETE /emby/servers/:serverId",
          "GET /resources/search?keyword=xxx",
          "POST /resources/select"
        ]
      });
      return;
    }

    if (request.method === "GET" && (url.pathname === "/ui" || url.pathname === "/ui/")) {
      response.statusCode = 200;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(renderUiPage());
      return;
    }

    if (request.method === "POST" && url.pathname === "/task/create") {
      const body = await readJsonBody<CreateTaskRequest>(request);
      const keyword = body.keyword?.trim();

      if (!keyword) {
        sendJson(response, 400, { error: "keyword is required" });
        return;
      }

      const task = await taskOrchestrator.createTask(keyword);
      sendJson(response, 201, task);
      return;
    }

    if (request.method === "GET" && url.pathname === "/tasks") {
      sendJson(response, 200, taskOrchestrator.listTasks());
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/task/")) {
      const taskId = decodeURIComponent(url.pathname.slice("/task/".length));
      const task = taskOrchestrator.getTask(taskId);

      if (!task) {
        sendJson(response, 404, { error: "task not found" });
        return;
      }

      sendJson(response, 200, task);
      return;
    }

    if (request.method === "GET" && url.pathname === "/openlist/me") {
      const me = await openListService.verifyMe();
      sendJson(response, 200, me);
      return;
    }

    if (request.method === "GET" && url.pathname === "/xiaoya/me") {
      const me = await mediaResourceService.verifyXiaoyaMe();
      sendJson(response, 200, me);
      return;
    }

    if (request.method === "GET" && url.pathname === "/sources/health") {
      const xiaoyaHealth = await createXiaoyaHealth();
      const embyHealth = await embyService.health();
      sendJson(response, 200, [xiaoyaHealth, ...embyHealth]);
      return;
    }

    if (request.method === "GET" && url.pathname === "/emby/servers") {
      sendJson(response, 200, embyService.listServers());
      return;
    }

    if (request.method === "POST" && url.pathname === "/emby/servers") {
      const body = await readJsonBody<CreateEmbyServerRequest>(request);
      const serverSummary = await embyService.addServer(body);
      sendJson(response, 201, serverSummary);
      return;
    }

    if (url.pathname.startsWith("/emby/servers/")) {
      const serverId = decodeURIComponent(url.pathname.slice("/emby/servers/".length));

      if (request.method === "PUT") {
        const body = await readJsonBody<CreateEmbyServerRequest>(request);
        const serverSummary = await embyService.updateServer(serverId, body);
        sendJson(response, 200, serverSummary);
        return;
      }

      if (request.method === "DELETE") {
        const serverSummary = embyService.deleteServer(serverId);
        sendJson(response, 200, serverSummary);
        return;
      }
    }

    if (request.method === "GET" && url.pathname === "/resources/search") {
      const keyword = url.searchParams.get("keyword") || "";
      const resources = await resourceSelectionService.search(keyword);
      sendJson(response, 200, resources);
      return;
    }

    if (request.method === "POST" && url.pathname === "/resources/select") {
      const body = await readJsonBody<SelectResourceRequest>(request);
      const taskId = body.taskId?.trim();
      const resourceId = body.resourceId?.trim();
      const keyword = body.keyword?.trim();

      if (!resourceId) {
        sendJson(response, 400, { error: "resourceId is required" });
        return;
      }

      console.log(`[ResourcesAPI] selected resource: ${resourceId}, task: ${taskId || "<auto>"}`);
      let task;
      try {
        if (taskId) {
          task = taskOrchestrator.selectResource(taskId, resourceId);
        } else {
          const selection = resourceSelectionService.getSelection(resourceId);
          task = selection
            ? taskOrchestrator.createTaskFromSelection(keyword, selection)
            : taskOrchestrator.selectResource(undefined, resourceId);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        sendJson(response, 400, { error: message });
        return;
      }

      sendJson(response, 202, task);
      return;
    }

    sendJson(response, 404, { error: "not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[ResourcesAPI] request failed: ${message}`);
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`MediaBrain API service listening on port ${port}`);
});

async function createXiaoyaHealth() {
  if (!xiaoyaService.isConfigured()) {
    return {
      id: "xiaoya",
      name: "XiaoYa",
      provider: "xiaoya" as const,
      configured: false,
      healthy: false,
      detail: "XIAOYA_BASE_URL is not configured"
    };
  }

  try {
    await xiaoyaService.verifyMe();
    return {
      id: "xiaoya",
      name: "XiaoYa",
      provider: "xiaoya" as const,
      configured: true,
      healthy: true,
      detail: "ok"
    };
  } catch (error) {
    return {
      id: "xiaoya",
      name: "XiaoYa",
      provider: "xiaoya" as const,
      configured: true,
      healthy: false,
      detail: error instanceof Error ? error.message : String(error)
    };
  }
}
