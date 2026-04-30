export function renderUiPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MediaBrain</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fa;
      --surface: #ffffff;
      --surface-soft: #f1f5f9;
      --text: #172033;
      --muted: #64748b;
      --line: #d9e0ea;
      --accent: #2563eb;
      --accent-strong: #1d4ed8;
      --green: #15803d;
      --amber: #b45309;
      --red: #b91c1c;
      --violet: #6d28d9;
      --shadow: 0 16px 48px rgba(15, 23, 42, 0.08);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }

    button,
    input {
      font: inherit;
    }

    button {
      border: 0;
      cursor: pointer;
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .shell {
      width: min(1120px, calc(100% - 40px));
      margin: 0 auto;
      padding: 28px 0 40px;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 22px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .brand-mark {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      background: #111827;
      color: #ffffff;
      display: grid;
      place-items: center;
      font-weight: 800;
      letter-spacing: 0;
      flex: 0 0 auto;
    }

    h1,
    h2,
    h3,
    p {
      margin: 0;
    }

    h1 {
      font-size: 22px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .top-meta {
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }

    .stack {
      display: grid;
      gap: 18px;
    }

    .panel {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
      overflow: hidden;
      animation: enter 220ms ease-out both;
    }

    .panel-header {
      min-height: 58px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
    }

    .panel-header h2 {
      font-size: 16px;
      letter-spacing: 0;
    }

    .panel-body {
      padding: 18px;
    }

    .search-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
    }

    .input {
      width: 100%;
      height: 42px;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: #ffffff;
      padding: 0 13px;
      color: var(--text);
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease;
    }

    .input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.14);
    }

    .button {
      height: 42px;
      min-width: 86px;
      border-radius: 8px;
      padding: 0 16px;
      background: var(--accent);
      color: #ffffff;
      font-weight: 700;
      transition: background 160ms ease, transform 160ms ease;
    }

    .button:hover:not(:disabled) {
      background: var(--accent-strong);
      transform: translateY(-1px);
    }

    .button.secondary {
      background: #e2e8f0;
      color: #172033;
    }

    .button.secondary:hover:not(:disabled) {
      background: #cbd5e1;
    }

    .status-line {
      min-height: 22px;
      color: var(--muted);
      font-size: 13px;
      margin-top: 12px;
    }

    .result-list,
    .task-list,
    .path-list,
    .error-list {
      display: grid;
      gap: 10px;
    }

    .result-list {
      max-height: none;
      overflow: visible;
      padding-right: 0;
    }

    .candidate-section {
      display: grid;
      gap: 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #f8fafc;
      overflow: hidden;
    }

    .candidate-section + .candidate-section {
      margin-top: 4px;
    }

    .candidate-section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-width: 0;
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
    }

    .candidate-section-title h3 {
      font-size: 14px;
      font-weight: 900;
      overflow-wrap: anywhere;
    }

    .candidate-section-body {
      display: grid;
      gap: 10px;
      max-height: 420px;
      overflow: auto;
      padding: 12px;
    }

    .row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
      transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
    }

    .row:hover {
      border-color: #b7c4d8;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
      transform: translateY(-1px);
    }

    .row-title {
      overflow-wrap: anywhere;
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
    }

    .row-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 7px;
      color: var(--muted);
      font-size: 12px;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      border-radius: 999px;
      padding: 2px 9px;
      background: var(--surface-soft);
      color: #475569;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }

    .pill.green {
      background: #dcfce7;
      color: var(--green);
    }

    .pill.amber {
      background: #fef3c7;
      color: var(--amber);
    }

    .pill.red {
      background: #fee2e2;
      color: var(--red);
    }

    .pill.blue {
      background: #dbeafe;
      color: var(--accent-strong);
    }

    .pill.violet {
      background: #ede9fe;
      color: var(--violet);
    }

    .select-button {
      height: 34px;
      min-width: 92px;
      border-radius: 8px;
      padding: 0 12px;
      background: #111827;
      color: #ffffff;
      font-weight: 700;
      transition: transform 160ms ease, background 160ms ease;
    }

    .select-button:hover:not(:disabled) {
      background: #263244;
      transform: translateY(-1px);
    }

    .task-item {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: #ffffff;
    }

    .task-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .task-title {
      min-width: 0;
      font-size: 14px;
      font-weight: 800;
      overflow-wrap: anywhere;
    }

    .task-sub {
      color: var(--muted);
      font-size: 12px;
      margin-top: 5px;
      overflow-wrap: anywhere;
    }

    .task-summary {
      display: grid;
      gap: 7px;
      margin-top: 12px;
      padding: 10px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
    }

    .summary-row,
    .progress-file-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-width: 0;
    }

    .summary-main {
      color: #334155;
      font-size: 12px;
      font-weight: 800;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .summary-side {
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }

    .download-progress {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }

    .progress-line {
      display: grid;
      gap: 7px;
      padding: 9px 10px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
    }

    .progress-line.active {
      border-color: #bfdbfe;
      background: #f8fbff;
    }

    .progress-line.complete {
      border-color: #bbf7d0;
      background: #f7fff9;
    }

    .progress-line.error {
      border-color: #fecaca;
      background: #fff7f7;
    }

    .progress-file-name {
      min-width: 0;
      color: #172033;
      font-size: 12px;
      font-weight: 800;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .progress-meta {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      color: var(--muted);
      font-size: 12px;
    }

    .progress-muted {
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .progress-toggle {
      width: 100%;
      min-height: 32px;
      border-radius: 8px;
      background: #f1f5f9;
      color: #334155;
      font-size: 12px;
      font-weight: 800;
      transition: background 160ms ease;
    }

    .progress-toggle:hover {
      background: #e2e8f0;
    }

    .progress-bar {
      height: 7px;
      border-radius: 999px;
      background: #e2e8f0;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      width: 0;
      border-radius: inherit;
      background: var(--green);
      transition: width 360ms ease;
    }

    .empty {
      min-height: 96px;
      display: grid;
      place-items: center;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      color: var(--muted);
      text-align: center;
      font-size: 13px;
    }

    .path-item,
    .error-item {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 11px 12px;
      background: #ffffff;
      overflow-wrap: anywhere;
      font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      line-height: 1.55;
    }

    .error-item {
      border-color: #fecaca;
      background: #fff7f7;
      color: var(--red);
    }

    .toolbar {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }

    .source-list {
      display: grid;
      gap: 10px;
    }

    .source-row,
    .server-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 11px 12px;
      background: #ffffff;
    }

    .source-title {
      min-width: 0;
      font-size: 13px;
      font-weight: 800;
      overflow-wrap: anywhere;
    }

    .source-meta {
      margin-top: 4px;
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .server-list {
      display: grid;
      gap: 10px;
    }

    .server-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .server-actions .icon-button {
      width: 32px;
      height: 32px;
    }

    .divider {
      height: 1px;
      background: var(--line);
    }

    .button.danger {
      background: var(--red);
    }

    .button.danger:hover:not(:disabled) {
      background: #991b1b;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 30;
      display: grid;
      place-items: center;
      padding: 18px;
      background: rgba(15, 23, 42, 0.38);
    }

    .modal-backdrop[hidden] {
      display: none;
    }

    .modal {
      width: min(560px, 100%);
      max-height: min(720px, calc(100vh - 36px));
      overflow: auto;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: #ffffff;
      box-shadow: 0 24px 72px rgba(15, 23, 42, 0.24);
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid var(--line);
    }

    .modal-header h2 {
      font-size: 16px;
    }

    .modal-body {
      display: grid;
      gap: 14px;
      padding: 18px;
    }

    .field {
      display: grid;
      gap: 6px;
    }

    .field label,
    .checkbox-row {
      color: #334155;
      font-size: 12px;
      font-weight: 800;
    }

    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .checkbox-row input {
      width: 16px;
      height: 16px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 2px;
    }

    .icon-button {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: #e2e8f0;
      color: #172033;
      display: grid;
      place-items: center;
      font-weight: 800;
      transition: background 160ms ease, transform 160ms ease;
    }

    .icon-button:hover:not(:disabled) {
      background: #cbd5e1;
      transform: translateY(-1px);
    }

    .loading {
      position: relative;
      overflow: hidden;
    }

    .loading::after {
      content: "";
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.55), transparent);
      animation: sweep 1300ms infinite;
    }

    @keyframes enter {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes fill {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(0);
      }
    }

    @keyframes sweep {
      to {
        transform: translateX(100%);
      }
    }

    @media (max-width: 980px) {
      .shell {
        width: min(100% - 24px, 1440px);
        padding-top: 18px;
      }

      .layout {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .topbar {
        align-items: flex-start;
        flex-direction: column;
      }

      .top-meta {
        white-space: normal;
      }

      .search-form,
      .row {
        grid-template-columns: 1fr;
      }

      .button,
      .select-button {
        width: 100%;
      }

      .panel-header {
        align-items: flex-start;
        flex-direction: column;
      }

      .toolbar {
        width: 100%;
        justify-content: flex-start;
      }

      .summary-row,
      .progress-file-row,
      .source-row,
      .server-row,
      .progress-meta {
        align-items: flex-start;
        flex-direction: column;
      }

      .summary-side {
        white-space: normal;
      }

      .progress-file-name {
        white-space: normal;
      }

      .form-actions {
        flex-direction: column;
      }

      .server-actions {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">MB</div>
        <h1>MediaBrain</h1>
      </div>
      <div class="top-meta" id="clock"></div>
    </header>

    <div class="layout">
      <div class="stack">
        <section class="panel">
          <div class="panel-header">
            <h2>搜索</h2>
          </div>
          <div class="panel-body">
            <form class="search-form" id="searchForm">
              <input class="input" id="keywordInput" name="keyword" placeholder="搜索影片或剧集" autocomplete="off" />
              <button class="button" id="searchButton" type="submit">搜索</button>
            </form>
            <div class="status-line" id="searchStatus"></div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2>候选资源</h2>
            <span class="pill blue" id="candidateCount">0 个候选</span>
          </div>
          <div class="panel-body">
            <div class="result-list" id="resultList">
              <div class="empty">等待搜索</div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2>下载任务监控</h2>
            <div class="toolbar">
              <button class="icon-button" id="refreshTasks" type="button" title="刷新">↻</button>
            </div>
          </div>
          <div class="panel-body">
            <div class="task-list" id="taskList">
              <div class="empty">暂无任务</div>
            </div>
          </div>
        </section>
      </div>

      <div class="stack">
        <section class="panel">
          <div class="panel-header">
            <h2>资源状态</h2>
            <div class="toolbar">
              <button class="icon-button" id="refreshSources" type="button" title="刷新">↻</button>
              <button class="icon-button" id="manageEmby" type="button" title="管理 Emby">＋</button>
            </div>
          </div>
          <div class="panel-body">
            <div class="source-list" id="sourceStatusList">
              <div class="empty">正在检测资源状态</div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2>整理</h2>
            <span class="pill" id="organizeState">待处理</span>
          </div>
          <div class="panel-body">
            <div class="path-list" id="organizeList">
              <div class="empty">暂无整理结果</div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h2>错误信息</h2>
            <button class="icon-button" id="clearErrors" type="button" title="清空">×</button>
          </div>
          <div class="panel-body">
            <div class="error-list" id="errorList">
              <div class="empty">暂无错误</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </main>

  <div class="modal-backdrop" id="embyModal" hidden>
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="embyModalTitle">
      <div class="modal-header">
        <h2 id="embyModalTitle">Emby 服务器</h2>
        <button class="icon-button" id="closeEmbyModal" type="button" title="关闭">×</button>
      </div>
      <form class="modal-body" id="embyForm">
        <div class="server-list" id="embyServerList">
          <div class="empty">正在读取 Emby 服务器</div>
        </div>
        <div class="form-actions">
          <button class="button secondary" id="newEmbyServer" type="button">新增服务器</button>
        </div>
        <div class="divider"></div>
        <input id="embyServerId" name="id" type="hidden" />
        <div class="field">
          <label for="embyName">名称</label>
          <input class="input" id="embyName" name="name" autocomplete="off" placeholder="渔云Emby" />
        </div>
        <div class="field">
          <label for="embyBaseUrl">服务器地址</label>
          <input class="input" id="embyBaseUrl" name="baseUrl" autocomplete="off" placeholder="https://example.com:443" required />
        </div>
        <div class="field">
          <label for="embyUsername">用户名</label>
          <input class="input" id="embyUsername" name="username" autocomplete="username" required />
        </div>
        <div class="field">
          <label for="embyPassword">密码</label>
          <input class="input" id="embyPassword" name="password" type="password" autocomplete="current-password" />
        </div>
        <div class="field">
          <label for="embyProxyUrl">API 代理</label>
          <input class="input" id="embyProxyUrl" name="proxyUrl" autocomplete="off" placeholder="http://192.168.1.11:1080" />
        </div>
        <div class="field">
          <label for="embyAria2ProxyUrl">下载代理</label>
          <input class="input" id="embyAria2ProxyUrl" name="aria2ProxyUrl" autocomplete="off" placeholder="http://192.168.1.11:1080" />
        </div>
        <label class="checkbox-row">
          <input id="embyEnabled" name="enabled" type="checkbox" checked />
          启用
        </label>
        <div class="status-line" id="embyFormStatus"></div>
        <div class="form-actions">
          <button class="button danger" id="deleteEmbyForm" type="button">删除</button>
          <button class="button secondary" id="cancelEmbyForm" type="button">取消</button>
          <button class="button" id="saveEmbyForm" type="submit">保存并验证</button>
        </div>
      </form>
    </section>
  </div>

  <script>
    (function () {
      var state = {
        currentTaskId: null,
        currentTask: null,
        currentKeyword: "",
        currentCandidates: [],
        hasSearched: false,
        tasks: [],
        expandedTasks: {},
        errors: [],
        sourceHealth: [],
        embyServers: [],
        polling: null,
        searching: false,
        selectingId: null
      };

      var els = {
        clock: document.getElementById("clock"),
        searchForm: document.getElementById("searchForm"),
        keywordInput: document.getElementById("keywordInput"),
        searchButton: document.getElementById("searchButton"),
        searchStatus: document.getElementById("searchStatus"),
        resultList: document.getElementById("resultList"),
        candidateCount: document.getElementById("candidateCount"),
        taskList: document.getElementById("taskList"),
        refreshTasks: document.getElementById("refreshTasks"),
        organizeState: document.getElementById("organizeState"),
        organizeList: document.getElementById("organizeList"),
        errorList: document.getElementById("errorList"),
        clearErrors: document.getElementById("clearErrors"),
        sourceStatusList: document.getElementById("sourceStatusList"),
        refreshSources: document.getElementById("refreshSources"),
        manageEmby: document.getElementById("manageEmby"),
        embyModal: document.getElementById("embyModal"),
        closeEmbyModal: document.getElementById("closeEmbyModal"),
        cancelEmbyForm: document.getElementById("cancelEmbyForm"),
        newEmbyServer: document.getElementById("newEmbyServer"),
        deleteEmbyForm: document.getElementById("deleteEmbyForm"),
        embyForm: document.getElementById("embyForm"),
        embyServerList: document.getElementById("embyServerList"),
        embyServerId: document.getElementById("embyServerId"),
        embyName: document.getElementById("embyName"),
        embyBaseUrl: document.getElementById("embyBaseUrl"),
        embyUsername: document.getElementById("embyUsername"),
        embyPassword: document.getElementById("embyPassword"),
        embyProxyUrl: document.getElementById("embyProxyUrl"),
        embyAria2ProxyUrl: document.getElementById("embyAria2ProxyUrl"),
        embyEnabled: document.getElementById("embyEnabled"),
        embyFormStatus: document.getElementById("embyFormStatus"),
        saveEmbyForm: document.getElementById("saveEmbyForm")
      };

      var STATUS_WAITING = "\u7b49\u5f85\u9009\u62e9\u8d44\u6e90";
      var STATUS_SELECTED = "\u5df2\u9009\u62e9\u8d44\u6e90";
      var STATUS_TRANSFERRING = "\u8f6c\u5b58\u4e2d";
      var STATUS_DOWNLOADING = "\u4e0b\u8f7d\u4e2d";
      var STATUS_DOWNLOAD_DONE = "\u4e0b\u8f7d\u5b8c\u6210";
      var STATUS_DONE = "\u5df2\u5b8c\u6210";
      var STATUS_FAILED = "\u5931\u8d25";
      var STATUS_ORGANIZE_FAILED = "\u6574\u7406\u5931\u8d25";
      var activeStatuses = [STATUS_SELECTED, STATUS_TRANSFERRING, STATUS_DOWNLOADING];

      function escapeHtml(value) {
        return String(value == null ? "" : value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function requestJson(url, options) {
        return fetch(url, options || {}).then(function (response) {
          return response.text().then(function (text) {
            var payload = text ? JSON.parse(text) : null;
            if (!response.ok) {
              throw new Error(payload && payload.error ? payload.error : response.statusText);
            }
            return payload;
          });
        });
      }

      function addError(message) {
        var item = {
          message: message,
          time: new Date().toLocaleString()
        };
        state.errors.unshift(item);
        state.errors = state.errors.slice(0, 8);
        renderErrors();
      }

      function setSearchBusy(isBusy) {
        state.searching = isBusy;
        els.searchButton.disabled = isBusy;
        els.keywordInput.disabled = isBusy;
        els.searchForm.classList.toggle("loading", isBusy);
      }

      function statusClass(status) {
        if (status === STATUS_DONE || status === STATUS_DOWNLOAD_DONE) return "green";
        if (status === STATUS_FAILED || status === STATUS_ORGANIZE_FAILED) return "red";
        if (status === STATUS_DOWNLOADING) return "blue";
        if (status === STATUS_TRANSFERRING || status === STATUS_SELECTED) return "amber";
        return "violet";
      }

      function isDownloadComplete(task) {
        if (Array.isArray(task.downloadPaths) && task.downloadPaths.length) {
          return true;
        }

        if (task.error) {
          return false;
        }

        var progressItems = Array.isArray(task.downloadProgress) ? task.downloadProgress : [];
        return progressItems.length > 0 && progressItems.every(function (progress) {
          return progress.status === "complete" || Number(progress.progress || 0) >= 100;
        });
      }

      function downloadStatus(task) {
        return isDownloadComplete(task) ? STATUS_DOWNLOAD_DONE : task.status;
      }

      function organizeStatus(task) {
        return task.error && isDownloadComplete(task) ? STATUS_ORGANIZE_FAILED : task.status;
      }

      function formatDate(value) {
        if (!value) return "";
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleString();
      }

      function formatBytes(value) {
        var size = Number(value || 0);
        if (!Number.isFinite(size) || size <= 0) return "0 B";
        var units = ["B", "KB", "MB", "GB", "TB"];
        var index = 0;
        while (size >= 1024 && index < units.length - 1) {
          size = size / 1024;
          index += 1;
        }
        var precision = index === 0 ? 0 : size >= 10 ? 1 : 2;
        return size.toFixed(precision) + " " + units[index];
      }

      function getSelectedCandidate(task) {
        if (!task || !task.selectedResourceId) return null;
        return (task.candidates || []).find(function (candidate) {
          return candidate.id === task.selectedResourceId;
        }) || null;
      }

      function getFileName(filePath) {
        var raw = String(filePath || "");
        var normalized = raw.replace(/\\\\/g, "/");
        var name = normalized.slice(normalized.lastIndexOf("/") + 1) || raw || "\u672a\u77e5\u6587\u4ef6";
        try {
          return decodeURIComponent(name);
        } catch (error) {
          return name;
        }
      }

      function progressStatusLabel(status) {
        if (status === "active") return "\u4e0b\u8f7d\u4e2d";
        if (status === "waiting") return "\u7b49\u5f85";
        if (status === "paused") return "\u6682\u505c";
        if (status === "complete") return "\u5b8c\u6210";
        if (status === "error") return "\u9519\u8bef";
        if (status === "removed") return "\u5df2\u79fb\u9664";
        return status || "\u672a\u77e5";
      }

      function progressStatusClass(status) {
        if (status === "active") return "active";
        if (status === "complete") return "complete";
        if (status === "error" || status === "removed") return "error";
        return "";
      }

      function progressPillClass(status) {
        if (status === "active") return "blue";
        if (status === "complete") return "green";
        if (status === "error" || status === "removed") return "red";
        if (status === "paused") return "amber";
        return "";
      }

      function isInterestingProgress(progress) {
        if (!progress) return false;
        if (progress.status !== "waiting") return true;
        return Number(progress.completedLength || 0) > 0 || Number(progress.downloadSpeed || 0) > 0;
      }

      function summarizeProgress(progressItems, selectedCandidate) {
        var items = Array.isArray(progressItems) ? progressItems : [];
        var totalFiles = items.length;
        var completedFiles = items.filter(function (item) {
          return item.status === "complete" || Number(item.progress || 0) >= 100;
        }).length;
        var activeFiles = items.filter(function (item) {
          return item.status === "active" || Number(item.downloadSpeed || 0) > 0;
        }).length;
        var waitingFiles = items.filter(function (item) {
          return item.status === "waiting";
        }).length;
        var failedFiles = items.filter(function (item) {
          return item.status === "error" || item.status === "removed";
        }).length;
        var completedBytes = items.reduce(function (total, item) {
          return total + Number(item.completedLength || 0);
        }, 0);
        var knownTotalBytes = items.reduce(function (total, item) {
          return total + Number(item.totalLength || 0);
        }, 0);
        var selectedTotalBytes = Number(selectedCandidate && selectedCandidate.sizeBytes || 0);
        var totalBytes = Math.max(knownTotalBytes, selectedTotalBytes);
        var speed = items.reduce(function (total, item) {
          return total + Number(item.downloadSpeed || 0);
        }, 0);
        var percent = totalBytes > 0
          ? Math.min(100, completedBytes / totalBytes * 100)
          : totalFiles > 0
            ? completedFiles / totalFiles * 100
            : 0;

        return {
          totalFiles: totalFiles,
          completedFiles: completedFiles,
          activeFiles: activeFiles,
          waitingFiles: waitingFiles,
          failedFiles: failedFiles,
          completedBytes: completedBytes,
          totalBytes: totalBytes,
          speed: speed,
          percent: Math.max(0, Math.min(100, percent))
        };
      }

      function selectionKindLabel(kind) {
        if (kind === "collection") return "\u5168\u96c6";
        if (kind === "season") return "\u6574\u5b63";
        return "\u5355\u96c6";
      }

      function selectionActionLabel(item) {
        if (item.kind === "collection") return "\u4e0b\u8f7d\u5168\u96c6";
        if (item.kind === "season") return "\u4e0b\u8f7d\u6574\u5b63";
        return "\u4e0b\u8f7d\u5355\u96c6";
      }

      function renderCandidates() {
        var candidates = Array.isArray(state.currentCandidates) ? state.currentCandidates : [];
        var selectedId = state.currentTask && state.currentTask.selectedResourceId;
        var providerCounts = candidates.reduce(function (counts, item) {
          var provider = item.provider || "unknown";
          counts[provider] = (counts[provider] || 0) + 1;
          return counts;
        }, {});
        var countText = candidates.length + " 个候选";
        if (providerCounts.xiaoya || providerCounts.emby) {
          countText += " · XiaoYa " + Number(providerCounts.xiaoya || 0) + " · Emby " + Number(providerCounts.emby || 0);
        }
        els.candidateCount.textContent = countText;

        if (!candidates.length) {
          els.resultList.innerHTML = '<div class="empty">' + (state.hasSearched ? "没有候选资源" : "等待搜索") + '</div>';
          return;
        }

        var sections = [
          { provider: "emby", title: "Emby 资源" },
          { provider: "xiaoya", title: "XiaoYa 资源" },
          { provider: "openlist", title: "OpenList 资源" },
          { provider: "local", title: "本地资源" },
          { provider: "unknown", title: "其他资源" }
        ];
        var sectionMarkup = sections.map(function (section) {
          var items = candidates.filter(function (item) {
            return (item.provider || "unknown") === section.provider;
          });
          if (!items.length) return "";
          return '<section class="candidate-section">' +
            '<div class="candidate-section-title">' +
              '<h3>' + escapeHtml(section.title) + '</h3>' +
              '<span class="pill blue">' + items.length + ' 个候选</span>' +
            '</div>' +
            '<div class="candidate-section-body">' +
              items.map(function (item) {
                return renderCandidateRow(item, selectedId);
              }).join("") +
            '</div>' +
          '</section>';
        }).join("");

        els.resultList.innerHTML = sectionMarkup;
      }

      function renderCandidateRow(item, selectedId) {
        var disabled = state.selectingId || selectedId;
        var isSelected = selectedId === item.id || state.selectingId === item.id;
        var videosCount = Number(item.videosCount || 0);
        var buttonText = isSelected ? "\u5df2\u9009\u62e9" : selectionActionLabel(item);
        var episodeMeta = videosCount > 1
          ? '<span class="pill">' + videosCount + ' \u96c6</span>'
          : '';
        return '<article class="row">' +
          '<div>' +
            '<div class="row-title">' + escapeHtml(item.name) + '</div>' +
            '<div class="row-meta">' +
              '<span class="pill violet">' + selectionKindLabel(item.kind) + '</span>' +
              episodeMeta +
              '<span class="pill">' + escapeHtml(item.size) + '</span>' +
              '<span class="pill">' + escapeHtml(item.source) + '</span>' +
              '<span class="pill">' + Number(item.subtitlesCount || 0) + ' \u5b57\u5e55</span>' +
            '</div>' +
          '</div>' +
          '<button class="select-button" type="button" data-resource-id="' + escapeHtml(item.id) + '"' +
            (disabled ? ' disabled' : '') + '>' + buttonText + '</button>' +
        '</article>';
      }

      function renderProgressLine(progress) {
        var percent = Math.max(0, Math.min(100, Number(progress.progress || 0)));
        var speed = formatBytes(progress.downloadSpeed) + "/s";
        var totalText = Number(progress.totalLength || 0) > 0
          ? formatBytes(progress.totalLength)
          : "\u672a\u77e5\u5927\u5c0f";
        var sizeText = formatBytes(progress.completedLength) + " / " + totalText;
        var fileName = getFileName(progress.outputPath || progress.sourcePath);
        var sourceName = getFileName(progress.sourcePath);
        var sourceMarkup = sourceName && sourceName !== fileName
          ? '<div class="progress-muted">' + escapeHtml(sourceName) + '</div>'
          : '';
        var status = progressStatusLabel(progress.status);
        var statusClassName = progressStatusClass(progress.status);
        var pillClassName = progressPillClass(progress.status);
        var className = "progress-line" + (statusClassName ? " " + statusClassName : "");

        return '<div class="' + className + '">' +
          '<div class="progress-file-row">' +
            '<div class="progress-file-name" title="' + escapeHtml(fileName) + '">' + escapeHtml(fileName) + '</div>' +
            '<span class="pill ' + pillClassName + '">' + escapeHtml(status) + '</span>' +
          '</div>' +
          sourceMarkup +
          '<div class="progress-meta"><span>' + escapeHtml(speed) + '</span><span>' + escapeHtml(sizeText) + '</span></div>' +
          '<div class="progress-bar"><div class="progress-fill" style="width: ' + percent.toFixed(2) + '%"></div></div>' +
        '</div>';
      }

      function renderDownloadProgress(task, progressItems, selectedCandidate) {
        if (!Array.isArray(progressItems) || !progressItems.length) {
          return "";
        }

        var expanded = Boolean(state.expandedTasks[task.taskId]);
        var visibleItems = progressItems;
        if (!expanded && progressItems.length > 8) {
          visibleItems = progressItems.filter(isInterestingProgress).slice(0, 8);
          if (!visibleItems.length) {
            visibleItems = progressItems.slice(0, 3);
          }
        }

        var hiddenCount = Math.max(0, progressItems.length - visibleItems.length);
        var summary = summarizeProgress(progressItems, selectedCandidate);
        var summaryBits = [
          summary.completedFiles + "/" + summary.totalFiles + " \u4e2a\u6587\u4ef6"
        ];
        if (summary.activeFiles) summaryBits.push(summary.activeFiles + " \u4e2a\u4e0b\u8f7d\u4e2d");
        if (summary.waitingFiles) summaryBits.push(summary.waitingFiles + " \u4e2a\u7b49\u5f85");
        if (summary.failedFiles) summaryBits.push(summary.failedFiles + " \u4e2a\u5931\u8d25");

        var totalText = summary.totalBytes > 0 ? formatBytes(summary.totalBytes) : "\u672a\u77e5\u5927\u5c0f";
        var toggleMarkup = "";
        if (hiddenCount > 0 || expanded) {
          toggleMarkup = '<button class="progress-toggle" type="button" data-toggle-task="' + escapeHtml(task.taskId) + '">' +
            (expanded
              ? "\u6536\u8d77\u6587\u4ef6\u5217\u8868"
              : "\u5c55\u5f00\u5168\u90e8 " + progressItems.length + " \u4e2a\u6587\u4ef6") +
          '</button>';
        }

        return '<div class="task-summary">' +
          '<div class="summary-row">' +
            '<div class="summary-main">' + escapeHtml(summaryBits.join(" · ")) + '</div>' +
            '<div class="summary-side">' + escapeHtml(formatBytes(summary.speed) + "/s · " + formatBytes(summary.completedBytes) + " / " + totalText) + '</div>' +
          '</div>' +
          '<div class="progress-bar"><div class="progress-fill" style="width: ' + summary.percent.toFixed(2) + '%"></div></div>' +
        '</div>' +
        '<div class="download-progress">' +
          visibleItems.map(renderProgressLine).join("") +
          toggleMarkup +
        '</div>';
      }

      function renderTasks() {
        var tasks = state.tasks.filter(function (task) {
          return task.selectedResourceId || task.status !== STATUS_WAITING;
        }).sort(function (a, b) {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

        if (!tasks.length) {
          els.taskList.innerHTML = '<div class="empty">暂无下载任务</div>';
          return;
        }

        els.taskList.innerHTML = tasks.map(function (task) {
          var displayStatus = downloadStatus(task);
          var selectedCandidate = getSelectedCandidate(task);
          var selected = selectedCandidate ? selectedCandidate.name : task.selectedResourceId || "";
          var progressMarkup = renderDownloadProgress(task, task.downloadProgress || [], selectedCandidate);

          return '<article class="task-item">' +
            '<div class="task-head">' +
              '<div>' +
                '<div class="task-title">' + escapeHtml(task.keyword) + '</div>' +
                '<div class="task-sub">' + escapeHtml(selected || task.taskId) + '</div>' +
              '</div>' +
              '<span class="pill ' + statusClass(displayStatus) + '">' + escapeHtml(displayStatus) + '</span>' +
            '</div>' +
            progressMarkup +
            '<div class="task-sub">' + escapeHtml(formatDate(task.updatedAt)) + '</div>' +
          '</article>';
        }).join("");
      }

      function renderOrganize() {
        var task = state.currentTask || state.tasks.find(function (item) {
          return item.status === STATUS_DONE;
        });

        if (!task) {
          els.organizeState.textContent = "待处理";
          els.organizeState.className = "pill";
          els.organizeList.innerHTML = '<div class="empty">暂无整理结果</div>';
          return;
        }

        var displayStatus = organizeStatus(task);
        els.organizeState.textContent = displayStatus;
        els.organizeState.className = "pill " + statusClass(displayStatus);

        var items = [];
        if (task.error) {
          items.push({
            type: "error",
            text: "\u5931\u8d25\u539f\u56e0: " + task.error
          });
        }
        var sourceVideos = Array.isArray(task.videoTargetPaths) && task.videoTargetPaths.length
          ? task.videoTargetPaths
          : (task.videoTargetPath ? [task.videoTargetPath] : []);
        sourceVideos.forEach(function (path) {
          items.push({ type: "path", text: "\u6e90\u89c6\u9891: " + path });
        });
        (task.subtitleTargetPaths || []).forEach(function (path) {
          items.push({ type: "path", text: "\u6e90\u5b57\u5e55: " + path });
        });
        (task.downloadPaths || []).forEach(function (path) {
          items.push({ type: "path", text: "\u4e0b\u8f7d: " + path });
        });
        var finalVideos = Array.isArray(task.finalVideoPaths) && task.finalVideoPaths.length
          ? task.finalVideoPaths
          : (task.finalVideoPath ? [task.finalVideoPath] : []);
        finalVideos.forEach(function (path) {
          items.push({ type: "path", text: "\u6574\u7406: " + path });
        });
        (task.finalSubtitlePaths || []).forEach(function (path) {
          items.push({ type: "path", text: "\u6574\u7406\u5b57\u5e55: " + path });
        });

        if (!items.length) {
          els.organizeList.innerHTML = '<div class="empty">暂无整理结果</div>';
          return;
        }

        els.organizeList.innerHTML = items.map(function (item) {
          var className = item.type === "error" ? "error-item" : "path-item";
          return '<div class="' + className + '">' + escapeHtml(item.text) + '</div>';
        }).join("");
      }

      function renderErrors() {
        var taskErrors = state.tasks
          .filter(function (task) { return task.error; })
          .map(function (task) {
            return {
              time: formatDate(task.updatedAt),
              message: task.keyword + ": " + task.error
            };
          });
        var errors = state.errors.concat(taskErrors).slice(0, 12);

        if (!errors.length) {
          els.errorList.innerHTML = '<div class="empty">暂无错误</div>';
          return;
        }

        els.errorList.innerHTML = errors.map(function (item) {
          return '<div class="error-item">' + escapeHtml(item.time + "  " + item.message) + '</div>';
        }).join("");
      }

      function sourceProviderLabel(provider) {
        if (provider === "xiaoya") return "XiaoYa";
        if (provider === "emby") return "Emby";
        if (provider === "openlist") return "OpenList";
        return provider || "资源";
      }

      function renderSourceHealth() {
        var items = Array.isArray(state.sourceHealth) ? state.sourceHealth : [];
        if (!items.length) {
          els.sourceStatusList.innerHTML = '<div class="empty">暂无资源状态</div>';
          return;
        }

        els.sourceStatusList.innerHTML = items.map(function (item) {
          var statusText = item.healthy ? "正常" : (item.configured ? "异常" : "未配置");
          var pillClassName = item.healthy ? "green" : (item.configured ? "red" : "amber");
          var meta = [];
          meta.push(sourceProviderLabel(item.provider));
          if (item.proxyUrl) meta.push("代理 " + item.proxyUrl);
          if (item.detail) meta.push(item.detail);
          return '<div class="source-row">' +
            '<div>' +
              '<div class="source-title">' + escapeHtml(item.name || item.id) + '</div>' +
              '<div class="source-meta">' + escapeHtml(meta.join(" · ")) + '</div>' +
            '</div>' +
            '<span class="pill ' + pillClassName + '">' + escapeHtml(statusText) + '</span>' +
          '</div>';
        }).join("");
      }

      function renderAll() {
        renderCandidates();
        renderTasks();
        renderOrganize();
        renderErrors();
        renderSourceHealth();
      }

      function loadSourceHealth() {
        return requestJson("/sources/health")
          .then(function (items) {
            state.sourceHealth = Array.isArray(items) ? items : [];
            renderSourceHealth();
          })
          .catch(function (error) {
            addError(error.message);
          });
      }

      function loadEmbyServers() {
        return requestJson("/emby/servers")
          .then(function (servers) {
            state.embyServers = Array.isArray(servers) ? servers : [];
            renderEmbyServers();
            if (!els.embyServerId.value && state.embyServers.length) {
              editEmbyServer(state.embyServers[0].id);
            }
          })
          .catch(function (error) {
            addError(error.message);
          });
      }

      function renderEmbyServers() {
        var servers = Array.isArray(state.embyServers) ? state.embyServers : [];
        if (!servers.length) {
          els.embyServerList.innerHTML = '<div class="empty">暂无 Emby 服务器</div>';
          return;
        }

        els.embyServerList.innerHTML = servers.map(function (server) {
          var selected = els.embyServerId.value === server.id;
          var meta = [
            server.baseUrl || "",
            server.enabled === false ? "停用" : "启用",
            server.proxyUrl ? "代理 " + server.proxyUrl : "",
            server.readonly ? "配置文件" : "页面配置"
          ].filter(Boolean).join(" · ");

          return '<div class="server-row">' +
            '<div>' +
              '<div class="source-title">' + escapeHtml(server.name || server.id) + '</div>' +
              '<div class="source-meta">' + escapeHtml(meta) + '</div>' +
            '</div>' +
            '<div class="server-actions">' +
              '<button class="icon-button" type="button" data-edit-emby="' + escapeHtml(server.id) + '" title="编辑">' + (selected ? "✓" : "✎") + '</button>' +
              '<button class="icon-button" type="button" data-delete-emby="' + escapeHtml(server.id) + '" title="删除">×</button>' +
            '</div>' +
          '</div>';
        }).join("");
      }

      function resetEmbyForm() {
        els.embyServerId.value = "";
        els.embyName.value = "";
        els.embyBaseUrl.value = "";
        els.embyUsername.value = "";
        els.embyPassword.value = "";
        els.embyProxyUrl.value = "";
        els.embyAria2ProxyUrl.value = "";
        els.embyEnabled.checked = true;
        els.deleteEmbyForm.disabled = true;
        els.saveEmbyForm.textContent = "保存并验证";
        els.embyFormStatus.textContent = "";
        renderEmbyServers();
      }

      function editEmbyServer(serverId) {
        var server = state.embyServers.find(function (item) {
          return item.id === serverId;
        });
        if (!server) return;
        els.embyServerId.value = server.id || "";
        els.embyName.value = server.name || "";
        els.embyBaseUrl.value = server.baseUrl || "";
        els.embyUsername.value = server.username || "";
        els.embyPassword.value = "";
        els.embyProxyUrl.value = server.proxyUrl || "";
        els.embyAria2ProxyUrl.value = server.aria2ProxyUrl || server.proxyUrl || "";
        els.embyEnabled.checked = server.enabled !== false;
        els.deleteEmbyForm.disabled = false;
        els.saveEmbyForm.textContent = "更新并验证";
        els.embyFormStatus.textContent = server.readonly
          ? "此服务器来自配置文件，保存会创建页面覆盖配置"
          : "";
        renderEmbyServers();
      }

      function openEmbyModal() {
        resetEmbyForm();
        loadEmbyServers().finally(function () {
          els.embyModal.hidden = false;
          els.embyBaseUrl.focus();
        });
      }

      function closeEmbyModal() {
        els.embyModal.hidden = true;
      }

      function submitEmbyForm() {
        var serverId = els.embyServerId.value.trim();
        var payload = {
          name: els.embyName.value.trim(),
          baseUrl: els.embyBaseUrl.value.trim(),
          username: els.embyUsername.value.trim(),
          proxyUrl: els.embyProxyUrl.value.trim(),
          aria2ProxyUrl: els.embyAria2ProxyUrl.value.trim(),
          enabled: els.embyEnabled.checked,
          verify: true
        };
        if (!serverId || els.embyPassword.value !== "") {
          payload.password = els.embyPassword.value;
        }

        els.saveEmbyForm.disabled = true;
        els.embyFormStatus.textContent = "正在验证";

        return requestJson(serverId ? "/emby/servers/" + encodeURIComponent(serverId) : "/emby/servers", {
          method: serverId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        })
          .then(function (server) {
            els.embyFormStatus.textContent = "已保存";
            els.embyPassword.value = "";
            return Promise.all([loadEmbyServers(), loadSourceHealth()]).then(function () {
              editEmbyServer(server.id);
            });
          })
          .catch(function (error) {
            els.embyFormStatus.textContent = "验证失败";
            addError(error.message);
          })
          .finally(function () {
            els.saveEmbyForm.disabled = false;
          });
      }

      function deleteCurrentEmbyServer() {
        var serverId = els.embyServerId.value.trim();
        if (!serverId) return;
        if (!window.confirm("删除这个 Emby 服务器？")) return;

        els.deleteEmbyForm.disabled = true;
        els.embyFormStatus.textContent = "正在删除";
        return requestJson("/emby/servers/" + encodeURIComponent(serverId), {
          method: "DELETE"
        })
          .then(function () {
            resetEmbyForm();
            return Promise.all([loadEmbyServers(), loadSourceHealth()]);
          })
          .catch(function (error) {
            els.embyFormStatus.textContent = "删除失败";
            addError(error.message);
          })
          .finally(function () {
            els.deleteEmbyForm.disabled = false;
          });
      }

      function syncTask(task) {
        if (!task || !task.taskId) return;
        var index = state.tasks.findIndex(function (item) {
          return item.taskId === task.taskId;
        });
        if (index >= 0) {
          state.tasks[index] = task;
        } else {
          state.tasks.unshift(task);
        }
        if (state.currentTaskId === task.taskId) {
          state.currentTask = task;
          state.currentCandidates = Array.isArray(task.candidates) ? task.candidates : state.currentCandidates;
        }
      }

      function loadTasks() {
        return requestJson("/tasks")
          .then(function (tasks) {
            state.tasks = Array.isArray(tasks) ? tasks : [];
            if (state.currentTaskId) {
              var matched = state.tasks.find(function (task) {
                return task.taskId === state.currentTaskId;
              });
              if (matched) {
                state.currentTask = matched;
                state.currentCandidates = Array.isArray(matched.candidates) ? matched.candidates : state.currentCandidates;
              }
            }
            renderAll();
          })
          .catch(function (error) {
            addError(error.message);
          });
      }

      function pollCurrentTask() {
        if (!state.currentTaskId) {
          loadTasks();
          return;
        }

        requestJson("/task/" + encodeURIComponent(state.currentTaskId))
          .then(function (task) {
            syncTask(task);
            renderAll();
            if (activeStatuses.indexOf(task.status) === -1) {
              stopPolling();
            }
          })
          .catch(function (error) {
            addError(error.message);
          });
      }

      function startPolling() {
        stopPolling();
        state.polling = window.setInterval(pollCurrentTask, 2000);
        pollCurrentTask();
      }

      function stopPolling() {
        if (state.polling) {
          window.clearInterval(state.polling);
          state.polling = null;
        }
      }

      function searchResources(keyword) {
        setSearchBusy(true);
        stopPolling();
        state.currentTaskId = null;
        state.currentTask = null;
        state.currentKeyword = keyword;
        state.currentCandidates = [];
        state.hasSearched = true;
        els.resultList.scrollTop = 0;
        els.searchStatus.textContent = "搜索中";
        renderAll();

        return requestJson("/resources/search?keyword=" + encodeURIComponent(keyword))
          .then(function (candidates) {
            state.currentCandidates = Array.isArray(candidates) ? candidates : [];
            els.searchStatus.textContent = "找到 " + state.currentCandidates.length + " 个候选";
            renderAll();
          })
          .catch(function (error) {
            els.searchStatus.textContent = "搜索失败";
            addError(error.message);
          })
          .finally(function () {
            setSearchBusy(false);
          });
      }

      function selectResource(resourceId) {
        if (!resourceId) return;
        state.selectingId = resourceId;
        renderCandidates();
        return requestJson("/resources/select", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            taskId: state.currentTaskId,
            resourceId: resourceId,
            keyword: state.currentKeyword || els.keywordInput.value.trim()
          })
        })
          .then(function (task) {
            state.currentTaskId = task.taskId;
            state.currentTask = task;
            state.currentCandidates = Array.isArray(task.candidates) ? task.candidates : state.currentCandidates;
            syncTask(task);
            renderAll();
            startPolling();
          })
          .catch(function (error) {
            addError(error.message);
          })
          .finally(function () {
            state.selectingId = null;
            renderCandidates();
          });
      }

      function updateClock() {
        els.clock.textContent = new Date().toLocaleString();
      }

      els.searchForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var keyword = els.keywordInput.value.trim();
        if (!keyword) {
          addError("keyword is required");
          return;
        }
        searchResources(keyword);
      });

      els.resultList.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) return;
        var button = target.closest("[data-resource-id]");
        if (!button) return;
        selectResource(button.getAttribute("data-resource-id"));
      });

      els.taskList.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) return;
        var button = target.closest("[data-toggle-task]");
        if (!button) return;
        var taskId = button.getAttribute("data-toggle-task");
        if (!taskId) return;
        state.expandedTasks[taskId] = !state.expandedTasks[taskId];
        renderTasks();
      });

      els.refreshTasks.addEventListener("click", function () {
        loadTasks();
      });

      els.clearErrors.addEventListener("click", function () {
        state.errors = [];
        renderErrors();
      });

      els.refreshSources.addEventListener("click", function () {
        loadSourceHealth();
      });

      els.manageEmby.addEventListener("click", function () {
        openEmbyModal();
      });

      els.closeEmbyModal.addEventListener("click", function () {
        closeEmbyModal();
      });

      els.cancelEmbyForm.addEventListener("click", function () {
        closeEmbyModal();
      });

      els.newEmbyServer.addEventListener("click", function () {
        resetEmbyForm();
        els.embyBaseUrl.focus();
      });

      els.deleteEmbyForm.addEventListener("click", function () {
        deleteCurrentEmbyServer();
      });

      els.embyServerList.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof HTMLElement)) return;
        var editButton = target.closest("[data-edit-emby]");
        if (editButton) {
          editEmbyServer(editButton.getAttribute("data-edit-emby"));
          return;
        }

        var deleteButton = target.closest("[data-delete-emby]");
        if (deleteButton) {
          editEmbyServer(deleteButton.getAttribute("data-delete-emby"));
          deleteCurrentEmbyServer();
        }
      });

      els.embyModal.addEventListener("click", function (event) {
        if (event.target === els.embyModal) {
          closeEmbyModal();
        }
      });

      els.embyForm.addEventListener("submit", function (event) {
        event.preventDefault();
        submitEmbyForm();
      });

      updateClock();
      window.setInterval(updateClock, 30000);
      loadSourceHealth();
      loadEmbyServers();
      loadTasks();
    })();
  </script>
</body>
</html>`;
}
