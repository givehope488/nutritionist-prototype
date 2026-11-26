# PD 工作日志（决策与溯源记录）

> 目的：PD 的裁决、改动、验证与阻塞都留痕，出问题时能回溯「依据什么、改到哪、谁在等谁」。
> 规则：每个结论带**依据**与**可复现命令/回执**；未验证的写「未验证」。本文件只追加，不改旧条目。
> 代行说明：2026-11-26 起，用户把 PD 职责委托给本机 Agent。**权限边界不变**：GitHub 账号仍是 `Aredjdhd`（多数 PR 的作者），不能自审自合、不能改分支保护、不能切账号。

---

## 1. 2026-11-26 事实核对（动手前）

| 项 | 值 | 依据 |
|---|---|---|
| 主干 | `main` @ `7896d6b` | `git fetch origin --prune` + `git log -1 origin/main` |
| 菜单 | 383 道；可荐 305；`single` 257；`fixed` 283 | `npm run check:data` → 「菜品数据体检：383 道」；`observed-menu.json` 统计 |
| 契约 | `API.md` v1.2.9（主干）；#92 拟升 v1.2.10 | `docs/API.md` 版本表 |
| 测试 | server 119 / web 93 | `npm test -w @canteen/server`、`web/npm test` |
| smoke | 13/13 | `npm run smoke` |
| 进度体检 | 指纹一致，§5/§6 行格式正确 | `npm run check:progress` |
| 环境 | 本机 Docker 可用（11-23 已实跑 compose） | `reviews/pd/ACCEPTANCE-W2-W3-2026-11-15.md` W3-C1 |

### 1.1 待处理 PR（收口前）

| PR | 分支 | head | mergeable_state | 检查 | 评审 |
|---|---|---|---|---|---|
| #92 | `feat/breakfast-line-priority` | `80d8268` | `blocked` | lint / typecheck / test / deploy-config **4/4 success** | 0 |
| #84 | `docs/be-b-dockerfile-pitfalls` | `7c50c18` | `dirty` | 内容有效，与主干冲突 | 0 |
| #85 | `docs/be-b-manual-test-findings` | `319a38b` | `blocked` | 可合并，仅缺 Approve | 0 |
| #86 | `docs/be-a-review-api-v126` | `1c530cd` | `dirty` | 仅「六项→五项」有效，头部版本过时 | 0 |

> `blocked` 且 4/4 绿 = 只差人类 Approve。账号 `Aredjdhd` 是 #92 作者，GitHub 不允许自审。

---

## 2. 本轮 PD 裁决

### 2.1 #85 提出的三条健康规则（全部采纳）

| 编号 | 规则 | 裁决与理由 | 派给 |
|---|---|---|---|
| G | `BMI < 18.5` 且 `goal = lose` | **强制改为 `health`**，`warnings` 返回「BMI 低于 18.5 不提供热量缺口方案，已调整为保持」；前端禁用「减肥」。理由：与未成年禁缺口同一合规逻辑——偏瘦再减是健康风险 | BE-B |
| H | `BMI ≥ 24` 且 `goal = gain` | **仅提示、不动目标**：`warnings` 返回「当前 BMI 属超重/肥胖，增肌期建议优先增肌、控制增重速度」。理由：增肌是用户主动选择，服务端不应替用户改目标；提示即可 | BE-B |
| I | warnings 在两处重复判定 | **单一来源**：只在 `engines/nutrition.ts` 生成，`routes/profiles.ts` 读派生结果。理由：同一规则两处实现，早晚文案/阈值漂移 | BE-B |

配套 **J**：早餐常见池锁定为 炒饭 / 炒面 / 炒米粉（v1.2.10 口径），改池必须同步 `API.md §2.3` 与测试。

落点：`docs/PROGRESS.md §4.1` G/H/I/J、§2.5 步 5、§6 风险条目标注「已解决」。契约升 **v1.2.11**，不阻塞本机演示，C4 公开传播前必须闭环。

### 2.2 PR 收口决定

- **#84**：DEPLOY §7 四条全收（`NODE_ENV` 顺序、根 `tsconfig.base.json`、改 Dockerfile 必实跑、11-23 实测记录），关闭原 PR。
- **#85**：两条规则 + warnings 单一来源并入 §4.1/§6，关闭原 PR。
- **#86**：「六项」改为「五项营养值 + 两个元数据」直接修正；头部版本号同步已过时（主干 v1.2.9），关闭原 PR。
- **#92**：内容复核通过，留 COMMENT 评审，**不合并**——等人类 Approve。

> 关闭的 PR 分支均保留在远端，可随时重开；内容已由 `docs/pd-status-2026-11-26` 统一携带。

---

## 3. 文档变更（分支 `docs/pd-status-2026-11-26`，commit `99749f3`）

| 文件 | 改了什么 |
|---|---|
| `docs/PROGRESS.md` | §1 状态表重写（383 道 / 可荐 305 / main 7896d6b / API v1.2.9 / #92 待审）；§2.5 新增步 5（健康规则 G/H/I）；§4.1 新增 G/H/I/J；§5 新增 2026-11-26 PD 变更条；§6 新增两条阻塞 + 两条风险闭环 |
| `docs/API.md` | v1.2.6 行「六项」→「五项营养值（另带 day_kcal / meal_ratio 两个元数据）」（#86 有效内容） |
| `shared/src/types.ts` | `MealLogTarget` 注释同步，避免与 API.md 再次漂移 |
| `docs/DEPLOY.md` | 追加 §7（#84 内容），注明 384 为 11-23 当时值、当前 383 |
| `README.md` | 团队版状态改为「核心闭环已完成，仅剩 C4」；web 脚手架 / 种子 / 目录说明对齐现状 |
| `.github/progress-pd.sha256` | `npm run check:progress -- --sign` 重新签名 |

### 3.1 验证回执

```
npm run check      → lint / typecheck / test(119) / smoke 13/13 / check:data 383 / check:progress 全过
web npm test       → 17 files, 93 tests passed
```

---

## 4. 远端状态（逐分支）

| 分支 | 远端 | 说明 |
|---|---|---|
| `main` | `7896d6b` | 未动 |
| `docs/pd-status-2026-11-26` | **已推送 `99749f3`** | 未开 PR：与 #92 在 §5 顶部冲突，计划 #92 合入后 rebase 再开（开 PR 需用户点头） |
| `feat/breakfast-line-priority` | `80d8268` | PR **#92 open / blocked**，4/4 绿，等人类 Approve |
| `docs/be-b-dockerfile-pitfalls` | `7c50c18` | PR #84 **已关闭**（内容收编），分支保留 |
| `docs/be-b-manual-test-findings` | `319a38b` | PR #85 **已关闭**（内容收编），分支保留 |
| `docs/be-a-review-api-v126` | `1c530cd` | PR #86 **已关闭**（内容修正），分支保留 |

回执：`git ls-remote origin refs/heads/docs/pd-status-2026-11-26` → `99749f3718b6...`；PR 关闭与评论 ID 见 §5。

> 本分支只 push、未开 PR，**CI 未触发**（`actions/runs?branch=...` 返回 0 条；workflow 由 PR 或 main push 触发）。因此以本地全量 `npm run check` + web 93 为验证依据，开 PR 后再看 4 个 job。

### 4.1 已推送但未清理的旧分支（候选，未删）

`chore/codeowners-web`、`chore/merge-gate-rules`、`chore/progress-doc`、`docs/api-v1.2.1-portion`、`docs/progress-fix`、`docs/progress-sync-1106`、`feat/api-unify`、`feat/fe-a-api-review-w1`、`feat/fe-a-review-update-w1`、`feat/fe-a-w1-pages`、`feat/fe-b-web`、`feat/pd-data-review`、`feat/scaffold-ci`、`fix/ci-web-standalone`。

> 未删原因：仓库用 squash 合并，`git branch -r --merged` 判不出；GitHub 关闭 PR 列表请求超时未取全。下轮用 `pulls?state=closed` 取全后只删「PR 已 merged」的分支，删除前记录 head sha。

---

## 5. PR 操作回执

| 动作 | 结果 |
|---|---|
| #84 关闭评论 | comment id `7181425108` |
| #85 关闭评论 | comment id `7181425635` |
| #86 关闭评论 | comment id `7181425988` |
| #84/#85/#86 关闭 | 均返回 `state=closed` |
| #92 PD 复核 | review id `6068022808`，`state=COMMENTED` |

---

## 6. 阻塞与待交接

1. **#92 与 PD 分支都等人**：`blocked` 只因缺人类 Approve。需 `givehope488` / `pigQAQ` / `yangelect` 之一 Approve，再由有权限者合并。Agent 不自审、不自合。
2. **C4 小范围发布仍然做不了**：缺可分享部署地址与反馈群「食堂营养师」，已登记 §6；A5 已于 11-17 关闭，不再是门槛。
3. **健康规则 G/H/I 尚未实现**：文档已定稿，等 BE-B 落 `engines/nutrition.ts` + `routes/profiles.ts` 去重，契约 v1.2.11。
4. **PD 分支合入顺序**：#92 先合 → `git rebase origin/main` → 解决 §5 顶部两条记录 → 开 PR（需用户授权）。

---

## 7. 下一步（按顺序）

1. 等 #92 人类 Approve → 合并 → rebase PD 分支 → 开 PD PR。
2. BE-B 按 §4.1 G/H/I 实现，PD 复核 warnings 文案与 BMI 边界用例（18.4 / 18.5 / 24.0）。
3. C4 前确认真实地址 + 反馈群，补齐 ACCEPTANCE W3-C4/D1~D4。
4. 清旧分支（只删已 merged）。
---

## 8. 2026-11-26 追加：PR #93 已开 + C4 发布包

> 本节补记 §4 之后的进展，不改写 §4 当时状态。

### 8.1 PR #93

| 项 | 值 |
|---|---|
| PR | [#93](https://github.com/givehope488/nutritionist-prototype/pull/93) `docs(pd): 状态同步 383 道 + 健康规则 G/H/I 裁决 + PR 收口` |
| head | `3cfa754`（开 PR 时）→ 本节提交后以远端为准 |
| base | `main` `7896d6b` |
| mergeable | `true`，`mergeable_state=blocked`（只差真人 Approve，**无冲突**） |
| CI @ `3cfa754` | lint / typecheck / test / deploy-config **4/4 success**（API 回读） |
| reviewers | 已请求 `givehope488` / `pigQAQ` / `yangelect` |
| #92 reviewers | 补请求到 `givehope488` / `pigQAQ` / `wyf-111` / `yangelect` |

> 用户本轮明确授权「开pr」，故由 agent 代建；不自批、不合，等真人。

### 8.2 C4 发布包

新增 `reviews/pd/C4-RELEASE-KIT-2026-11-26.md`：前置条件、部署与自检命令、群公告文案、反馈收集约定、已知限制话术、回滚、发布记录模板。发布动作本身 11-23 已实测，缺的只有**地址**和**群**。

### 8.3 顺带发现（已登记 §6）

`docs/DEPLOY.md` / `docs/BACKUP.md` 写的根目录 `npm run backup` / `restore` 实际不存在——脚本只在 `server/package.json`。发布包先用 `npm run backup -w @canteen/server`，文档待 BE-B 二选一修（加根转发脚本或改文档）。

### 8.4 下一步（更新 §7）

1. 真人 Approve **#92**（优先合，早餐口径生效）→ 再 Approve/合并 #93；#93 与 main 无冲突，#92 合入后 §5 可能需一次 rebase。
2. BE-B 实现 §4.1 G/H/I，契约 v1.2.11。
3. C4：给地址 + 建群，然后照发布包执行。
4. 旧分支：确认 merged 后删除。

---

## 9. 2026-11-26 追加：备份命令选项 A 落地

> 用户选定「A：根目录加转发脚本」。本节记录实现、实测与一次操作事故。

### 9.1 改动

| 文件 | 改动 |
|---|---|
| `package.json` | 新增 `"backup": "npm run backup -w @canteen/server"`、`"restore": "npm run restore -w @canteen/server"` |
| `docs/BACKUP.md` | 顶部注明根目录执行；根脚本转发到 server workspace |
| `server/scripts/backup.ts` | `BACKUP_DIR` 相对路径改为按仓库根解析（与 compose `./backups` 卷一致） |
| `server/scripts/restore.ts` | 备份文件与目标库的相对路径改为按仓库根解析；原先按 cwd，`server/data/backups/...` 会变成 `server/server/...` |
| `docs/DEPLOY.md` | 数据回滚示例改为 `<备份文件>` 占位，避免写死相对路径 |
| `reviews/pd/C4-RELEASE-KIT-2026-11-26.md` | 命令改回短形式，注明路径解析口径 |
| `docs/PROGRESS.md` | §5 变更条 + §6「已解决」条，重新签名 |

### 9.2 干净环境实测（独立 worktree + `npm ci`）

```
npm run seed      → 383 道，server/data/runtime/app.db
npm run backup    → 9 ms / 132 KB，...\server\data\backups\app-...db
BACKUP_DIR=./backups npm run backup → 11 ms / 132 KB，落到仓库根 \backups\
npm run restore -- server/data/backups/app-...db restore-check.db → 3 ms，行数一致、完整性通过
npm run restore -- ./backups/app-...db restore-check2.db → 8 ms，行数一致
```

结论：文档里的 `npm run backup` / `npm run restore -- <备份>` 现在从仓库根可直接执行；相对路径不再依赖 cwd。

### 9.3 操作事故与恢复（如实记录）

第一次用 `node -e "..."` 内联脚本插入 PROGRESS 时，正文里的反引号被 **bash 命令替换**执行，实际跑了 `npm ci`、`npm run seed`、`npm run backup`、`npm run restore` 等片段，并因 `>` 重定向在仓库根生成了 4 个乱码未跟踪文件，同时 `npm ci` 中途 `EPERM` 使 `node_modules/.bin/tsx` 丢失。

处置：①按文件名删除 4 个垃圾文件（只保留 `菜品清单-v3-2026-11-24.csv`）；②重新 `npm ci`，`node_modules/.bin/tsx` 恢复，`npm run smoke` 13/13；③改用独立的 `.mjs` 文件插入 PROGRESS，成功并重签。**教训：含反引号/`>` 的多行文本一律写文件执行，不再用 `node -e`。**

### 9.4 远端状态

本节随分支 `docs/pd-status-2026-11-26` 推送到 PR **#93**；head 与 CI 以 `git ls-remote` / PR 页为准。合并仍需真人 Approve。

---

## 10. 2026-11-26 追加：合并 #92 + 健康规则 G/H/I 实现

> 用户指示「#92#93 都已通过，BE-B 的工作也做了，后期只剩两个人优化，把能做的都做了」。
> 实际核对：**#92 已真人 Approve 并合并**（`ebb81d4`）；**#93 的 Approve 被 GitHub 置为 DISMISSED**（推送新提交后自动失效），不能直接合。BE-B 未见新分支/PR，代码仍在旧实现，故由 PD 代做 G/H/I。

### 10.1 #92 合并与 rebase

| 项 | 结果 |
|---|---|
| #92 合并提交 | `ebb81d4`（merge，早餐优先池 / API v1.2.10） |
| 本分支 rebase | 7 个提交 rebase 到 `ebb81d4`，§5 冲突保留 PD 条目在上、FE-A 早餐条目在下 |
| rebase 后本地 head | `9096031`（随后新增 `b1548af`） |
| #93 审核状态 | `givehope488: DISMISSED`（head 更新导致），PR 为 `blocked`，需真人重新 Approve |

### 10.2 实现（提交 `b1548af`）

| 文件 | 改动 |
|---|---|
| `shared/src/constants.ts` | 新增 `BMI_UNDERWEIGHT = 18.5` / `BMI_OVERWEIGHT = 24`，前后端同源 |
| `server/src/engines/nutrition.ts` | `resolveGoal(goal, age, bmi?)` 返回 `{ goal, downgrade: 'minor' \| 'underweight' \| null }`；`calcTargets` 先算 BMI 再降级；G/H 文案只在引擎生成；`bmi_tag` 24~28 档统一「超重」 |
| `server/src/routes/profiles.ts` | 删除 `deriveBmi` 与重复的未成年判断，直接落库/回传 `calcTargets` 派生档案（规则 I） |
| `web/src/components/business/ProfileForm.vue` | 按实时身高体重算 BMI，<18.5 时禁用减肥并说明；未成年文案保留 |
| `web/src/views/goal/GoalView.vue` | 按档案 BMI 禁用减肥并说明 |
| `web/src/api/__mock__/nutrition.ts` | Mock 同步 G/H 与 `bmi_tag` 口径 |
| `docs/API.md` | 升 v1.2.11：§2.2 新增 G/H/I 与 `bmi_tag` 分级；附录 A 增加一行；版本表追加；修掉头部 v1.2.9 标题粘连 |
| `docs/PROGRESS.md` | §1 更新 main `ebb81d4`、契约 v1.2.10/v1.2.11；§2.5 步 5 标完成；§4.1 G/H/I 标已实现；§5/§6 追加；重签指纹 |

### 10.3 验证（本地，提交前）

```
npm run typecheck -w @canteen/server   → 通过
npm run test -w @canteen/server        → 131/131（8 文件）
web: npm run typecheck                 → 通过
web: npm test                          → 98/98（17 文件）
web: npm run lint                      → 0 error（1 条既有 LogView 警告）
npm run check                          → lint / typecheck / test 131 / smoke 13/13 / check:data 383 / check:progress 全通过
```

新增断言覆盖：BMI 18.4 降级 + 文案、18.5 临界不降级、24.0 增肌只提示、23.9 不提示、档案接口 G/H 两条、Mock 同口径、建档页实时锁/解锁、个人中心与目标页锁减肥。

### 10.4 待办

1. 真人重新 Approve **#93**（作者是 agent，不能自批；分支保护不可绕过）。
2. Approve 后合并 #93，fast-forward 本地 main，在 main 上复跑 `npm run check` + web test，记录合并提交。
3. C4 仍需用户提供可分享地址与反馈群。

### 10.5 远端推送与 CI（2026-11-26）

| 项 | 结果 |
|---|---|
| force-with-lease | 远端 `9dce5f1` → `c25c8e1`，成功 |
| PR #93 head | `c25c8e1` |
| CI @ `c25c8e1` | lint / typecheck / test / deploy-config **4/4 success** |
| PR 状态 | `open` / `mergeable=true` / `mergeable_state=blocked`（原 Approve 已 DISMISSED） |
| PR 标题/正文 | 已更新为本轮完整范围（健康规则 + 备份收口 + 状态同步） |
| 评论 | [#issuecomment-7181926531](https://github.com/givehope488/nutritionist-prototype/pull/93#issuecomment-7181926531)，@givehope488 请求重新 Approve |

> 后续只等真人 Approve；Agent 不自批、不合。合并后需 fast-forward 本地 main 并复跑检查。

---

## 11. 2026-11-26 追加：个人排除清单（只做 B，A 已按用户指示取消）

> 用户先选定「A+B：加个人排除」，随后明确「算了，不用做 A」。本轮**只实现 B**：session 级「不想再看到某道菜」清单，立即从推荐候选池过滤、可一键恢复。**A（把反馈数据回灌到全局推荐/运营修正）未做**，代码、表结构、接口都没有 A 的痕迹；文档与 PROGRESS 均如实标注取消原因。

### 11.1 实现（提交 `10e5464`，22 文件，+892/−24）

| 层 | 文件 | 改动 |
|---|---|---|
| 契约 | `shared/src/types.ts` | 新增 `DishExclusion` / `DishExclusionListResponse` / `DishExclusionRequest`，唯一类型源 |
| 存储 | `server/src/data/db.ts` | 新表 `dish_exclusions(session_id, dish_id, dish_name, created_at)`，主键 `(session_id, dish_id)` + session 索引；`resetDatabase` 一并清理 |
| 仓储 | `server/src/data/repositories.ts` | `dishExclusionRepository`：list / dishIds / add（INSERT OR IGNORE，返回是否新增）/ remove；删档案同事务级联删排除 |
| 接口 | `server/src/routes/dish-exclusions.ts`（新） | `GET /` 列表、`POST /` 新增（菜不存在 400，重复 200）、`DELETE /:dishId`（不存在 404）；挂载于 `/api/v1/dish-exclusions` |
| 推荐 | `server/src/routes/recommendations.ts` | 候选池先剔除本 session 排除的菜；全部排除时返回空 combos + 引导文案（不是错误） |
| Mock | `web/src/api/__mock__/*` | localStorage 同构存储；推荐同样过滤；区分「全被排除」与「忌口无解」两种 notice |
| 前端 | `web/src/composables/useDishExclusions.ts`（新） | 状态/请求全部收在 composable，组件不直连 API（守住分层测试） |
| 前端 | `web/src/components/business/DishExclusionsCard.vue`（新） | 吃过的菜 + 历史排除项都可点选/恢复，状态文案即点即现 |
| 前端 | `RecommendView.vue` / `FeedbackView.vue` | 推荐页排除后自动刷新；反馈页对已记录的菜直接排除 |
| 测试 | 服务端 5 例 + 前端 4 例 + 流程 1 例 | 幂等、跨 session 隔离、恢复后首套组合一致、级联删除、全排除文案、组件交互 |
| 文档 | `docs/API.md` | 升 v1.2.12：§2.3 候选过滤 + 全排除 notice，§2.6 三个接口与边界，版本表注明 A 未做 |
| 文档 | `docs/ARCHITECTURE.md` / `docs/PROGRESS.md` | 数据模型补表；§1/§2.5/§4.1-F/§5/§6 同步，重签指纹 |

### 11.2 验证（本地，提交前）

```
npm run test -w @canteen/server   → 136/136（9 文件）
web: npm test                     → 103/103（18 文件）
npm run smoke                     → 14/14（含「排除 → 推荐跳过 → 删除恢复」）
npm run check                     → lint / typecheck / test 136 / smoke 14 / check:data 383 / check:progress 全通过
web: npm run typecheck            → 通过
web: npm run lint                 → 0 error（1 条既有 LogView 警告）
web: npm run build                → 149 modules，CSS 35.23 kB / JS 197.87 kB
```

浏览器目视检查**未做**（本机无可用可视环境），交互由组件测试 + 流程测试覆盖。

### 11.3 远端与 PR 状态（2026-11-26 推送后）

| 项 | 结果 |
|---|---|
| 本地分支 | `docs/pd-status-2026-11-26` @ `10e5464` |
| 远端 head | `10e5464`（普通 fast-forward，`a6ecce7..10e5464`；首次 `--force-with-lease` 因本地跟踪引用陈旧被拒，未发生覆盖） |
| PR #93 | `open` / `mergeable=true` / `mergeable_state=blocked`，11 commits，head 已指向 `10e5464` |
| CI @ `10e5464` | run [45760613597](https://github.com/givehope488/nutritionist-prototype/actions/runs/45760613597) **completed / success**（lint / typecheck / test / deploy-config） |
| 合并 | **未合、未自批**；原 Approve 因新提交再次失效，仍需真人重新 Approve |

### 11.4 待办

1. 真人重新 Approve **#93**；Agent 不自批、不合、不改分支保护。
2. Approve 后合并 #93，fast-forward 本地 main，在 main 复跑 `npm run check` + web test，记录合并提交。
3. C4 仍缺可分享地址与反馈渠道；本机无 Docker CLI。

---

## 12. 2026-11-26 追加：#93 真人 Approve 后合并与 main 复验

> 用户告知「#93 通过了」。先经 API 核对：`givehope488` 于 05:27:28Z 提交 **APPROVED**，PR `mergeable=true` / `mergeable_state=clean`，head `36d0744`（13 commits）。确认后由 Agent 代点合并，**未自批、未改分支保护**。

### 12.1 合并与本地同步

| 项 | 结果 |
|---|---|
| 合并方式 | merge commit（与 #92 一致） |
| 合并提交 | `1cc5b91` — `Merge pull request #93 from givehope488/docs/pd-status-2026-11-26` |
| 本地 main | `ebb81d4..1cc5b91` fast-forward，与 `origin/main` 一致 |
| 工作区 | 仅剩按要求不提交的 `菜品清单-v3-2026-11-24.csv` |

### 12.2 main 复验（合并后）

```
npm run check                       → lint / typecheck / server 136/136 / smoke 14/14 / check:data 383 / check:progress 全过
web npm run typecheck               → 通过
web npm run lint                    → 0 error（1 条既有 LogView 警告）
web npm test                        → 103/103（18 文件）
```

CI：`10e5464` run 45760613597 success；`36d0744` run 45760766306 success（lint / typecheck / test / deploy-config）。

### 12.3 文档回填

`docs/PROGRESS.md`：§1 主干改 `1cc5b91`、契约改 v1.2.12 已生效、三条线状态收口；§2.5 步 5/6 改「已随 #93 合入 main」；§4.1-I 用例数改 136；§5/§6 顶部追加合并与阻塞解除条目；重签 PD 指纹。本日志为 append-only 记录。

### 12.4 剩余

1. **C4 小范围发布**：仍缺可分享的部署地址与反馈群（需要项目负责人提供）；本机无 Docker CLI。
2. D 组 4 项为发布后观察，C4 完成后启动。

---

## 13. 2026-11-26 追加：无 Docker 部署兜底与内网地址打通

> 用户指示「部署」。本机 **无 Docker CLI**，也没有云主机凭据；`C4-RELEASE-KIT` 要求的是「小范围可达」，因此先落地不依赖 Docker 的等价部署：单进程 Node 静态站 + 同源反代，再把本机内网地址作为 C4 的可分享入口。

### 13.1 实现

| 文件 | 改动 |
|---|---|
| `deploy/serve-prod.mjs`（新） | `web/dist` 静态站 + SPA 回落 + `/assets` 长缓存；`/api/*`、`/healthz` 反代 `127.0.0.1:8787`；无 CORS；路径穿越防护；后端不可用返回 502 JSON |
| `package.json` | 新增根脚本 `serve:prod` |
| `docs/DEPLOY.md` | 新增 §8：启动四步、内网 IP 分享、Windows 防火墙、权限/HTTPS/常开限制、cloudflared 临时公网地址的边界 |

### 13.2 本地实际部署（正在运行）

| 项 | 结果 |
|---|---|
| 构建 | `cd web && VITE_API_BASE="" npm run build` → 149 modules，JS 197.86 kB（gzip 67.26） |
| 数据 | `npm run seed` → 383 道 |
| 后端 | `npm start` → `:8787`（text_engine=template） |
| 静态站/反代 | `npm run serve:prod` → `0.0.0.0:8080` |
| 内网地址 | `http://192.168.5.8:8080`（WLAN） |
| 自检 | `/healthz` 200；`/api/v1/menu` 383 道；无令牌 `/api/v1/admin/dishes` 401；`/` 与 `/recommend`（SPA）200 |
| 真链路 | 经内网地址建档 BMI 22.2 / 2351 kcal → 午餐推荐 3 套（目标 940.4 kcal）→ 删除档案 204 |
| 检查 | 根 `npm run check`：server 136/136、smoke 14/14、data 383、progress 通过；lint 0 error |

### 13.3 明确未验证 / 限制

- **未验证同学端真机可达**：本机访问成功不等于跨设备可达；校园网若开 AP 隔离会互相不可达。
- **无 HTTPS、无进程守护**：地址依赖本机 WLAN 与电脑不关机；Qoder 会话结束后后台进程可能被回收，重启命令见 DEPLOY §8.1。
- **未复跑 Docker**：本机无 Docker CLI，compose 方案仍是 11-23 的既有验证记录。
- **反馈群仍未建立**，C4 正式勾选还缺这一项。

### 13.4 分支状态

部署兜底与合并记录提交在 `docs/pd-merge-record-2026-11-26`（基于 main `1cc5b91`），**尚未创建 PR**；PR 创建按约定由用户决定。

---

## 14. 2026-11-26 追加：用户决定「无需反馈群」，C4 取消群前置

> 用户原话「无需反馈群」。按此关闭反馈群事项，不改写历史条目，只追加状态与文档同步。

### 14.1 决定与落地

| 项 | 结果 |
|---|---|
| C4 前置 | 从「地址 + 群」改为「地址 + 小范围名单」；地址已就绪 `http://192.168.5.8:8080` |
| C5 渠道 | 不建群；回填页复制文本后直接私聊/口头发给 PD；PD 收到即看，首周每天主动问、之后每周一 |
| 闭环标准 | 不变：反馈必须进 §6 才算收到；菜品数据类 24h 内复核 |
| 代码/契约 | 无变更 |

### 14.2 文档同步

- `docs/PROGRESS.md`：§1 阶段与三条线、§4.1-F 渠道、当前风险、§5/§6 顶部追加决定；重签指纹
- `reviews/pd/C4-RELEASE-KIT-2026-11-26.md`：前置表、发布消息、反馈约定、发布记录模板与结论删除群
- `reviews/pd/ACCEPTANCE-W2-W3-2026-11-15.md`：C4 标注地址已就绪待分发；C5 补「不建群」决定

### 14.3 验证与边界

```
npm run check:progress  → 指纹一致，§5/§6 行格式通过
npm run lint            → 0 error
```

C4 仍未勾选：地址需要 PD 实际发给小范围同学；本机常开、同一 WLAN 的限制不变。

---

## 15. 2026-11-26 追加：用户决定「反馈收集不做」，并按指示开 PR

> 用户接续「无需反馈群」后明确「我不打算做，开pr」。前一轮把反馈改为私聊/口头，本轮进一步整体取消 C5 收集流程；同时获得明确授权，用 REST API 代建 PR。

### 15.1 范围调整

| 项 | 结果 |
|---|---|
| 群 / 人工收集 | **都不做**：不建群、不安排私聊或口头收集、不设值班人与时效 |
| 保留能力 | 回填页复制文本、`/feedback` 只读页仍在，但不再对应收集流程 |
| 菜品数据 | PD 主动巡检（菜单牌/照片/种子体检）→ §6 → `observed-menu.json` 重建种子 |
| 个人排除 | 不受影响，仍按 §2.6 即时过滤 |
| C4 | 只差把 `http://192.168.5.8:8080` 发给小范围同学 |

### 15.2 文档同步

- `docs/PROGRESS.md`：§1 阶段、§2 并行事项、当前风险、§4.1-F、§5/§6 追加；已重签指纹
- `reviews/pd/C4-RELEASE-KIT-2026-11-26.md`：前置表、发布消息、§4 反馈约定、发布记录模板与结论
- `reviews/pd/ACCEPTANCE-W2-W3-2026-11-15.md`：C5 改记为「用户决定不做」

### 15.3 验证

```
npm run check:progress  → 指纹一致，§5/§6 行格式通过
npm run lint            → 0 error
```

无代码与契约变更；部署服务仍在运行（内网 200）。
