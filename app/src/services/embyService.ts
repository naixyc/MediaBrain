import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import {
  fetch as undiciFetch,
  Headers,
  ProxyAgent,
  type Dispatcher,
  type RequestInit
} from "undici";
import { createStableResourceId } from "../utils/files";
import type {
  DownloadTarget,
  EmbyResourceMetadata,
  EmbyServerSummary,
  OpenListResource,
  SourceHealth
} from "../types";

const execFileAsync = promisify(execFile);

interface EmbyServerConfig {
  id: string;
  name: string;
  baseUrl: string;
  username: string;
  password: string;
  enabled: boolean;
  proxyUrl?: string;
  aria2ProxyUrl?: string;
  readonly?: boolean;
}

interface EmbyServerInput {
  id?: string;
  name?: string;
  baseUrl?: string;
  username?: string;
  password?: string;
  enabled?: boolean;
  proxyUrl?: string;
  aria2ProxyUrl?: string;
  verify?: boolean;
}

interface EmbyAuthSession {
  accessToken: string;
  userId: string;
  serverId?: string;
  serverName?: string;
}

interface EmbyAuthenticateResponse {
  AccessToken?: string;
  ServerId?: string;
  User?: {
    Id?: string;
    Name?: string;
  };
  SessionInfo?: {
    ServerId?: string;
  };
}

interface EmbyPublicInfo {
  ServerName?: string;
  LocalAddress?: string;
  WanAddress?: string;
  Version?: string;
}

interface EmbyItemListResponse {
  Items?: EmbyItem[];
  TotalRecordCount?: number;
}

interface EmbyItem {
  Id?: string;
  Name?: string;
  Type?: "Movie" | "Series" | "Episode" | string;
  Container?: string;
  MediaSources?: EmbyMediaSource[];
  SeriesId?: string;
  SeriesName?: string;
  SeasonId?: string;
  SeasonName?: string;
  ParentId?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  ProductionYear?: number;
}

interface EmbyPlaybackInfo {
  MediaSources?: EmbyMediaSource[];
}

interface EmbyMediaSource {
  Id?: string;
  Name?: string;
  Path?: string;
  Container?: string;
  Size?: number | string;
  DirectStreamUrl?: string;
  SupportsDirectStream?: boolean;
  Protocol?: string;
}

class HttpRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string
  ) {
    super(message);
  }
}

export class EmbyService {
  private readonly requestTimeoutMs = readPositiveInteger(
    process.env.EMBY_REQUEST_TIMEOUT_MS,
    30000,
    1000
  );
  private readonly maxResults = readPositiveInteger(process.env.EMBY_MAX_RESULTS, 80, 1);
  private readonly maxSeriesExpansions = readPositiveInteger(
    process.env.EMBY_MAX_SERIES_EXPANSIONS,
    4,
    0
  );
  private readonly maxEpisodesPerSeries = readPositiveInteger(
    process.env.EMBY_MAX_EPISODES_PER_SERIES,
    300,
    1
  );
  private readonly clientName = process.env.EMBY_CLIENT_NAME || "MediaBrain";
  private readonly deviceName = process.env.EMBY_DEVICE_NAME || "Codex";
  private readonly deviceId = process.env.EMBY_DEVICE_ID || "mediabrain-codex";
  private readonly clientVersion = process.env.EMBY_CLIENT_VERSION || "0.1.0";
  private readonly authorizationQuoteStyle = (
    process.env.EMBY_AUTH_QUOTE_STYLE || "quoted"
  ).toLowerCase();
  private readonly httpClient = (process.env.EMBY_HTTP_CLIENT || "undici").toLowerCase();
  private readonly downloadRoot = path.resolve(
    process.env.ARIA2_DOWNLOAD_DIR || path.join(process.cwd(), "downloads")
  );
  private readonly registryPath = path.resolve(
    process.env.EMBY_SERVER_REGISTRY_PATH || path.join(process.cwd(), "data", "emby-servers.json")
  );
  private readonly proxyAgents = new Map<string, Dispatcher>();
  private readonly authSessions = new Map<string, EmbyAuthSession>();
  private servers: EmbyServerConfig[];

  constructor() {
    this.servers = this.loadServers();
  }

  isConfigured(): boolean {
    return this.getEnabledServers().length > 0;
  }

  listServers(): EmbyServerSummary[] {
    return this.servers.map((server) => this.toServerSummary(server));
  }

  async addServer(input: EmbyServerInput): Promise<EmbyServerSummary> {
    const server = this.normalizeServerInput(input);

    if (input.verify !== false) {
      await this.verifyConfig(server);
    }

    const existingIndex = this.servers.findIndex((item) => item.id === server.id);
    if (existingIndex >= 0 && this.servers[existingIndex].readonly) {
      throw new Error("cannot overwrite an environment-configured Emby server");
    }

    if (existingIndex >= 0) {
      this.servers[existingIndex] = server;
      this.authSessions.delete(server.id);
    } else {
      this.servers.push(server);
    }

    this.persistEditableServers();
    return this.toServerSummary(server);
  }

  async health(): Promise<SourceHealth[]> {
    const servers = this.servers;
    if (servers.length === 0) {
      return [
        {
          id: "emby",
          name: "Emby",
          provider: "emby",
          configured: false,
          healthy: false,
          detail: "EMBY_BASE_URL is not configured"
        }
      ];
    }

    return Promise.all(
      servers.map(async (server) => {
        if (!server.enabled) {
          return {
            id: server.id,
            name: server.name,
            provider: "emby" as const,
            configured: true,
            healthy: false,
            detail: "disabled",
            proxyUrl: server.proxyUrl
          };
        }

        try {
          const session = await this.authenticate(server, true);
          return {
            id: server.id,
            name: session.serverName || server.name,
            provider: "emby" as const,
            configured: true,
            healthy: true,
            detail: session.userId ? `user ${server.username}` : "ok",
            proxyUrl: server.proxyUrl
          };
        } catch (error) {
          return {
            id: server.id,
            name: server.name,
            provider: "emby" as const,
            configured: true,
            healthy: false,
            detail: formatError(error),
            proxyUrl: server.proxyUrl
          };
        }
      })
    );
  }

  async searchAll(keyword: string): Promise<OpenListResource[]> {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) {
      return [];
    }

    const servers = this.getEnabledServers();
    if (servers.length === 0) {
      console.log("[EmbyService] no enabled Emby servers configured, returning []");
      return [];
    }

    const resources = (
      await Promise.all(
        servers.map((server) =>
          this.searchServer(server, normalizedKeyword).catch((error) => {
            console.log(`[EmbyService] search ${server.name} failed: ${formatError(error)}`);
            return [] as OpenListResource[];
          })
        )
      )
    ).flat();

    console.log(`[EmbyService] found ${resources.length} video resources`);
    return resources;
  }

  canCreateDownloadTargets(resources: OpenListResource[]): boolean {
    return resources.length > 0 && resources.every((resource) => resource.provider === "emby");
  }

  async createDownloadTargets(resources: OpenListResource[]): Promise<DownloadTarget[]> {
    if (!this.canCreateDownloadTargets(resources)) {
      throw new Error("direct Emby download requires Emby resources");
    }

    return Promise.all(resources.map((resource) => this.createDownloadTarget(resource)));
  }

  private async searchServer(server: EmbyServerConfig, keyword: string): Promise<OpenListResource[]> {
    const session = await this.authenticate(server);
    const searchParams = new URLSearchParams({
      UserId: session.userId,
      Recursive: "true",
      SearchTerm: keyword,
      IncludeItemTypes: "Movie,Series,Episode",
      Fields: [
        "MediaSources",
        "Path",
        "ProviderIds",
        "ParentId",
        "SeriesId",
        "SeriesName",
        "SeasonId",
        "SeasonName",
        "IndexNumber",
        "ParentIndexNumber",
        "ProductionYear"
      ].join(","),
      Limit: String(this.maxResults)
    });

    console.log(`[EmbyService] searching ${server.name}, keyword="${keyword}"`);
    const body = await this.fetchJsonWithFallback<EmbyItemListResponse>(
      server,
      `/Users/${encodeURIComponent(session.userId)}/Items?${searchParams.toString()}`,
      { method: "GET" },
      session
    );

    const items = body.Items || [];
    const resources: OpenListResource[] = [];
    let expandedSeries = 0;

    for (const item of items) {
      if (item.Type === "Series" && item.Id && expandedSeries < this.maxSeriesExpansions) {
        expandedSeries += 1;
        const episodes = await this.fetchSeriesEpisodes(server, session, item.Id).catch((error) => {
          console.log(`[EmbyService] series expansion ${item.Name || item.Id} failed: ${formatError(error)}`);
          return [];
        });
        resources.push(...episodes.flatMap((episode) => this.mapItemToResource(server, episode)));
        continue;
      }

      resources.push(...this.mapItemToResource(server, item));
    }

    return dedupeResources(resources);
  }

  private async fetchSeriesEpisodes(
    server: EmbyServerConfig,
    session: EmbyAuthSession,
    seriesId: string
  ): Promise<EmbyItem[]> {
    const searchParams = new URLSearchParams({
      UserId: session.userId,
      Fields: [
        "MediaSources",
        "Path",
        "ProviderIds",
        "ParentId",
        "SeriesId",
        "SeriesName",
        "SeasonId",
        "SeasonName",
        "IndexNumber",
        "ParentIndexNumber",
        "ProductionYear"
      ].join(","),
      Limit: String(this.maxEpisodesPerSeries)
    });

    const body = await this.fetchJsonWithFallback<EmbyItemListResponse>(
      server,
      `/Shows/${encodeURIComponent(seriesId)}/Episodes?${searchParams.toString()}`,
      { method: "GET" },
      session
    );

    return body.Items || [];
  }

  private mapItemToResource(server: EmbyServerConfig, item: EmbyItem): OpenListResource[] {
    if (!item.Id || (item.Type !== "Movie" && item.Type !== "Episode")) {
      return [];
    }

    const mediaSource = selectMediaSource(item.MediaSources);
    if (!mediaSource) {
      return [];
    }

    const itemType = item.Type as "Movie" | "Episode";
    const container = normalizeContainer(mediaSource.Container || item.Container);
    const name = createDisplayName(item, container);
    const parentFolder =
      itemType === "Episode"
        ? createEpisodeParentFolder(server.id, item)
        : `emby://${server.id}/movie/${item.Id}`;
    const collectionFolder =
      itemType === "Episode"
        ? `emby://${server.id}/series/${item.SeriesId || item.ParentId || "unknown"}`
        : parentFolder;
    const collectionName =
      itemType === "Episode"
        ? item.SeriesName || "Emby Series"
        : item.Name || "Emby Movie";
    const source = server.name;
    const metadata: EmbyResourceMetadata = {
      serverId: server.id,
      itemId: item.Id,
      itemType,
      mediaSourceId: mediaSource.Id,
      container,
      seriesId: item.SeriesId,
      seriesName: item.SeriesName,
      seasonId: item.SeasonId,
      seasonName: item.SeasonName,
      seasonNumber: item.ParentIndexNumber,
      episodeNumber: item.IndexNumber,
      productionYear: item.ProductionYear
    };

    return [
      {
        id: createStableResourceId(source, `${item.Id}:${mediaSource.Id || ""}`),
        name,
        size: toPositiveSize(mediaSource.Size),
        path: `emby://${server.id}/${item.Id}`,
        source,
        type: "video",
        parentFolder,
        collectionFolder,
        collectionName,
        provider: "emby",
        emby: metadata
      }
    ];
  }

  private async createDownloadTarget(resource: OpenListResource): Promise<DownloadTarget> {
    const metadata = resource.emby;
    if (!metadata) {
      throw new Error(`Emby metadata is missing for ${resource.name}`);
    }

    const server = this.findServer(metadata.serverId);
    const session = await this.authenticate(server);
    const playbackInfo = await this.fetchPlaybackInfo(server, session, metadata);
    const mediaSource = selectMediaSource(playbackInfo.MediaSources, metadata.mediaSourceId);
    const output = this.createDownloadOutput(server, resource, mediaSource);
    const url = this.createStreamUrl(server, session, metadata, mediaSource);
    const headers = this.createAria2Headers(server, session);
    const aria2ProxyUrl = server.aria2ProxyUrl || server.proxyUrl;

    console.log(`[EmbyService] direct download link ready: ${resource.name} -> ${url}`);
    return {
      sourcePath: resource.path,
      url,
      outputPath: output.outputPath,
      dir: output.dir,
      out: output.out,
      expectedSize: toPositiveSize(mediaSource?.Size) || resource.size || undefined,
      headers,
      aria2Options: aria2ProxyUrl ? { "all-proxy": aria2ProxyUrl } : undefined
    };
  }

  private async fetchPlaybackInfo(
    server: EmbyServerConfig,
    session: EmbyAuthSession,
    metadata: EmbyResourceMetadata
  ): Promise<EmbyPlaybackInfo> {
    const query = new URLSearchParams({
      UserId: session.userId,
      StartTimeTicks: "0",
      IsPlayback: "true",
      AutoOpenLiveStream: "true",
      MaxStreamingBitrate: "140000000"
    });
    const endpoint = `/Items/${encodeURIComponent(metadata.itemId)}/PlaybackInfo?${query.toString()}`;

    try {
      return await this.fetchJsonWithFallback<EmbyPlaybackInfo>(
        server,
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            UserId: session.userId,
            StartTimeTicks: 0,
            IsPlayback: true,
            AutoOpenLiveStream: true,
            MaxStreamingBitrate: 140000000
          })
        },
        session
      );
    } catch (error) {
      console.log(`[EmbyService] POST PlaybackInfo failed, retrying GET: ${formatError(error)}`);
      return this.fetchJsonWithFallback<EmbyPlaybackInfo>(server, endpoint, { method: "GET" }, session);
    }
  }

  private createStreamUrl(
    server: EmbyServerConfig,
    session: EmbyAuthSession,
    metadata: EmbyResourceMetadata,
    mediaSource?: EmbyMediaSource
  ): string {
    if (mediaSource?.DirectStreamUrl) {
      return this.appendAccessToken(
        this.resolveUrl(server, mediaSource.DirectStreamUrl),
        session.accessToken
      );
    }

    const container = normalizeContainer(mediaSource?.Container || metadata.container) || "mkv";
    const streamUrl = new URL(
      `/Videos/${encodeURIComponent(metadata.itemId)}/stream.${encodeURIComponent(container)}`,
      `${server.baseUrl}/`
    );
    streamUrl.searchParams.set("Static", "true");
    streamUrl.searchParams.set("api_key", session.accessToken);
    streamUrl.searchParams.set("DeviceId", this.deviceId);
    if (mediaSource?.Id || metadata.mediaSourceId) {
      streamUrl.searchParams.set("MediaSourceId", mediaSource?.Id || metadata.mediaSourceId || "");
    }

    return streamUrl.toString();
  }

  private appendAccessToken(url: string, accessToken: string): string {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("api_key")) {
      parsed.searchParams.set("api_key", accessToken);
    }
    return parsed.toString();
  }

  private createDownloadOutput(
    server: EmbyServerConfig,
    resource: OpenListResource,
    mediaSource?: EmbyMediaSource
  ): { outputPath: string; dir: string; out: string } {
    const metadata = resource.emby;
    const container = normalizeContainer(mediaSource?.Container || metadata?.container) || "mkv";
    const extension = `.${container}`;
    const serverName = sanitizeLocalPathSegment(server.name);

    if (metadata?.itemType === "Episode") {
      const seriesName = sanitizeLocalPathSegment(metadata.seriesName || resource.collectionName || "Series");
      const seasonNumber = metadata.seasonNumber && metadata.seasonNumber > 0 ? metadata.seasonNumber : 1;
      const seasonDir = `Season ${String(seasonNumber).padStart(2, "0")}`;
      const out = sanitizeLocalPathSegment(createEpisodeFileName(resource.name, metadata, extension));
      const dir = path.join(this.downloadRoot, "emby", serverName, seriesName, seasonDir);
      return {
        outputPath: path.join(dir, out),
        dir,
        out
      };
    }

    const out = sanitizeLocalPathSegment(ensureExtension(resource.name, extension));
    const dir = path.join(this.downloadRoot, "emby", serverName, "Movies");
    return {
      outputPath: path.join(dir, out),
      dir,
      out
    };
  }

  private createAria2Headers(server: EmbyServerConfig, session: EmbyAuthSession): string[] {
    return [
      `X-Emby-Token: ${session.accessToken}`,
      `X-MediaBrowser-Token: ${session.accessToken}`,
      `X-Emby-Authorization: ${this.createAuthorizationValue(server)}`,
      `User-Agent: ${this.clientName}/${this.clientVersion}`
    ];
  }

  private async verifyConfig(server: EmbyServerConfig): Promise<void> {
    await this.fetchPublicInfo(server).catch((error) => {
      console.log(`[EmbyService] public info check failed for ${server.name}: ${formatError(error)}`);
      return null;
    });
    await this.authenticate(server, true);
  }

  private async fetchPublicInfo(server: EmbyServerConfig): Promise<EmbyPublicInfo> {
    return this.fetchJsonWithFallback<EmbyPublicInfo>(server, "/System/Info/Public", {
      method: "GET"
    });
  }

  private async authenticate(server: EmbyServerConfig, force = false): Promise<EmbyAuthSession> {
    if (!force) {
      const cached = this.authSessions.get(server.id);
      if (cached) {
        return cached;
      }
    }

    const response = await this.fetchJsonWithFallback<EmbyAuthenticateResponse>(
      server,
      "/Users/AuthenticateByName",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          Username: server.username,
          Pw: server.password
        })
      }
    );

    const accessToken = response.AccessToken;
    const userId = response.User?.Id;
    if (!accessToken || !userId) {
      throw new Error("Emby login returned no access token or user id");
    }

    let serverName: string | undefined;
    try {
      const publicInfo = await this.fetchPublicInfo(server);
      serverName = publicInfo.ServerName;
    } catch {
      serverName = undefined;
    }

    const session: EmbyAuthSession = {
      accessToken,
      userId,
      serverId: response.ServerId || response.SessionInfo?.ServerId,
      serverName
    };
    this.authSessions.set(server.id, session);
    return session;
  }

  private async fetchJsonWithFallback<T>(
    server: EmbyServerConfig,
    endpoint: string,
    init: RequestInit,
    session?: EmbyAuthSession
  ): Promise<T> {
    try {
      return await this.fetchJson<T>(server, endpoint, init, session);
    } catch (error) {
      if (error instanceof HttpRequestError && error.status === 404 && !endpoint.startsWith("/emby/")) {
        return this.fetchJson<T>(server, `/emby${endpoint}`, init, session);
      }
      throw error;
    }
  }

  private async fetchJson<T>(
    server: EmbyServerConfig,
    endpoint: string,
    init: RequestInit,
    session?: EmbyAuthSession
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("X-Emby-Authorization", this.createAuthorizationValue(server));
    if (session?.accessToken) {
      headers.set("X-Emby-Token", session.accessToken);
      headers.set("X-MediaBrowser-Token", session.accessToken);
    }

    if (this.httpClient === "curl") {
      return this.fetchJsonWithCurl<T>(server, endpoint, init, headers);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await undiciFetch(this.resolveUrl(server, endpoint), {
        ...init,
        headers,
        dispatcher: this.getDispatcher(server.proxyUrl),
        signal: controller.signal
      });
      const text = await response.text();

      if (!response.ok) {
        throw new HttpRequestError(
          `HTTP ${response.status} ${response.statusText}: ${extractErrorMessage(text)}`,
          response.status,
          text
        );
      }

      return (text ? JSON.parse(text) : {}) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchJsonWithCurl<T>(
    server: EmbyServerConfig,
    endpoint: string,
    init: RequestInit,
    headers: Headers
  ): Promise<T> {
    const url = this.resolveUrl(server, endpoint);
    const args = [
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      String(Math.ceil(this.requestTimeoutMs / 1000)),
      "--write-out",
      "\n__MEDIABRAIN_HTTP_STATUS__:%{http_code}",
      "--request",
      init.method || "GET"
    ];

    if (server.proxyUrl) {
      args.push("--proxy", server.proxyUrl);
    }

    headers.forEach((value, key) => {
      args.push("--header", `${key}: ${value}`);
    });

    let bodyFile: string | undefined;
    if (init.body !== undefined && init.body !== null) {
      if (typeof init.body !== "string") {
        throw new Error("curl Emby client only supports string request bodies");
      }

      const tempDirectory = path.join(tmpdir(), `mediabrain-emby-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      await mkdir(tempDirectory, { recursive: true });
      bodyFile = path.join(tempDirectory, "body.json");
      await writeFile(bodyFile, init.body, "utf8");
      args.push("--data-binary", `@${bodyFile}`);
    }

    args.push(url);

    try {
      const { stdout } = await execFileAsync(getCurlCommand(), args, {
        encoding: "utf8",
        timeout: this.requestTimeoutMs + 5000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true
      });
      const marker = "\n__MEDIABRAIN_HTTP_STATUS__:";
      const markerIndex = stdout.lastIndexOf(marker);
      if (markerIndex < 0) {
        throw new Error("curl response did not include HTTP status");
      }

      const text = stdout.slice(0, markerIndex);
      const status = Number(stdout.slice(markerIndex + marker.length).trim());
      if (status < 200 || status >= 300) {
        throw new HttpRequestError(`HTTP ${status}: ${extractErrorMessage(text)}`, status, text);
      }

      return (text ? JSON.parse(text) : {}) as T;
    } catch (error) {
      if (error instanceof HttpRequestError) {
        throw error;
      }

      const stderr = typeof (error as { stderr?: unknown }).stderr === "string"
        ? String((error as { stderr?: unknown }).stderr).trim()
        : "";
      throw new Error(stderr || formatError(error));
    } finally {
      if (bodyFile) {
        await rm(path.dirname(bodyFile), { recursive: true, force: true });
      }
    }
  }

  private resolveUrl(server: EmbyServerConfig, endpoint: string): string {
    return new URL(endpoint, `${server.baseUrl}/`).toString();
  }

  private createAuthorizationValue(server: EmbyServerConfig): string {
    const fields = [
      ["Client", this.clientName],
      ["Device", this.deviceName],
      ["DeviceId", this.deviceId],
      ["Version", this.clientVersion]
    ];
    const fieldText = fields
      .map(([key, value]) => `${key}=${this.formatAuthorizationValue(value)}`)
      .join(", ");

    return `MediaBrowser ${fieldText}`;
  }

  private formatAuthorizationValue(value: string): string {
    const escapedValue = escapeHeaderValue(value);

    if (this.authorizationQuoteStyle === "none") {
      return escapedValue;
    }

    if (this.authorizationQuoteStyle === "escaped") {
      return `\\"${escapedValue}\\"`;
    }

    return `"${escapedValue}"`;
  }

  private getDispatcher(proxyUrl: string | undefined): Dispatcher | undefined {
    if (!proxyUrl) {
      return undefined;
    }

    const normalized = proxyUrl.trim();
    if (!normalized) {
      return undefined;
    }

    let dispatcher = this.proxyAgents.get(normalized);
    if (!dispatcher) {
      dispatcher = new ProxyAgent(normalized);
      this.proxyAgents.set(normalized, dispatcher);
    }

    return dispatcher;
  }

  private findServer(serverId: string): EmbyServerConfig {
    const server = this.servers.find((item) => item.id === serverId);
    if (!server || !server.enabled) {
      throw new Error(`Emby server ${serverId} is not configured or disabled`);
    }

    return server;
  }

  private getEnabledServers(): EmbyServerConfig[] {
    return this.servers.filter((server) => server.enabled);
  }

  private loadServers(): EmbyServerConfig[] {
    const servers = [...this.loadEnvServers(), ...this.loadRegistryServers()];
    const deduped = new Map<string, EmbyServerConfig>();

    for (const server of servers) {
      if (!deduped.has(server.id)) {
        deduped.set(server.id, server);
      }
    }

    return Array.from(deduped.values());
  }

  private loadEnvServers(): EmbyServerConfig[] {
    const fromJson = parseJsonArray<EmbyServerInput>(process.env.EMBY_SERVERS_JSON).map((input) =>
      this.normalizeServerInput({ ...input, verify: false })
    );

    for (const server of fromJson) {
      server.readonly = true;
    }

    const baseUrl = process.env.EMBY_BASE_URL?.trim();
    const username = process.env.EMBY_USERNAME?.trim();
    const password = process.env.EMBY_PASSWORD ?? "";
    if (!baseUrl || !username) {
      return fromJson;
    }

    const name = process.env.EMBY_SOURCE_NAME || process.env.EMBY_SERVER_NAME || "Emby";
    const single: EmbyServerConfig = {
      id: process.env.EMBY_SERVER_ID || createServerId(baseUrl, username),
      name,
      baseUrl: normalizeBaseUrl(baseUrl),
      username,
      password,
      enabled: (process.env.EMBY_ENABLED || "true").toLowerCase() !== "false",
      proxyUrl: optionalString(process.env.EMBY_PROXY_URL),
      aria2ProxyUrl: optionalString(process.env.EMBY_ARIA2_PROXY_URL || process.env.EMBY_PROXY_URL),
      readonly: true
    };

    return [...fromJson, single];
  }

  private loadRegistryServers(): EmbyServerConfig[] {
    if (!existsSync(this.registryPath)) {
      return [];
    }

    try {
      const parsed = JSON.parse(readFileSync(this.registryPath, "utf8")) as EmbyServerInput[];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map((input) => this.normalizeServerInput({ ...input, verify: false }));
    } catch (error) {
      console.log(`[EmbyService] failed to read ${this.registryPath}: ${formatError(error)}`);
      return [];
    }
  }

  private persistEditableServers(): void {
    const editableServers = this.servers
      .filter((server) => !server.readonly)
      .map((server) => ({
        id: server.id,
        name: server.name,
        baseUrl: server.baseUrl,
        username: server.username,
        password: server.password,
        enabled: server.enabled,
        proxyUrl: server.proxyUrl,
        aria2ProxyUrl: server.aria2ProxyUrl
      }));
    mkdirSync(path.dirname(this.registryPath), { recursive: true });
    writeFileSync(this.registryPath, `${JSON.stringify(editableServers, null, 2)}\n`, "utf8");
  }

  private normalizeServerInput(input: EmbyServerInput): EmbyServerConfig {
    const baseUrl = normalizeBaseUrl(requiredString(input.baseUrl, "baseUrl"));
    const username = requiredString(input.username, "username");
    const password = input.password ?? "";
    const id = input.id?.trim() || createServerId(baseUrl, username);

    return {
      id,
      name: input.name?.trim() || new URL(baseUrl).hostname,
      baseUrl,
      username,
      password,
      enabled: input.enabled !== false,
      proxyUrl: optionalString(input.proxyUrl),
      aria2ProxyUrl: optionalString(input.aria2ProxyUrl || input.proxyUrl)
    };
  }

  private toServerSummary(server: EmbyServerConfig): EmbyServerSummary {
    return {
      id: server.id,
      name: server.name,
      baseUrl: server.baseUrl,
      username: server.username,
      enabled: server.enabled,
      hasPassword: Boolean(server.password),
      proxyUrl: server.proxyUrl,
      aria2ProxyUrl: server.aria2ProxyUrl,
      readonly: server.readonly
    };
  }
}

function selectMediaSource(
  mediaSources: EmbyMediaSource[] | undefined,
  preferredId?: string
): EmbyMediaSource | undefined {
  if (!mediaSources?.length) {
    return undefined;
  }

  if (preferredId) {
    const preferred = mediaSources.find((source) => source.Id === preferredId);
    if (preferred) {
      return preferred;
    }
  }

  return (
    mediaSources.find((source) => source.SupportsDirectStream) ||
    mediaSources.find((source) => source.Protocol === "File") ||
    mediaSources[0]
  );
}

function createDisplayName(item: EmbyItem, container: string | undefined): string {
  const extension = container ? `.${container}` : ".mkv";
  if (item.Type === "Episode") {
    const episodePrefix =
      item.ParentIndexNumber && item.IndexNumber
        ? `S${String(item.ParentIndexNumber).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} - `
        : "";
    return ensureExtension(`${episodePrefix}${item.Name || item.Id || "Episode"}`, extension);
  }

  const year = item.ProductionYear ? ` (${item.ProductionYear})` : "";
  return ensureExtension(`${item.Name || item.Id || "Movie"}${year}`, extension);
}

function createEpisodeParentFolder(serverId: string, item: EmbyItem): string {
  const seriesId = item.SeriesId || item.ParentId || "unknown";
  const seasonKey = item.ParentIndexNumber ? `season-${item.ParentIndexNumber}` : item.SeasonId || "season";
  return `emby://${serverId}/series/${seriesId}/${seasonKey}`;
}

function createEpisodeFileName(
  resourceName: string,
  metadata: EmbyResourceMetadata,
  extension: string
): string {
  if (metadata.seasonNumber && metadata.episodeNumber) {
    const prefix = `S${String(metadata.seasonNumber).padStart(2, "0")}E${String(metadata.episodeNumber).padStart(2, "0")}`;
    const baseName = stripExtension(resourceName).replace(/^S\d{2}E\d{2}\s*-\s*/i, "");
    return ensureExtension(`${prefix} - ${baseName}`, extension);
  }

  return ensureExtension(resourceName, extension);
}

function ensureExtension(value: string, extension: string): string {
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  if (path.extname(value)) {
    return value;
  }

  return `${value}${normalizedExtension}`;
}

function stripExtension(value: string): string {
  return value.replace(/\.[^.]+$/, "");
}

function normalizeContainer(value: string | undefined): string | undefined {
  const container = value?.split(",")[0]?.trim().toLowerCase();
  if (!container) {
    return undefined;
  }

  if (container === "matroska") {
    return "mkv";
  }

  return container.replace(/[^a-z0-9]/g, "") || undefined;
}

function normalizeBaseUrl(value: string): string {
  const parsed = new URL(value);
  return parsed.toString().replace(/\/+$/, "");
}

function optionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function requiredString(value: string | undefined, fieldName: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }
  return trimmed;
}

function createServerId(baseUrl: string, username: string): string {
  return createHash("sha1").update(`${baseUrl}:${username}`).digest("hex").slice(0, 12);
}

function parseJsonArray<T>(value: string | undefined): T[] {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    console.log(`[EmbyService] EMBY_SERVERS_JSON parse failed: ${formatError(error)}`);
    return [];
  }
}

function extractErrorMessage(value: string): string {
  if (!value.trim()) {
    return "empty response";
  }

  try {
    const parsed = JSON.parse(value) as {
      Message?: unknown;
      message?: unknown;
      error?: unknown;
    };
    return String(parsed.Message || parsed.message || parsed.error || value);
  } catch {
    return value.slice(0, 200);
  }
}

function escapeHeaderValue(value: string): string {
  return value.replace(/["\\]/g, "");
}

function getCurlCommand(): string {
  return process.platform === "win32" ? "curl.exe" : "curl";
}

function toPositiveSize(value: unknown): number {
  const size = Number(value || 0);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

function sanitizeLocalPathSegment(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  return sanitized || "unnamed";
}

function dedupeResources(resources: OpenListResource[]): OpenListResource[] {
  const map = new Map<string, OpenListResource>();
  for (const resource of resources) {
    map.set(resource.id, resource);
  }
  return Array.from(map.values());
}

function readPositiveInteger(value: string | undefined, fallback: number, minimum: number): number {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, parsed);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
