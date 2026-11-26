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