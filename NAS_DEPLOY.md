# MediaBrain-AI NAS Docker Compose 部署说明

本文档用于在飞牛 NAS 上用 Docker Compose 部署 MediaBrain-AI，并对接已经部署好的 Aria2。

## 1. 当前推荐架构

```text
XiaoYa AList -> MediaBrain API -> Aria2 -> NAS /downloads
                              -> AI Service
                              -> Hermes Executor -> NAS /media/organized
```

当前项目不内置 Aria2。Aria2 作为外部下载器运行，MediaBrain 通过 JSON-RPC 调用它。

## 2. 目录准备

你已经创建了以下目录，保持不变即可：

```text
/vol1/1000/docker/aria2/config
/vol1/1000/MediaBrain/downloads
/vol1/1000/MediaBrain/organized
```

MediaBrain 容器内路径统一使用：

```text
/downloads
/media/organized
```

对应 NAS 宿主机路径：

```text
/vol1/1000/MediaBrain/downloads  -> /downloads
/vol1/1000/MediaBrain/organized -> /media/organized
```

## 3. 已有 Aria2 配置

你当前的 Aria2 RPC 地址是：

```text
http://192.168.1.35:46800/jsonrpc
```

Aria2 容器内下载目录是：

```text
/downloads
```

这和 MediaBrain 的 `ARIA2_DOWNLOAD_DIR=/downloads` 必须保持一致。

## 4. 上传项目到 NAS

推荐路径：

```text
/vol1/1000/docker/mediabrain-ai
```

如果代码已经推到 Git，NAS 上可以执行：

```bash
cd /vol1/1000/docker
git clone <你的 Git 仓库地址> mediabrain-ai
cd mediabrain-ai
```

如果暂时没有 Git 仓库，也可以先通过飞牛文件管理器上传整个 `MediaBrain-AI` 目录。

## 5. 创建生产环境配置

进入项目目录：

```bash
cd /vol1/1000/docker/mediabrain-ai
cp config/.env.example config/.env
```

编辑 `config/.env`，至少确认这些值：

```env
SEARCH_PROVIDER=xiaoya
XIAOYA_BASE_URL=http://192.168.1.35:5678
XIAOYA_AUTH_MODE=none

ARIA2_RPC_URL=http://192.168.1.35:46800/jsonrpc
ARIA2_RPC_SECRET=你的Aria2密钥
ARIA2_DOWNLOAD_DIR=/downloads

AI_TARGET_ROOT=/media/organized
HERMES_RENAME_MODE=filesystem
```

如果继续使用你现在的 Aria2 密钥，`ARIA2_RPC_SECRET` 填你 Aria2 Compose 里的 `RPC_SECRET`。

不要把真实的 `config/.env` 推到 Git，里面有密码和密钥。

## 6. 一键部署 MediaBrain

项目已提供 NAS 专用 Compose 文件：

```text
docker-compose.nas.yml
```

在 NAS SSH 里执行：

```bash
cd /vol1/1000/docker/mediabrain-ai
docker compose -f docker-compose.nas.yml up -d --build
```

飞牛 Docker Compose 页面也可以直接选择这个项目目录，并使用 `docker-compose.nas.yml` 的内容部署。

部署完成后会启动：

```text
mediabrain_ai_api_42180       http://192.168.1.35:42180
mediabrain_ai_service_42181   http://192.168.1.35:42181
mediabrain_hermes_executor_42182
```

## 7. 验证服务

验证 API：

```bash
curl http://127.0.0.1:42180/
```

验证小雅：

```bash
curl http://127.0.0.1:42180/xiaoya/me
```

验证搜索：

```bash
curl "http://127.0.0.1:42180/resources/search?keyword=%E9%92%A2%E9%93%81%E4%BE%A0"
```

创建任务：

```bash
curl -X POST "http://127.0.0.1:42180/task/create" \
  -H "Content-Type: application/json" \
  -d '{"keyword":"钢铁侠"}'
```

选择资源：

```bash
curl -X POST "http://127.0.0.1:42180/resources/select" \
  -H "Content-Type: application/json" \
  -d '{"taskId":"上一步返回的taskId","resourceId":"候选资源id"}'
```

查看任务：

```bash
curl "http://127.0.0.1:42180/task/你的taskId"
```

## 8. 文件落点

下载中的文件会在：

```text
/vol1/1000/MediaBrain/downloads
```

Hermes 整理后的文件会在：

```text
/vol1/1000/MediaBrain/organized
```

如果任务显示下载完成但 Hermes 报找不到源文件，优先检查：

```text
Aria2 的下载目录是否是 /downloads
app/hermes 是否都挂载了 /vol1/1000/MediaBrain/downloads:/downloads
hermes 是否挂载了 /vol1/1000/MediaBrain/organized:/media/organized
```

## 9. 运维命令

查看容器：

```bash
docker compose -f docker-compose.nas.yml ps
```

查看日志：

```bash
docker compose -f docker-compose.nas.yml logs -f app
```

重启：

```bash
docker compose -f docker-compose.nas.yml restart
```

更新代码后重新构建：

```bash
git pull
docker compose -f docker-compose.nas.yml up -d --build
```

停止：

```bash
docker compose -f docker-compose.nas.yml down
```

## 10. 可选：全新部署 Aria2

如果 NAS 上还没有 Aria2，可以单独部署：

```yaml
services:
  aria2:
    image: p3terx/aria2-pro:latest
    container_name: mediabrain_aria2_46800
    restart: unless-stopped
    environment:
      - PUID=1000
      - PGID=1000
      - UMASK_SET=022
      - TZ=Asia/Shanghai
      - RPC_SECRET=change-me
      - RPC_PORT=6800
      - LISTEN_PORT=6888
    ports:
      - "46800:6800"
      - "46888:6888"
      - "46888:6888/udp"
    volumes:
      - /vol1/1000/docker/aria2/config:/config
      - /vol1/1000/MediaBrain/downloads:/downloads

  ariang:
    image: p3terx/ariang:latest
    container_name: mediabrain_ariang_46880
    restart: unless-stopped
    command: --port 6880
    ports:
      - "46880:6880"
```

AriaNg 地址：

```text
http://192.168.1.35:46880
```

RPC 配置：

```text
主机: 192.168.1.35
端口: 46800
接口: /jsonrpc
密钥: RPC_SECRET 的值
```
