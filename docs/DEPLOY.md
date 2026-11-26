# 部署与上线（W3-C1 / C2）

> 面向：PB（运维）、PD（发布）。
> 三件套 = **compose 编排 + nginx 反代 + 备份**。全部文件在 `deploy/` 与仓库根。

## 1. 文件清单

| 文件 | 作用 |
|---|---|
| `deploy/Dockerfile.server` | 服务端镜像（Node 22，tsx 直接跑 TS） |
| `deploy/Dockerfile.web` | 前端构建 + nginx 运行（同时承担反代） |
| `deploy/nginx.conf` | 静态站 + `/api/*` 反代 + SPA 回落 + gzip |
| `docker-compose.yml` | 两个服务、卷、健康检查、依赖顺序 |
| `.env.example` | `ADMIN_TOKEN` / `TEXT_ENGINE` / `WEB_PORT` |
| `docs/BACKUP.md` | 备份与恢复（含演练记录） |

**架构**（单机、同源）：

```
浏览器 ──> web 容器（nginx :80 → 宿主 8080）
              ├─ /             → /usr/share/nginx/html（vite 产物，SPA 回落）
              ├─ /assets/*     → 长缓存
              ├─ /healthz      → 反代 server:8787/healthz
              └─ /api/*        → 反代 server:8787/api/*
                                    │
                             server 容器（Node 22，:8787）
                                    └─ SQLite 文件 → ./server/data/runtime（volume）
```

同源部署的好处：前端请求 `/api/v1/...` 与页面同源，**不需要 CORS**，也不会因为漏配 Origin 在某些浏览器上静默失败。

## 2. 首次部署

```bash
cp .env.example .env
# 生成并填入 ADMIN_TOKEN
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"

docker compose up -d --build
docker compose ps            # web 与 server 都应为 healthy
```

**验收四条**（缺一不可）：

```bash
curl -s http://localhost:8080/healthz                     # {"status":"ok",...}
curl -s http://localhost:8080/api/v1/menu | head -c 120    # 菜品 JSON（服务端已在启动时 seed）
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/v1/admin/dishes   # 401（没令牌）
curl -s -H "X-Admin-Token: $ADMIN_TOKEN" http://localhost:8080/api/v1/admin/dishes   # 200 + 数组
```

浏览器打开 `http://<主机>:8080/` → 建档 → 目标 → 推荐 → 采纳 → 回填 → 历史，一条链走通即算上线成功。

> 首次启动的种子：服务端容器 `CMD` 里会先跑 `npm run seed`（幂等）。已有数据时它会**先清空 dishes 再全量写入**，
> 因此**不要**在已有运营修订的库上重启容器去触发 seed——见 `docs/BACKUP.md` 的恢复流程。

## 3. C2 上线检查清单

### 3.1 回滚

| 级别 | 做法 | 耗时 |
|---|---|---|
| 代码回滚 | `git revert <commit>` → `docker compose up -d --build` | 1~2 分钟 |
| 镜像回滚 | 发布前 `docker tag canteen-server:local canteen-server:prev`，出事 `docker tag canteen-server:prev canteen-server:local` + `up -d` | <1 分钟 |
| 数据回滚 | 停服务 → `npm run restore -- <备份文件>` → 起服务（`docs/BACKUP.md`；相对路径按仓库根解析） | 秒级（实测 5 ms @116 KB） |

**发布前必做**：`npm run backup`，并把产物路径记进发布记录。

### 3.2 降级

| 场景 | 降级手段 |
|---|---|
| 推荐引擎异常（`/recommendations` 5xx） | 前端降级到「自选回填」：回填页不依赖推荐也能提交（`items` 手选），采纳率自然变 0 但不阻塞用户 |
| 菜品数据有问题 | 管理端 `status <id> hidden` 下架单菜（`npm run admin -w @canteen/server -- status <id> hidden`），无需发版 |
| LLM 层异常 | `TEXT_ENGINE=template`（默认值），判语走模板，全程不依赖外部服务 |
| 数据库损坏 | 停服务 → 用最近一次备份恢复 → 起服务（`docs/BACKUP.md`） |

### 3.3 监控

| 指标 | 怎么查 | 告警阈值（建议） |
|---|---|---|
| 服务存活 | `docker compose ps` 的 healthy / `GET /healthz` | 非 200 连续 3 次 |
| 接口错误率 | `docker compose logs server` 里 5xx 计数 | 5 分钟内 >10 条 |
| 响应延迟 | nginx `access_log`（`proxy_read_timeout 30s` 是硬上限） | P95 > 2s |
| 磁盘 | `df -h`（SQLite + 备份都在本地盘） | 使用率 > 80% |
| 备份成功 | 宿主机 cron 跑 `npm run backup` 的退出码 | 连续 2 天失败 |
| 数据量 | `sqlite3 app.db "select count(*) from meal_logs"` | 仅观察，无阈值 |

建议（未强制，W3 时间允许再加）：把 `/healthz` 接到 Uptime Kuma 或云监控的 HTTP 探针；备份目录同步到另一块盘/对象存储。

## 4. 已知限制（写清楚，别让人以为漏了）

1. **镜像带 devDependencies**：运行时用 `tsx` 跑 TypeScript（与本地一致），因此 `npm ci` 不能加 `--omit=dev`。
   若将来要瘦身，改成 `tsc` 构建 + `node dist/index.js`，同时把 `tsx` 换成可选依赖。
2. **没有 HTTPS**：单机内网演示够用。对外发布需要在外层（云 LB / 另一台 nginx）终止 TLS，
   本仓库的 nginx 只监听 80。
3. **SQLite 单写者**：只能单实例部署，不能水平扩展；这是 W2 的技术选型（`ARCHITECTURE.md` §5），不是遗漏。
4. **备份在宿主机执行**：容器内没有 cron，`docker compose exec` 跑备份也可以，但推荐宿主机跑（见 `docs/BACKUP.md`）。
5. **无鉴权体系**：用户端靠 `session_id`（前端生成），管理端靠 `X-Admin-Token`；这是 3 周计划的既定范围。

## 5. 常用运维命令

```bash
docker compose logs -f server          # 看后端日志
docker compose restart server          # 只重启后端
docker compose down                    # 停止（不动 volume）
docker compose down -v                 # ⚠️ 连 volume 一起删，数据会没

# 宿主机上做备份（推荐 cron 每天 03:00）
BACKUP_DIR=./backups npm run backup

# 恢复（先停服务）
docker compose stop server
npm run restore -- ./backups/app-2026-11-21T13-05-02-817Z.db
docker compose start server
```

## 6. 「无解」链路验证（2026-11-22，§2.5 步 2 ③）

用真实数据构造「所有午餐候选都不可用」：

```bash
# 下架全部午餐候选（356 道），模拟所有午餐档口关停
sqlite3 app.db "UPDATE dishes SET status='hidden' WHERE meals LIKE '%lunch%';"
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"session_id":"drill","meal":"lunch"}' http://127.0.0.1:8787/api/v1/recommendations
```

返回：

```json
{ "combos": [], "notice": "符合忌口条件的菜品太少，建议放宽一两个限制或换个时段", "target": { ... } }
```

**结论**：无解时是 **200 + `combos: []` + `notice`**，不是 404/500，前端「无解」页有文案可渲染（与 API.md §2.3 一致）。

顺带验证了一个容易误判的现象：**只下架「午餐主食」并不会无解**——v3 有 258 道 `single` 成品餐
（一份即一餐），不依赖主食+主菜+素菜的组合结构。要造无解，必须把午餐候选整体下架。

## 7. 构建注意事项（实机踩过的两个坑，2026-11-23）

> 这两条都是「本地能跑、镜像不能跑」的类型，**不实跑一次 `docker compose up -d --build` 发现不了**。
> 本节内容来自 BE-B 的 PR #84，2026-11-26 由 PD 摘入主干（原 PR 因 PROGRESS 冲突关闭，正文未改）。

### 7.1 `NODE_ENV=production` 不能放在 `npm ci` 之前

```dockerfile
# ❌ 错误：npm 会跳过 devDependencies，而 tsx 在 devDeps 里
ENV NODE_ENV=production
RUN npm ci

# ✅ 正确：先装全量依赖，再切生产模式
RUN npm ci
ENV NODE_ENV=production
```

症状：容器反复 `Restarting`，日志里 `sh: 1: tsx: not found`，退出码 127。
原因：服务端用 `tsx` 直接跑 TS（见 §4 已知限制 1），它属于 `devDependencies`，
`NODE_ENV=production` 会让 `npm ci` 把它整批跳过。

### 7.2 web 镜像必须拷仓库根 `tsconfig.base.json`

```dockerfile
COPY tsconfig.base.json ./tsconfig.base.json
```

症状：`npm run build` 直接失败，报 `failed: Tsconfig not found /repo/tsconfig.base.json`。
原因：`web/tsconfig.json` 的 `include` 带上了 `../shared/src/**/*.ts`，
rolldown 为这些仓库外的文件向上查找 tsconfig 时会命中根文件——镜像里只有 `web/` 就会缺。

### 7.3 改 Dockerfile 的规矩

**改完必须真跑一次 `docker compose up -d --build` 再合并。** 本地 `npm run build` 通过
不代表镜像能构建：镜像里的文件集合是白名单（`COPY` 了哪些就是哪些），而本地是整棵源码树。

### 7.4 实机实测记录（2026-11-23，PD 执行）

| 项 | 结果 |
|---|---|
| 构建启动 | `docker compose up -d --build` 成功，两容器 **healthy**（server 8787 / web 8080→80 反代） |
| 探针 | `GET /` 200、`GET /healthz` 200、`GET /api/v1/menu` 返回 **384 道** |
| 端到端 | 建档（bmi 21.97）→ 推荐 3 套（目标 912.8 kcal，首选 912 kcal / 蛋白 32.4 g）→ 回填 → `adoption_rate=1` |
| 可重跑 | 二次 `docker compose up -d --build` **2.5 s**（镜像层缓存命中、容器不重建） |
| 数据卷 | 容器 `/app/server/data/runtime/app.db` ↔ 宿主同路径，双向可见 |

> 注：7.4 的「384 道」是 11-23 当时的记录；菜单已于 11-24 清理为 **383 道**（见 README 与 §5 11-24 条目）。
