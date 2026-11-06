# FE-A 契约笔记：建档 / 目标与忌口 / 推荐

> 来源：`docs/API.md` **v1.2.1**（唯一事实源，2026-11-06 一致性修正版）。本文件是 FE-A 三页的字段绑定基准，也是给 Agent 喂的「契约上下文」裁剪件。
> 维护规则：本文件**只做摘录与映射，不新增字段**。API.md 变了先改 API.md（走附录 C），再同步这里。
> 代码侧镜像：`shared/src/types.ts`。v1.2 起文档/类型/实现三者已对齐，原 F1/F2 两处矛盾结案；忌口 key 的唯一事实源是 API.md **附录 D**（`contract.test.ts` CI 强制比对）。
> 更新日期：2026-11-06（深夜复核 `origin/main` @ `b29deff`：API v1.2.1 + PROGRESS.md 决议，§3/§4/§5 重写）

## 0. 全局约束（每页都适用，逐条抄自契约）

| 约束 | 出处 | 页面落地方式 |
|---|---|---|
| 前端不做任何营养计算（BMR / 目标 / 评分 / 判定），只提交输入、渲染响应 | API.md §0.1；ARCH D1 | 页面里禁止出现公式；数值一律取服务端响应字段 |
| 字段 snake_case，枚举值小写 | §0.3 | 绑定时逐字段比对拼写，不驼峰化 |
| 单位：kcal / g / mg / cm / kg / 元（1 位小数） | §0.4 | 展示层加单位后缀，不做单位换算 |
| 类型只能从 `@canteen/shared` 导入，禁止在 view 里手写同名 interface | COLLAB 防线 1 | `import type { Dish } from '@canteen/shared'`；`shared/` 已随 PR #2 就绪（npm workspaces 包名 `@canteen/shared`），本任务可开工 |
| 成功 2xx 直返业务对象；失败 4xx/5xx 返单一 `error`；解包只在 `web/src/api/client.ts` 一处 | §0.8 | view 只见 `ApiResult<T>` 的两种形态，不判 `res.data`；**client.ts 主笔已定 = FE-A（C2 结案）**，W1 交付 #1，须带 4 个单测（200 直返 / 400 转 error / 非 JSON / 网络异常） |
| `session_id` 前端首次生成 UUID 存 localStorage，透传所有需身份接口 | §0.6 | 随 client.ts 一起由 FE-A 实现（client.ts 主笔归属已定，见上一行） |
| 忌口过滤后无解不是错误：200 + 空 `combos[]` + `notice` | §1 注 | 空态是正常分支，须做「放宽条件」引导（PROGRESS §6 风险行点名推荐页空态设计，Y3 的页面半边归我）；字段结构化等 v1.3 |
| 未成年：`age<18 && goal=lose` 服务端强制 `health` + `warnings`；前端须同时禁用减脂选项 | §2.2 | 双保险的前端半边：`age<18` 时 `goal=lose` 选项 disabled + 说明文案 |

## 1. 建档页（`POST /api/v1/profiles`，upsert 以 session_id 为键）

请求字段（FE-A 提交侧，逐字段来自 §2.2 示例）：

| 字段 | 类型 | 取值 / 范围（§2.2 校验规则） | 控件 | 备注 |
|---|---|---|---|---|
| `session_id` | string | 首次生成的 UUID | 无（自动） | 不展示给用户 |
| `sex` | string | `male` / `female` | 单选 | 枚举已在 `@canteen/shared` 的 `Sex` 固化；API.md v1.2 已补 `meal`/`status` 枚举（Y7 结案） |
| `height_cm` | number | 140~210 | 数字输入 | 范围应从 `@canteen/shared` 的 `PROFILE_BOUNDS` 导入，勿硬编码（G1：`ACTIVITY_OPTIONS/GOAL_OPTIONS` 仍缺，展示名映射放页面） |
| `weight_kg` | number | 35~150 | 数字输入 | 同上 |
| `age` | number | 14~70 | 数字输入 | 同上；`<18` 触发目标联动（`MINOR_AGE=18` 也在 shared） |
| `activity` | string | `low` / `mid` / `high` | 三选 | 展示名与值的映射放页面，值不本地化 |
| `goal` | string | `health` / `lose` / `gain` | 三选 | `age<18` 时 `lose` 禁用 |
| `avoid` | string[] | 取自 `GET /menu` 的 `avoid_options[].key` | 多选 | 选项**不得**本地硬编码；唯一事实源 = API.md **附录 D**（9 项，含 `nogluten`；`contract.test.ts` CI 强制文档=实现）。无 `vegan`，素食 key 是 `nomeat`（F1 已结案） |
| `default_meal` | string | `breakfast` / `lunch` / `dinner`（`Meal` 已固化在 shared，Y7 结案） | 三选 | 推荐页默认餐段 |

响应字段（FE-A 渲染侧，含服务端派生值）：`session_id`、回显的全部请求字段、`bmi`、`bmi_tag`、`day_kcal`、`warnings[]`。

- `bmi` / `bmi_tag` / `day_kcal` 是**派生值，直接展示，不得重算**。
- `warnings` 目前是中文句子数组（Y2）：先按「整句展示」实现，结构化 code 等 BE-A 结论再改分支。
- 400 `VALIDATION_ERROR` 的 `fields[].path` 直接对应表单字段名（如 `height_cm`）→ 定位到输入框做行内提示，这是 §1 表里「按定位提示用户修正」的实现方式。
- `GET /api/v1/profiles/me?session_id=...` 返回同结构，档案不存在返回 **404** → 首访无档案是正常路径，不能当错误页处理（W3 空态）。

待澄清前不定稿的两点：BMI 实时刷新方式（Y1）、`bmi_tag` 值域与配色（Y1）——W1 验收未要求实时 BMI，这两点随 v1.3 跟踪，不阻塞。

## 2. 目标与忌口页（同一份档案的第二个入口）

- 数据源：`GET /api/v1/profiles/me` 回显 → 编辑 → `POST /api/v1/profiles`（upsert，无需区分新建/更新）。
- 忌口选项唯一来源：`GET /api/v1/menu?meal=<默认餐段>` 的 `avoid_options[]`（`key` / `label` / `excludes_tag`，即 shared 的 `AvoidOption`）。**B2 已结案**：附录 D 全表 9 项为唯一事实源，`excludes_tag` 保持单值、本项目**不做纯素**（PROGRESS §4.1-D）。实测 9 条清单见 §5.1。
- 页面不得自己判断「选了这些忌口还有没有解」——那是服务端推荐时才知道的事（§1 注 + B2/B3）。
- 未成年联动：`age` 改动即时影响 `goal` 可选项；**这是 UI 可用性约束，不是营养计算**，可以放前端；一旦服务端返回 `goal` 与用户所选不同，以服务端值为准并展示 `warnings`。

## 3. 推荐页（`POST /api/v1/recommendations`）

请求：`session_id`、`meal`、`overrides{ goal?, avoid? }`（临时生效、不落库，用于「换目标试算」）。

响应分三块，对应 UI 三块：

**`target`（宏量条的基准线，全部来自服务端）**

| 字段 | 用途 |
|---|---|
| `day_kcal` | 日目标，页头 |
| `kcal` / `protein_g` / `fat_g` / `carbs_g` / `sodium_mg` | 本餐目标，宏量条刻度基准 |
| `meal_ratio` | 本餐占日目标比例（附录 A：早 0.30 / 午 0.40 / 晚 0.35），用于「本餐 40%」这类说明文案 |

**`combos[]`（最多 3 套；TEAM.md 验收 = 3 套组合卡 + 宏量条 + 理由 + 换一批）**

| 字段 | 渲染 | 状态 |
|---|---|---|
| `id` | 不展示；跳转回填页时作为 `adopted_combo_id` 传递 | 有效期 24h；**过期处置已定**（PROGRESS §4.1-C）：过期视为自选餐，`adopted: false`，不报错 |
| `dishes[]`（= shared 的 `ComboDish`：`id/name/category/portion_label/servings/kcal/protein_g/fat_g/carbs_g/sodium_mg`） | 卡片行 | **B3 结案**：谁是主食谁是菜用 `category` 渲染，契约不加 `structure` 字段（PROGRESS §4.1-B）。同一次响应内主食互不相同、主菜不重复（BE-A W1 #2 验收） |
| `totals` | 宏量条实际值（与 `target` 同轴对比） | 缺价格合计，见 G2（v1.2 未加，等 v1.3） |
| `reason` | 理由文案 | 服务端生成，**不得截断改写**（V1~V5 校验在服务端，ARCH §4.2） |
| `engine` | 小字标记 `template` / `llm` | 如实展示，不自行猜测；首版实际恒为 `template` |

**`notice`**：`combos` 为空时展示引导文案（Y3 的页面半边归我：空态须给「放宽条件」引导，PROGRESS §6 风险行点名；结构化 `relax_suggestions` 字段仍待 v1.3，先整句展示 `notice`）。

**「换一批」（B1 结案，PROGRESS §4.1-A）**：不加任何请求参数，前端**再调一次** `POST /recommendations`，服务端每次在得分靠前的组合里重新抽 3 套。按钮实现 = 重新请求，不得在前端本地重排（那仍违反 D1）。

页面红线：

- 卡片上任何数字只从响应取；`totals` 与 `target` 的百分比/差值若需要显示，**优先等服务端下发**，否则只能做纯视觉条宽映射（映射规则要在契约笔记里记死，避免和 FE-B 反馈页的对比条各算一套）。
- 「换一批」按钮 = 重新请求（见上），不传排除参数、不做本地重排。
- 推荐结果与回填页的交接：`combo.id` 过期后按「自选餐」走（`adopted: false`）；预填的交接方式仍未明文（Y4 后半），W1 回填页验收未含预填 → 暂用路由参数 / localStorage，与 FE-B 约定 key 名待定。

## 4. 与 FE-B 的边界（避免重复实现）

| 事项 | FE-A | FE-B |
|---|---|---|
| 色板 / 卡片 / 步骤条 / 表单组件 | 消费 | 提供（FE-B 分支 `feat/fe-b-web`，PR #6 open 未合 main） |
| 建档 → 推荐 的表单与响应式状态 | 主责 | — |
| 推荐卡骨架（槽位） | 主责 | 回填页按同一骨架预填；**B3 已结案**：按 `category` 渲染，两页共用 `ComboDish` |
| 宏量条组件 vs 反馈对比条 | 本餐目标对比 | 实际摄入 vs 目标判定 |
| `client.ts` 解包 + session_id 工具 | **主笔 = FE-A**（PROGRESS §2.2 W1 #1，C2 结案） | 只加自己的 `*.api.ts`，不改 `client.ts` |
| `router/`、`App.vue`、`main.ts` 等 web 公共文件 | CODEOWNERS 新增 `/web/` 兜底 → **FE-A + FE-B 共担** | 同左 |

两处最容易分叉的 **槽位结构**（B3）和 **`ApiResult` 解包判据**（G3）均已定：B3 = 按 `category` 渲染；G3 = `client.ts` 归 FE-A 主笔、以 4 个单测（200 直返 / 400 转 error / 非 JSON / 网络异常）钉死边界形态。CODEOWNERS 更新后我的地盘是：

```
web/src/views/profile/     建档（FE-A 独有）
web/src/views/goal/        目标与忌口（FE-A 独有）
web/src/views/recommend/   推荐（FE-A 独有）
web/src/api/               FE-A + FE-B 共担（client.ts 由 FE-A 主笔）
web/src/composables/       FE-A + FE-B 共担
web/src/utils/             FE-A + FE-B 共担
web/src/tests/             FE-A + FE-B 共担
web/（其余）               FE-A + FE-B 共担兜底
```

## 5. 上游依赖清单（W0 收尾 + W1 开工，排期已细化为 W0 11-06~11-08 / W1 11-09~11-13）

> 2026-11-06 深夜复核重写：基准 `origin/main` @ `b29deff`（API v1.2.1 + PROGRESS.md 决议 + CODEOWNERS web 覆盖 + CI web 独立安装）。凡「已就绪」项均经过**本地实跑**，命令与输出见 WORKLOG §15。

| 依赖 | 负责人 | 出处 | 当前状态（2026-11-06 深夜，`b29deff` + 本地实测） |
|---|---|---|---|
| `@canteen/shared`（types + constants） | BE-B | W1 共享类型包 | **已就绪**：`shared/src/types.ts` + `constants.ts`。**导入名是 `@canteen/shared`**；v1.2 起文档/类型/实现对齐 |
| 契约 | BE-A + PD | API.md | **v1.2.1 已冻结**（2026-11-06 一致性修正版），B1/B2/B3/Y5 全部有结论；FE-A 已签字 |
| Mock API | FE-B | PROGRESS W1 FE-B #2 | **已存在但未合 main**：FE-B 分支 `feat/fe-b-web` 的 `web/src/api/__mock__` 内置假后端（PR #6 open，66 文件 +9467 行，三项检查已绿，合并前还差 3 处契约对齐）。W1 我开发用它的 Mock，字段名照 `shared/src/types.ts` |
| `VITE_API_BASE` 切换机制 | FE-B | COLLAB 防线 4 | **已落地**（FE-B 分支）：`web/.env.example` 定义 `VITE_API_BASE`，`mock://local` 默认指内置 Mock，`http://localhost:8787/api/v1` 指真实 BE |
| 前端脚手架 + 设计系统组件 | FE-B | W1 前端脚手架 | **已存在但未合 main**（同上 PR #6）；合并前等 BE-B 定安装方式——已定：web **独立安装**（PR #12，`working-directory: web` 先 `npm ci` 再跑） |
| CI | BE-B | §3.4 不可砍项 | **已就绪且扩容**：lint/typecheck/test 三 job + web 独立 lint/typecheck/test + `check:data` + `check:progress`；Node 22 全绿。本机 Node 26 复跑六件套全部 exit 0 |
| `.nvmrc` | BE-B | COLLAB 防线 3 | **已就绪**：=22，`engines.node >=22`；本机 v26.13.0 实测通过 |
| smoke / seed 脚本 | BE-B | W1 交付 #1/#3 | **已列入 W1 清单、未就绪**：`scripts/smoke.mjs`（9 组端点一行一判）与 `npm run seed`（SQLite 落库）都是 BE-B 的 W1 交付，11-13 前。**e2e 仍无人认领**（F3 残余） |
| 后端业务端点 | BE-A / BE-B | PROGRESS W1 | 当前只有 `GET /api/v1/menu` + `/healthz`；profiles（BE-B）、recommendations（BE-A）是 W1 交付。我 W1 先对 Mock 开发 |
| `client.ts` 主笔 | **FE-A（我）** | PROGRESS §2.2 W1 #1 | 已定：解包只在一处 + 4 个单测（200 直返 / 400 转 error / 非 JSON / 网络异常）；业务代码禁止 `res.data` |
| CODEOWNERS | BE-B / PD | 防线 2 | 已实名 + 补 web 覆盖（PR #7）：`/web/` 与 composables/utils/tests 归双前端共担；`/reviews/` 与 `/docs/PROGRESS.md` 归 PD → 我改评审文档需 PD 批准 |
| Node 环境 | FE-A 本机 | COLLAB 防线 3 | v26.13.0 + npm 11.20.0，六件套实测全绿 |

W1 之前我没有硬依赖了：Mock 在 FE-B 分支上（PR #6 未合 main 也能切分支用），`client.ts` 是我自己的交付，建档/目标/推荐三页是 W1 我自己的活。真正需要别人先动的是 W2 联调的真接口（profiles 11-13 前由 BE-B 交、recommendations 由 BE-A 交）。

### 5.1 实测样本：真实服务端 `GET /api/v1/menu`（2026-11-06 深夜，API v1.2.1 代码，本机 Node 26 实跑，非 Mock）

- 起服务：`npm run start -w @canteen/server`（Express，端口 8787）。`GET /api/v1/menu?meal=lunch` → **200**，`dishes` 41 道、`avoid_options` **9 条**；`GET /api/v1/menu?meal=brunch` → **400**，实测包络（已落文件）：

```json
{"error":{"code":"VALIDATION_ERROR","message":"meal 取值须为 breakfast / lunch / dinner","fields":[{"path":"meal","issue":"取值非法"}]}}
```
- 单条 dish 真实响应（与 API.md v1.2.1 示例一致，F2 已结案）：

```json
{"id":"s01","name":"白米饭","category":"staple","portion_label":"1 份","meals":["lunch","dinner"],"kcal":232,"protein_g":4.4,"fat_g":0.6,"carbs_g":51.6,"sodium_mg":2,"price_yuan":1,"tags":[],"drink":false,"reliability":"B","status":"active"}
```

- `avoid_options` 实测 9 条（= API.md 附录 D，`key` → `label` / `excludes_tag`，**每 key 单 tag 是最终结构，纯素不做**）：`nospicy` 不吃辣/`spicy`、`nopork` 不吃猪肉/`pork`、`nobeef` 不吃牛肉/`beef`、`noseafood` 不吃海鲜/`seafood`、`noegg` 不吃鸡蛋/`egg`、`nomilk` 不吃奶制品/`milk`、`nopeanut` 不吃花生/`peanut`、`nogluten` 不吃麸质（小麦制品）/`gluten`、`nomeat` 素食/`meat`。
- 份量标签枚举（实测）：`1 份 / 1 碗 / 1 个 / 1 只 / 1 根 / 半份`；`portion_grams` 一律不下发（v1.2.1 + `app.test.ts` 断言）；`reliability` 全部 55 道 = `B` → 按 D4，A/B 级同一套 UI、不加「估算」标记，克重前端根本没有（Y5 结案）。

## 6. 变更记录

| 日期 | 变更 | 触发 |
|---|---|---|
| 2026-11-06 | 首版，基于 API.md v1.1 摘录；标注 7 处待澄清依赖 | W1 接口评审 |
| 2026-11-06 | 同步 `origin/main` `1275782`：页面路径改为 CODEOWNERS 的 `profile/goal/recommend`；`web/src/api/` 由「待认领」改为「FE-A+FE-B 共担」；依赖表按 3 周计划与 `.nvmrc`/CI 实况更新；集成点由周五改为 W2 周三 | TEAM.md v1.2 + CODEOWNERS 落地 |
| 2026-11-06 | 复核 `origin/main` `496c1ef`：§0/§1/§2/§3 导入路径与类型名对齐 `@canteen/shared`（含 `PROFILE_BOUNDS`/`MINOR_AGE`）；§5 依赖表按 PR #2 实况重写（shared/CI/.nvmrc 已就绪，web/、smoke/e2e/seed、接口结论仍缺）；新增 §5.1 真实服务端 `/menu` 实测样本（含 F1 `vegan`→`nomeat`、F2 份量标签两处契约-代码差异） | main 前移 4 个 PR + 本机实跑服务端 |
| 2026-11-06 | 复核 `origin/main` `b29deff`：契约基准改 **API v1.2.1**（附录 D 9 项忌口全表、`portion_label` 禁克重、`portion_grams` 一律不下发）；§1/§2 忌口与枚举行更新；§3 写入 PROGRESS 三项决议（B1 换一批=重新请求、B3 category 渲染、Y4 过期=adopted:false）；§4 边界表按 CODEOWNERS web 覆盖与 client.ts 主笔（FE-A）重写；§5 依赖表按 W0/W1 排期与 PR #6/#12 实况重写；§5.1 重抓 9 条忌口选项样本 | main 前移 8 个 PR + API v1.2.1 + PROGRESS.md 决议 |
