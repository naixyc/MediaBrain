import * as path from "node:path";

interface GeneratePathRequest {
  taskId: string;
  keyword: string;
  videoName: string;
  downloadPath: string;
  subtitlePaths: string[];
}

interface GeneratePathResponse {
  targetPath: string;
}

export class AIServiceClient {
  private readonly baseUrl = (process.env.AI_SERVICE_URL || "http://127.0.0.1:42181").replace(/\/+$/, "");

  async generateTargetPath(request: GeneratePathRequest): Promise<string> {
    console.log(`[AIServiceClient] generating target path for task ${request.taskId}`);

    const response = await fetch(`${this.baseUrl}/ai/generate-path`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    });

    const body = (await response.json()) as Partial<GeneratePathResponse>;

    if (!response.ok || !body.targetPath) {
      throw new Error(`AIService generate path failed: ${response.statusText}`);
    }

    console.log(`[AIServiceClient] target path: ${body.targetPath}`);
    return path.normalize(body.targetPath);
  }
}

