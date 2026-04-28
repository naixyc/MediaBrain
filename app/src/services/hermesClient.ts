interface RenameRequest {
  taskId: string;
  fromPath: string;
  toPath: string;
  subtitlePaths: string[];
}

interface RenameResponse {
  videoPath: string;
  subtitlePaths: string[];
  mode: string;
}

export class HermesClient {
  private readonly baseUrl = (process.env.HERMES_EXECUTOR_URL || "http://127.0.0.1:42182").replace(/\/+$/, "");

  async rename(request: RenameRequest): Promise<RenameResponse> {
    console.log(`[HermesClient] rename task ${request.taskId}: ${request.fromPath} -> ${request.toPath}`);

    const response = await fetch(`${this.baseUrl}/hermes/rename`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    });

    const body = (await response.json()) as Partial<RenameResponse>;

    if (!response.ok || !body.videoPath || !body.subtitlePaths || !body.mode) {
      throw new Error(`Hermes rename failed: ${response.statusText}`);
    }

    console.log(`[HermesClient] rename completed in ${body.mode} mode`);

    return {
      videoPath: body.videoPath,
      subtitlePaths: body.subtitlePaths,
      mode: body.mode
    };
  }
}

