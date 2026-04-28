import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, rename } from "node:fs/promises";
import * as path from "node:path";

const port = Number(process.env.PORT ?? process.env.HERMES_PORT ?? 42182);

interface RenameRequest {
  taskId?: string;
  fromPath?: string;
  toPath?: string;
  subtitlePaths?: string[];
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/") {
      sendJson(response, 200, {
      service: "MediaBrain Hermes Executor",
      status: "ok"
      });
      return;
    }

    if (request.method === "POST" && request.url === "/hermes/rename") {
      const body = await readJsonBody<RenameRequest>(request);

      if (!body.fromPath || !body.toPath) {
        sendJson(response, 400, { error: "fromPath and toPath are required" });
        return;
      }

      const mode = await renameMedia(body);
      const subtitlePaths = createSubtitleTargetPaths(body.toPath, body.subtitlePaths || []);

      console.log(`[HermesExecutor] task ${body.taskId || "<none>"} rename mode: ${mode}`);
      sendJson(response, 200, {
        videoPath: body.toPath,
        subtitlePaths,
        mode
      });
      return;
    }

    sendJson(response, 404, { error: "not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[HermesExecutor] request failed: ${message}`);
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Hermes executor listening on port ${port}`);
});

async function renameMedia(request: RenameRequest): Promise<string> {
  const mode = process.env.HERMES_RENAME_MODE || "auto";
  const subtitlePaths = request.subtitlePaths || [];

  if (!request.fromPath || !request.toPath) {
    throw new Error("fromPath and toPath are required");
  }

  if (!existsSync(request.fromPath)) {
    if (mode === "filesystem") {
      throw new Error(`source file does not exist: ${request.fromPath}`);
    }

    console.log(`[HermesExecutor] source missing, simulate rename: ${request.fromPath}`);
    return "simulate";
  }

  await mkdir(path.dirname(request.toPath), { recursive: true });
  await rename(request.fromPath, request.toPath);

  const subtitleTargets = createSubtitleTargetPaths(request.toPath, subtitlePaths);
  for (let index = 0; index < subtitlePaths.length; index += 1) {
    const subtitlePath = subtitlePaths[index];
    const subtitleTarget = subtitleTargets[index];

    if (!subtitleTarget || !existsSync(subtitlePath)) {
      continue;
    }

    await mkdir(path.dirname(subtitleTarget), { recursive: true });
    await rename(subtitlePath, subtitleTarget);
  }

  return "filesystem";
}

function createSubtitleTargetPaths(videoTargetPath: string, subtitlePaths: string[]): string[] {
  const targetDirectory = path.dirname(videoTargetPath);
  const videoBaseName = path.basename(videoTargetPath, path.extname(videoTargetPath));

  return subtitlePaths.map((subtitlePath, index) => {
    const extension = path.extname(subtitlePath) || ".srt";
    return path.join(targetDirectory, `${videoBaseName}.${index + 1}${extension}`);
  });
}

async function readJsonBody<T>(request: NodeJS.ReadableStream): Promise<T> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  return rawBody ? (JSON.parse(rawBody) as T) : ({} as T);
}

function sendJson(
  response: { statusCode: number; setHeader(name: string, value: string): void; end(body: string): void },
  statusCode: number,
  payload: unknown
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}
