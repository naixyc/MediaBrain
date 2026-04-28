interface OpenListResponse<T> {
  code?: number;
  message?: string;
  data?: T;
}

interface OpenListLoginData {
  token?: string;
}

export interface OpenListMe {
  id: number;
  username: string;
  base_path: string;
  role: number;
  disabled: boolean;
  permission: number;
}

type OpenListAuthMode = "auto" | "token" | "login" | "basic" | "none";

export class OpenListClient {
  private readonly configuredToken = process.env.OPENLIST_TOKEN;
  private readonly username = process.env.OPENLIST_USERNAME;
  private readonly password = process.env.OPENLIST_PASSWORD;
  private readonly authMode = (process.env.OPENLIST_AUTH_MODE || "auto") as OpenListAuthMode;
  private cachedToken?: string;

  constructor(private readonly baseUrl: string) {}

  async get<T>(endpoint: string): Promise<OpenListResponse<T>> {
    return this.request<T>(endpoint, {
      method: "GET"
    });
  }

  async post<T>(endpoint: string, payload: unknown): Promise<OpenListResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  }

  async verifyMe(): Promise<OpenListMe> {
    const body = await this.get<OpenListMe>("/api/me");

    if (body.code !== 200 || !body.data) {
      throw new Error(`OpenList /api/me failed: ${body.message || "empty response"}`);
    }

    return body.data;
  }

  async createAuthorizationHeader(): Promise<string | undefined> {
    if (this.authMode === "none") {
      return undefined;
    }

    if (this.authMode === "basic") {
      return this.createBasicAuthHeader();
    }

    if (this.configuredToken) {
      return this.configuredToken;
    }

    if (this.authMode === "token") {
      throw new Error("OPENLIST_TOKEN is required when OPENLIST_AUTH_MODE=token");
    }

    if (this.authMode === "login" || this.authMode === "auto") {
      return this.getLoginToken();
    }

    return undefined;
  }

  private async request<T>(endpoint: string, init: RequestInit, retryOnUnauthorized = true): Promise<OpenListResponse<T>> {
    const authorization = await this.createAuthorizationHeader();
    const headers = new Headers(init.headers);

    if (authorization) {
      headers.set("Authorization", authorization);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...init,
      headers
    });
    const body = (await response.json()) as OpenListResponse<T>;

    if (
      retryOnUnauthorized &&
      (response.status === 401 || body.code === 401 || body.code === 403) &&
      this.cachedToken &&
      (this.authMode === "auto" || this.authMode === "login")
    ) {
      console.log("[OpenListClient] cached token rejected, refreshing login token");
      this.cachedToken = undefined;
      return this.request<T>(endpoint, init, false);
    }

    return body;
  }

  private async getLoginToken(): Promise<string> {
    if (this.cachedToken) {
      return this.cachedToken;
    }

    if (!this.username || !this.password) {
      throw new Error("OPENLIST_USERNAME and OPENLIST_PASSWORD are required for OpenList login auth");
    }

    console.log(`[OpenListClient] logging in as ${this.username}`);
    const response = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: this.username,
        password: this.password
      })
    });
    const body = (await response.json()) as OpenListResponse<OpenListLoginData>;
    const token = body.data?.token;

    if (!response.ok || body.code !== 200 || !token) {
      throw new Error(`OpenList login failed: ${body.message || response.statusText}`);
    }

    this.cachedToken = token;
    return token;
  }

  private createBasicAuthHeader(): string {
    if (!this.username || !this.password) {
      throw new Error("OPENLIST_USERNAME and OPENLIST_PASSWORD are required for OpenList basic auth");
    }

    return `Basic ${Buffer.from(`${this.username}:${this.password}`, "utf8").toString("base64")}`;
  }
}

