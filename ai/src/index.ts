import { createServer } from "node:http";
import * as path from "node:path";

const port = Number(process.env.PORT ?? process.env.AI_PORT ?? 42181);

interface GeneratePathRequest {
  taskId?: string;
  keyword?: string;
  videoName?: string;
  downloadPath?: string;
  collectionName?: string;
  selectionKind?: string;
  episodeIndex?: number;
  batchSize?: number;
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/") {
      sendJson(response, 200, {
      service: "MediaBrain AI Service",
      status: "ok"
      });
      return;
    }

    if (request.method === "POST" && request.url === "/ai/generate-path") {
      const body = await readJsonBody<GeneratePathRequest>(request);
      const keyword = body.keyword || "media";
      const downloadPath = body.downloadPath || body.videoName || "video.mkv";
      const extension = path.extname(downloadPath) || path.extname(body.videoName || "") || ".mkv";
      const isBatch = Number(body.batchSize || 0) > 1;
      const targetRoot = process.env.AI_TARGET_ROOT || path.join(path.dirname(downloadPath), "renamed");
      const targetDirectory = isBatch
        ? path.join(targetRoot, sanitizeFileName(stripEpisodeCount(body.collectionName || keyword)))
        : targetRoot;
      const videoBaseName = path.basename(
        body.videoName || path.basename(downloadPath),
        path.extname(body.videoName || downloadPath)
      );
      const targetName = isBatch
        ? `${sanitizeFileName(videoBaseName || `episode-${body.episodeIndex || 1}`)}${extension}`
        : `${sanitizeFileName(keyword)}${extension}`;
      const targetPath = path.join(targetDirectory, targetName);

      console.log(`[AIService] task ${body.taskId || "<none>"} target path: ${targetPath}`);
      sendJson(response, 200, { targetPath });
      return;
    }

    sendJson(response, 404, { error: "not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`[AIService] request failed: ${message}`);
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`AI service listening on port ${port}`);
});

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

function sanitizeFileName(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s/g, ".")
    .slice(0, 120) || "media";
}

function stripEpisodeCount(value: string): string {
  return value.replace(/\s*\(\d+\s*\u96c6\)\s*$/u, "").trim() || value;
}
