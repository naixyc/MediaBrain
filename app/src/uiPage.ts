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
      width: min(1440px, calc(100% - 40px));
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
      grid-template-columns: minmax(0, 1.3fr) minmax(340px, 0.7fr);
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
      margin-top: 16px;
      max-height: 520px;
      overflow: auto;
      padding-right: 4px;
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
      min-width: 62px;
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

    .download-progress {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }

    .progress-line {
      display: grid;
      gap: 6px;
    }

    .progress-meta {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      color: var(--muted);
      font-size: 12px;
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
            <span class="pill blue" id="candidateCount">0 个候选</span>
          </div>
          <div class="panel-body">
            <form class="search-form" id="searchForm">
              <input class="input" id="keywordInput" name="keyword" placeholder="搜索影片或剧集" autocomplete="off" />
              <button class="button" id="searchButton" type="submit">搜索</button>
            </form>
            <div class="status-line" id="searchStatus"></div>
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

  <script>
    (function () {
      var state = {
        currentTaskId: null,
        currentTask: null,
        currentKeyword: "",
        currentCandidates: [],
        hasSearched: false,
        tasks: [],
        errors: [],
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
        clearErrors: document.getElementById("clearErrors")
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

      function renderCandidates() {
        var candidates = Array.isArray(state.currentCandidates) ? state.currentCandidates : [];
        var selectedId = state.currentTask && state.currentTask.selectedResourceId;
        els.candidateCount.textContent = candidates.length + " 个候选";

        if (!candidates.length) {
          els.resultList.innerHTML = '<div class="empty">' + (state.hasSearched ? "没有候选资源" : "等待搜索") + '</div>';
          return;
        }

        els.resultList.innerHTML = candidates.map(function (item) {
          var disabled = state.selectingId || selectedId;
          var isSelected = selectedId === item.id || state.selectingId === item.id;
          var buttonText = isSelected ? "已选择" : "选择";
          return '<article class="row">' +
            '<div>' +
              '<div class="row-title">' + escapeHtml(item.name) + '</div>' +
              '<div class="row-meta">' +
                '<span class="pill">' + escapeHtml(item.size) + '</span>' +
                '<span class="pill">' + escapeHtml(item.source) + '</span>' +
                '<span class="pill">' + Number(item.subtitlesCount || 0) + ' 字幕</span>' +
              '</div>' +
            '</div>' +
            '<button class="select-button" type="button" data-resource-id="' + escapeHtml(item.id) + '"' +
              (disabled ? ' disabled' : '') + '>' + buttonText + '</button>' +
          '</article>';
        }).join("");
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
          var progressMarkup = "";
          if (Array.isArray(task.downloadProgress) && task.downloadProgress.length) {
            progressMarkup = '<div class="download-progress">' + task.downloadProgress.map(function (progress) {
              var percent = Math.max(0, Math.min(100, Number(progress.progress || 0)));
              var speed = formatBytes(progress.downloadSpeed) + "/s";
              var sizeText = formatBytes(progress.completedLength) + " / " + formatBytes(progress.totalLength);
              return '<div class="progress-line">' +
                '<div class="progress-meta"><span>' + escapeHtml(progress.status) + '</span><span>' + escapeHtml(speed + " · " + sizeText) + '</span></div>' +
                '<div class="progress-bar"><div class="progress-fill" style="width: ' + percent.toFixed(2) + '%"></div></div>' +
              '</div>';
            }).join("") + '</div>';
          }

          var selected = "";
          if (task.selectedResourceId) {
            var matched = (task.candidates || []).find(function (candidate) {
              return candidate.id === task.selectedResourceId;
            });
            selected = matched ? matched.name : task.selectedResourceId;
          }

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
        if (task.videoTargetPath) items.push({ type: "path", text: "源视频: " + task.videoTargetPath });
        (task.subtitleTargetPaths || []).forEach(function (path) {
          items.push({ type: "path", text: "源字幕: " + path });
        });
        (task.downloadPaths || []).forEach(function (path) {
          items.push({ type: "path", text: "下载: " + path });
        });
        if (task.finalVideoPath) items.push({ type: "path", text: "整理: " + task.finalVideoPath });
        (task.finalSubtitlePaths || []).forEach(function (path) {
          items.push({ type: "path", text: "整理字幕: " + path });
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

      function renderAll() {
        renderCandidates();
        renderTasks();
        renderOrganize();
        renderErrors();
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

      els.refreshTasks.addEventListener("click", function () {
        loadTasks();
      });

      els.clearErrors.addEventListener("click", function () {
        state.errors = [];
        renderErrors();
      });

      updateClock();
      window.setInterval(updateClock, 30000);
      loadTasks();
    })();
  </script>
</body>
</html>`;
}
