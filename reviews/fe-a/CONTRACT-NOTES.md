# FE-A 契约笔记：建档 / 目标与忌口 / 推荐

> 来源：`docs/API.md` v1.1（唯一事实源）。本文件是 FE-A 三页的字段绑定基准，也是给 Agent 喂的「契约上下文」裁剪件。
> 维护规则：本文件**只做摘录与映射，不新增字段**。API.md 变了先改 API.md（走附录 C），再同步这里。
> 更新日期：2026-11-06（W1）

## 0. 全局约束（每页都适用，逐条抄自契约）

| 约束 | 出处 | 页面落地方式 |
|---|---|---|
| 前端不做任何营养计算（BMR / 目标 / 评分 / 判定），只提交输入、渲染响应 | API.md §0.1；ARCH D1 | 页面里禁止出现公式；数值一律取服务端响应字段 |
| 字段 snake_case，枚举值小写 | §0.3 | 绑定时逐字段比对拼写，不驼峰化 |
| 单位：kcal / g / mg / cm / kg / 元（1 位小数） | §0.4 | 展示层加单位后缀，不做单位换算 |
| 类型只能从 `shared/` 导入，禁止在 view 里手写同名 interface | COLLAB 防线 1 | `import type { Dish } from 'shared/types'`；`shared/` 未就绪前，本任务不开工 |
| 成功 2xx 直返业务对象；失败 4xx/5xx 返单一 `error`；解包只在 `web/src/api/client.ts` 一处 | §0.8 | view 只见 `ApiResult<T>` 的两种形态，不判 `res.data` |
| `session_id` 前端首次生成 UUID 存 localStorage，透传所有需身份接口 | §0.6 | **归属未定，见评审单流程问题一节**，未认领前不写这个 util |
| 忌口过滤后无解不是错误：200 + 空 `combos[]` + `notice` | §1 注 | 空态是正常分支，按 W3 要求做引导（引导强度依赖 Y3 结论） |
| 未成年：`age<18 && goal=lose` 服务端强制 `health` + `warnings`；前端须同时禁用减脂选项 | §2.2 | 双保险的前端半边：`age<18` 时 `goal=lose` 选项 disabled + 说明文案 |

## 1. 建档页（`POST /api/v1/profiles`，upsert 以 session_id 为键）

请求字段（FE-A 提交侧，逐字段来自 §2.2 示例）：

| 字段 | 类型 | 取值 / 范围（§2.2 校验规则） | 控件 | 备注 |
|---|---|---|---|---|
| `session_id` | string | 首次生成的 UUID | 无（自动） | 不展示给用户 |
| `sex` | string | `male` / `female` | 单选 | 枚举表见 §2.2 之外的空白，Y7 |
| `height_cm` | number | 140~210 | 数字输入 | 范围应从 `shared/` 常量导入（G1），勿硬编码 |
| `weight_kg` | number | 35~150 | 数字输入 | 同上 |
| `age` | number | 14~70 | 数字输入 | 同上；`<18` 触发目标联动 |
| `activity` | string | `low` / `mid` / `high` | 三选 | 展示名与值的映射放页面，值不本地化 |
| `goal` | string | `health` / `lose` / `gain` | 三选 | `age<18` 时 `lose` 禁用 |
| `avoid` | string[] | 取自 `GET /menu` 的 `avoid_options[].key` | 多选 | 选项**不得**本地硬编码（§2.1 设计意图）；语义依赖 B2 |
| `default_meal` | string | 示例 `lunch`；枚举待明文（Y7） | 三选 | 推荐页默认餐段 |

响应字段（FE-A 渲染侧，含服务端派生值）：`session_id`、回显的全部请求字段、`bmi`、`bmi_tag`、`day_kcal`、`warnings[]`。

- `bmi` / `bmi_tag` / `day_kcal` 是**派生值，直接展示，不得重算**。
- `warnings` 目前是中文句子数组（Y2）：先按「整句展示」实现，结构化 code 等 BE-A 结论再改分支。
- 400 `VALIDATION_ERROR` 的 `fields[].path` 直接对应表单字段名（如 `height_cm`）→ 定位到输入框做行内提示，这是 §1 表里「按定位提示用户修正」的实现方式。
- `GET /api/v1/profiles/me?session_id=...` 返回同结构，档案不存在返回 **404** → 首访无档案是正常路径，不能当错误页处理（W3 空态）。

待澄清前不定稿的两点：BMI 实时刷新方式（Y1）、`bmi_tag` 值域与配色（Y1）。

## 2. 目标与忌口页（同一份档案的第二个入口）

- 数据源：`GET /api/v1/profiles/me` 回显 → 编辑 → `POST /api/v1/profiles`（upsert，无需区分新建/更新）。
- 忌口选项唯一来源：`GET /api/v1/menu?meal=<默认餐段>` 的 `avoid_options[]`（`key` / `label` / `excludes_tag`）。
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
| `id` | 不展示；跳转回填页时作为 `adopted_combo_id` 传递 | 有效期 24h，交接方式见 Y4 |
| `dishes[]`（`id/name/category/portion_label/servings/kcal/protein_g/fat_g/carbs_g/sodium_mg`） | 卡片行 | 槽位排版**依赖 B3 结论**，暂按 `category` 排序渲染 |
| `totals` | 宏量条实际值（与 `target` 同轴对比） | 缺价格合计，见 G2 |
| `reason` | 理由文案 | 服务端生成，**不得截断改写**（V1~V5 校验在服务端，ARCH §4.2） |
| `engine` | 小字标记 `template` / `llm` | 如实展示，不自行猜测；LLM 层已整体后移出 3 周计划（TEAM v1.2 §3.4），首版实际恒为 `template` |

**`notice`**：`combos` 为空时展示引导文案（见 B3/Y3，结构化放宽建议未定）。

页面红线：

- 卡片上任何数字只从响应取；`totals` 与 `target` 的百分比/差值若需要显示，**优先等服务端下发**，否则只能做纯视觉条宽映射（映射规则要在契约笔记里记死，避免和 FE-B 反馈页的对比条各算一套）。
- 「换一批」按钮在 B1 结论前**不实现**（先留空态 / 隐藏），避免做出一个骗人的交互。
- 推荐结果与回填页的交接：目前只能用路由参数 / localStorage（Y4 缺口），需要和 FE-B 约定统一 key 名，且明确「刷新后丢失」是否可接受。

## 4. 与 FE-B 的边界（避免重复实现）

| 事项 | FE-A | FE-B |
|---|---|---|
| 色板 / 卡片 / 步骤条 / 表单组件 | 消费 | 提供（TEAM.md v1.2 W1） |
| 建档 → 推荐 的表单与响应式状态 | 主责 | — |
| 推荐卡骨架（槽位） | 主责（但依赖 B3） | 回填页按同一骨架预填 |
| 宏量条组件 vs 反馈对比条 | 本餐目标对比 | 实际摄入 vs 目标判定 |
| `client.ts` 解包 + session_id 工具 | CODEOWNERS 判为**共担**（`web/src/api/` = @fe-a @fe-b）；建议 FE-A 主笔 | 建议只加自己的 `*.api.ts`，不改 `client.ts` |
| `router/`、`App.vue`、`main.ts` | 未在 CODEOWNERS 列出 → 落 `* @be-b` 兜底 | 同左 |

两处最容易分叉的是 **槽位结构**（B3）和 **`ApiResult` 解包判据**（G3）——必须共用同一份，否则集成演示当场暴露（v1.2 的集成点是 **W2 周三中途集成**，不是周五）。

我的三个页面在 CODEOWNERS 里的确切路径（**不是我原先猜的 `views/onboarding/`**）：

```
web/src/views/profile/     建档
web/src/views/goal/        目标与忌口
web/src/views/recommend/   推荐
```

## 5. 上游依赖清单（v1.2 压缩为 3 周后，W2 周二就要对接真实 API）

| 依赖 | 负责人 | TEAM.md 出处 | 当前状态（2026-11-06，已核对 `origin/main` @ `1275782`） |
|---|---|---|---|
| `shared/types.ts` + `shared/constants.ts` | BE-B | W1 共享类型包 | **文件树里没有 `shared/`** |
| Mock API（按契约返假数据） | BE-B | W1 Mock API | 不存在；FE-A 无法脱离后端开发 |
| `VITE_API_BASE` 切换机制 | BE-B | COLLAB 防线 4 | 不存在（无 `web/`、无 `package.json`） |
| 前端脚手架 + 设计系统组件 | FE-B | W1 前端脚手架 | 不存在 |
| CI 三件套 + lint 规范 | BE-B | W1 仓库脚手架；§3.4 **不可砍项** | 无 workflow 文件（`.github/` 只有 CODEOWNERS 与 PR 模板） |
| `.nvmrc` | BE-B | COLLAB 防线 3，CODEOWNERS 已列为 BE-B 所有 | **不存在** → 我本机 v26.13.0 属自便，需对齐 |
| B1 / B2 / B3 契约结论 | BE-A | W1 接口冻结 | 待本次评审答复 |
| Y5 可信度展示矩阵 | PD | 合规自查在 **W3**，但卡片设计 W2 末就要用 → 需提前 | 待 PD |
| CODEOWNERS 占位符替换为真实用户名 | BE-B | 防线 2 的平台强制前提 | 仍是 `@fe-a` 式占位符（评审单 C1） |
| Node 环境 | FE-A 本机自装 | COLLAB 防线 3 | 已装 v26.13.0 + npm 11.20.0 |

TEAM.md v1.2 §4.1 的原话是「W1 是全局瓶颈：接口冻结、`shared/`、Mock API 三样任何一样晚一天，五个人全部原地等待」。从 FE-A 侧看，这三样现在**一样都没有**，且 §4.4 写明「3 周无缓冲：预计延期 >2 天当天亮红」。所以我按 §4.4 的口径，把这条依赖缺失当作需要当天亮红的项，而不是自己等。

## 6. 变更记录

| 日期 | 变更 | 触发 |
|---|---|---|
| 2026-11-06 | 首版，基于 API.md v1.1 摘录；标注 7 处待澄清依赖 | W1 接口评审 |
| 2026-11-06 | 同步 `origin/main` `1275782`：页面路径改为 CODEOWNERS 的 `profile/goal/recommend`；`web/src/api/` 由「待认领」改为「FE-A+FE-B 共担」；依赖表按 3 周计划与 `.nvmrc`/CI 实况更新；集成点由周五改为 W2 周三 | TEAM.md v1.2 + CODEOWNERS 落地 |
