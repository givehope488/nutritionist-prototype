# C4 小范围发布包（2026-11-26，PD）

> 用途：把「发布」从口头约定变成可执行清单。**地址已就绪**（本机内网 `http://192.168.5.8:8080`，见 `docs/DEPLOY.md` §8）；**用户 2026-11-26 明确「无需反馈群」**，群不再作为发布前置。
> 依据：`docs/DEPLOY.md`（§2 首次部署 / §3 检查清单 / §7 构建坑 / §8 无 Docker 兜底）、`reviews/pd/ACCEPTANCE-W2-W3-2026-11-15.md`（W3-C1~C5）。

---

## 1. 发布前置（缺一不可）

| # | 条件 | 现状 | 谁提供 |
|---|---|---|---|
| 1 | 可访问的部署地址 | ✅ 本机内网 `http://192.168.5.8:8080`（无 Docker 兜底，需本机常开） | 已由 PD 部署 |
| 2 | ~~反馈群「食堂营养师」~~ | ✅ **不需要**：用户 2026-11-26 决定不建群 | — |
| 3 | `.env` 里的 `ADMIN_TOKEN`（随机 24 字节 hex） | 内网兜底未启用管理端，正式 compose 部署时生成 | 部署人 |
| 4 | 发布前备份 `npm run backup` | 流程已演练（12 ms）；内网兜底可随时在仓库根执行 | 部署人 |
| 5 | 小范围名单（同学，不公开推广） | 未定 | PD |

> 地址只要**小范围可达**即可：同一校园网/内网 IP 就行，不要求公网域名。仓库 nginx 只监听 80、无 HTTPS（DEPLOY §4.2），所以不要把含个人信息的链接公开传播。
> 内网兜底没有 nginx，但同样是 HTTP；`http://192.168.5.8:8080` 只在同一 WLAN、且本机不关机时可用。

## 2. 发布步骤（照抄）

```bash
cp .env.example .env
node -e "console.log(require('node:crypto').randomBytes(24).toString('hex'))"   # 填入 ADMIN_TOKEN

docker compose up -d --build
docker compose ps          # web / server 均应为 healthy
```

> ⚠️ 已有运营修订的库**不要**靠重启容器触发 seed（会清空 dishes 重写），见 DEPLOY §2 注与 BACKUP 恢复流程。

### 2.1 上线自检（四条，缺一不可）

```bash
curl -s http://localhost:8080/healthz                                  # {"status":"ok",...}
curl -s http://localhost:8080/api/v1/menu | head -c 120                # 菜品 JSON
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8080/api/v1/admin/dishes   # 401
curl -s -H "X-Admin-Token: $ADMIN_TOKEN" http://localhost:8080/api/v1/admin/dishes   # 200
```

再走一条真链路：建档 → 目标 → 推荐 → 采纳 → 回填 → 历史。**记下菜单道数**（当前应为 383；若变了先查是不是种子问题）。

## 3. 群公告（可直接发，发布当天）

> 食堂营养师 内测版上线了：http://192.168.5.8:8080（需连同一校园网 Wi-Fi）
>
> 能做什么：填一次身高体重和目标（保持/减肥/增肌/增重），选早/午/晚，它会按食堂当天能买到的菜给 3 套搭配，并给出热量和蛋白质目标；吃完回来点「按这套吃了」或自己选菜回填，就能看到这餐达没达标。
>
> 说明三件事：
> 1. 营养值是**估算值**，不宣称精确，不构成处方或医疗建议；未成年人只提供「保持」，不提供减肥缺口方案。
> 2. 称重菜（早餐自选线、健康餐、麻辣烫配菜）的份量以**现场称重**为准，页面热量只作参考。
> 3. 页面不显示价格。数据来自食堂菜单牌与照片识别，菜品有出入请点回填页的「菜品有出入？」一键复制，直接发给 PD。
>
> 只拉了小范围同学试用，先别往外转。

## 4. 反馈收集（用户 2026-11-26 决定：不建群）

| 项 | 约定 |
|---|---|
| 入口 | 回填页「菜品有出入？」一键复制文本，直接私聊/口头发给 PD；`/feedback` 页只读 |
| 渠道 | **不建反馈群**；不再要求微信群作为唯一收集口 |
| 谁看 | PD 收到即看；发布首周每天主动问一次，之后每周一固定问一次 |
| 菜品数据类 | 24h 内对照片/菜单牌复核，转成 §6 条目；确认后走 `observed-menu.json` → 重建种子，**不手改** `menu-seed.v3.json` |
| 其他类 | 需求进 §6 观察项；崩溃/报错看服务端终端输出（内网兜底）或 `docker compose logs server`（compose 部署） |

## 5. 已知限制（被问到时照这个答）

1. 营养值是估算，称重菜尤其只能给参考值。
2. 无登录、无账号体系：档案靠浏览器本地 `session_id`，换设备/清缓存会丢；删除入口在「我的档案」。
3. 没有价格，是产品决定，不是漏做。
4. SQLite 单实例，只适合小范围；人多会慢。
5. 数据每天备份在本机（`backups/`），只用于恢复，不外传。

## 6. 回滚（出事 1 分钟内）

```bash
# 代码/镜像回滚
docker tag canteen-server:prev canteen-server:local && docker compose up -d

# 数据回滚（先停服务）
docker compose stop server
npm run restore -- ./backups/app-<时间戳>.db
docker compose start server
```

发布前打镜像标签：`docker tag canteen-server:local canteen-server:prev`。

> 命令口径：根 `package.json` 已补 `backup` / `restore` 转发脚本（2026-11-26），DEPLOY/BACKUP 里的根目录写法现在可直接执行；`-- <文件>` 会正确转发到 server 脚本，且相对路径（`BACKUP_DIR`、备份文件、目标库）统一按**仓库根目录**解析。

## 7. 发布记录模板（发完填，贴进 §5）

```
日期：
地址：
commit / 镜像：
备份文件：
自检：healthz __ / menu __ 道 / admin 401 __ / admin 200 __ / 业务链路 __
分发：__ 人；时间 __（不建群）
首日反馈：__ 条（数据类 __ / 其他 __）
```

---

**结论**：地址已由无 Docker 兜底打通（`http://192.168.5.8:8080`，2026-11-26 实测 383 道与真实链路），**反馈群按用户决定取消**。发布动作本身已被 11-23 的 compose 实机验证过；现在只剩「把地址发给小范围同学」这一步，由 PD / 项目负责人执行。