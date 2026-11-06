# FE-B 开发记录（回填 / 反馈 / 历史 + 组件库）

> 维护人：FE-B。用途：记录本人在 `docs/TEAM.md` 中被分配任务的**实施过程、决策依据、踩坑与验收证据**，
> 让后来者能回答三个问题：这段代码为什么这么写、当时验证到什么程度、哪里还欠着。
> 规则：**每完成一张任务卡或修一个非显而易见的缺陷，就在本文档追加一条**（追加，不删改历史，改口径就在「变更记录」里注明覆盖了哪条）。
> 与 `docs/COLLAB.md` 冲突时以 COLLAB.md / API.md 为准，并在本文档登记冲突。

当前状态：**W1 组件库 + W2 闭环三页 可运行、可演示、CI 三件套全绿**；W3 异常与边界已覆盖前端部分。
最后更新：2026-11-06。

---

## 1. 任务对照表（TEAM.md → 实际产出）

> 任务口径已按 **TEAM.md v1.2（排期压缩为 3 周）** 对齐；v1.1 的 6 周里程碑见 §11 变更记录。
> FE-B 在 v1.2 里的三个里程碑：W1 组件库 → W2 三 回填页 → W2 四 闭环可演示；管理端 UI 已移出 3 周计划（进 V2）。

| 周 | TEAM.md 原任务 | 状态 | 产出位置 | 验收方式 |
|---|---|---|---|---|
| W1 | 前端脚手架（BE-B + FE-A/B） | ✅ 可跑版本，待 BE-B 接管 | `web/`（vite/ts/eslint/vitest 配置）、`index.html`、`src/main.ts` | `npm run dev` 起得来、`npm run build` 通过 |
| W1 | 设计系统：色板 / 卡片 / 步骤条 / 表单组件 | ✅ | `src/styles/tokens.css`、`src/components/base/*`（16 个） | 故事页 `/dev/components` 肉眼过 + `components.test.ts` |
| W1 | 组件故事页可预览 | ✅ | `src/dev/StoryView.vue`、`src/dev/fixtures.ts`、`src/dev/storyData.ts` | 浏览器访问 `/dev/components` |
| W1 | 自测脚本 `npm run e2e`（BE-B + FE-B） | ✅ 前端侧 | `src/tests/e2e/closureFlow.test.ts` | `npm run e2e` 3 用例通过 |
| W2 | 回填页：分类 Tab + 份数步进器 + 预填（里程碑 W2 三） | ✅ | `src/views/log/LogView.vue`、`AppTabs`、`AppStepper`、`DishCard`、`useLogDraft` | e2e 用例 1/2 + 浏览器实操 |
| W2 | 反馈页（对比条 + 判定文案）+ 历史页（里程碑 W2 四：闭环可演示） | ✅ | `src/views/feedback/FeedbackView.vue`、`src/views/history/HistoryView.vue`、`MacroBar`、`NutritionSummary`、`VerdictCard` | e2e 用例 1 + 浏览器实操 |
| W3 | 异常与边界（空态 / 弱网 / 重复提交 / 忌口无解） | 🟡 前端侧完成，依赖 FE-A 页面的边界待联调 | `AppErrorBanner`、`NoSolutionNotice`、`useAsync`、`asyncStates.test.ts` | 单测 + 断网/重复提交用例 |
| ~~W4~~ | ~~管理端：菜品 CRUD / 上下架 / 修订历史~~ | ⛔ 已随 v1.2 裁剪移出 3 周计划，PD 改用 `scripts/dish-admin.mjs`（BE-B，W2 五） | 无产出，前端不涉及 | — |

未在我名下、但我按契约留了接口的部分：建档 / 目标与忌口 / 推荐三页（FE-A）。路由已为其预留
`/profile`、`/recommend`，当前临时重定向见 `src/router/index.ts` 注释。

---

## 2. 环境与运行

```bash
cd web
npm install            # 依赖见 package.json；FE-B 未新增任何依赖（COLLAB.md 防线 3）
npm run dev            # http://localhost:5173  （/log /feedback /history /dev/components）
npm run lint           # eslint .
npm run typecheck      # vue-tsc --noEmit
npm run test           # vitest run（单测 + e2e，47 用例）
npm run e2e            # 只跑闭环流程
```

- 实测环境：Node v22.23.4 / npm 10.9.9（Windows）。**仓库还没有 `.nvmrc`**，属 BE-B 的根配置范围，见议题 Q8。
- Mock / 真实后端切换只靠环境变量：`VITE_API_BASE=mock://local` 走内置替身，改成真实 URL 即零改码切换（COLLAB.md 防线 4）。
- 数据源：`server/data/menu-seed.json`（55 道菜）经 `@menu-seed` 别名只读引入，前端不写回。

---

## 3. 目录与所有权自查

`.github/CODEOWNERS`（随 main `1275782` 进来）把「只改自己目录」升级成了平台强制：改动越界目录时 GitHub 自动加对应所有者为必需 Reviewer。
它按**页面目录**授权（`/web/src/views/log/`、`/feedback/`、`/history/` 归 @fe-b），所以我原来的扁平
`views/LogView.vue` 会落到兜底规则 `* @be-b` —— 等于所有权形同虚设。已按 CODEOWNERS 重排目录（见决策 B10）。

FE-B 名下目录（CODEOWNERS 口径）：`web/src/views/log|feedback|history/`、`web/src/components/`；
`web/src/api/` 是 @fe-a @fe-b 共同所有，动它必须叫上 FE-A。

本次实际**越界**的文件与原因（等 BE-B 接管，接管后我这边只改自己目录）：

| 文件 | 为什么 FE-B 先建了 | 待办 |
|---|---|---|
| `shared/types.ts` `shared/constants.ts` `shared/package.json` | 团队脚手架尚不存在，没有契约类型前后端都无法编译；已逐字按 API.md v1.1 转写，未自创字段 | CODEOWNERS 归 @be-b，需 BE-B 复核接管；文件头已注明维护人 BE-B |
| `web/package.json` `web/vite.config.ts` `web/tsconfig.json` `web/eslint.config.js` `web/.env.example` `web/index.html` | 同上，属于「让页面能跑起来」的最小脚手架 | BE-B 若重建，以本目录为参考实现 |
| `web/src/api/`、`web/src/composables/`、`web/src/utils/` | 契约里 FE-B 范围内的请求层与状态层 | `api/` 与 FE-A 共有，改动互相 @；`composables/`、`utils/`、`dev/` 未写进 CODEOWNERS，会落兜底 `* @be-b`，请 BE-B 补一行归属 |

`web/src/api/__mock__/` 是**服务端替身**，后端实装后整个目录删除，因此视图/组件禁止 import 它
（由 `src/tests/unit/layerBoundary.test.ts` 自动把关，不是口头约定）。

---

## 4. 决策记录（为什么这么写）

| # | 决策 | 理由 | 被否掉的备选 |
|---|---|---|---|
| B1 | 回填页不显示任何热量数字，只在提交后由服务端给对比 | 架构 D1「服务端是口径唯一来源」；回填时实时算热量会诱导前端造公式 | 原型那样边选边显示合计——迁移到前端计算，禁止 |
| B2 | 份数草稿存 sessionStorage，按 `日期+餐次` 分键，幂等 `id` 在提交成功前不变 | 契约 §0.7 以客户端 UUID 为幂等键；若每次进入页面都换新 id，弱网重试就会写出两条记录 | 每次 mount 生成新 UUID |
| B3 | 推荐组合明细缓存在前端 localStorage（24h） | 契约没有 `GET /recommendations/:combo_id`，回填页预填只能自取；TTL 按 §2.3「有效期 24 小时」 | 等后端补端点（阻塞 W2 闭环演示） |
| B4 | 反馈页数据先读 sessionStorage 缓存、回落 `GET /meal-logs` 列表过滤 | 契约没有按 id 精取单条的端点 | 议题 Q3，评审后再删这段兜底 |
| B5 | 展示层的比例/格式化只允许出现在 `utils/display.ts` + `MacroBar` | 「前端不算营养」需要一条可执行的边界；条宽是渲染比例，不是营养结论 | 各组件自己写 `actual/target*100` |
| B6 | B/C 级菜品隐藏精确克重，改显「估算值」徽标 | README 合规边界 4 + 架构 D5 | 统一显示克重（虚假精确） |
| B7 | 错误处理只在 `client.ts` 一处解包，页面只见 `ApiResult` | 契约 §0.8 统一包络；防线 1 的落地 | 每个页面各自 `try/catch` + 判 `res.data` |
| B8 | 组件故事页用 fixture 数据、不接接口 | 组件必须能脱离后端渲染，才谈得上单测与视觉回归 | 直接在真实页面上截图验收 |
| B9 | 根页面（回填 / 历史）不渲染返回按钮 | `AppNavBar` 原先无条件画「‹返回」，而根页面没有上一页、也没绑 `@back`，点了没反应——死按钮比缺按钮更糟。改为 `backLabel` 非空才渲染，反馈页显式 `@back="router.push('/log')"` | 保留按钮并让它 `history.back()`（用户可能退出整个 H5） |
| B10 | 三个页面各占一个目录：`views/log/`、`views/feedback/`、`views/history/` | CODEOWNERS 按目录授权，扁平文件会落进兜底 `* @be-b`，「只改自己目录」就没人把关了；顺带和 FE-A 的 `views/profile/` 等命名一致 | 保持 `views/XxxView.vue` 扁平（被 CODEOWNERS 判给 BE-B） |
| B11 | 3 周排期下不砍护栏、只砍功能 | TEAM v1.2 §3.4 明确「不可砍项」含 CI 三件套；我的 47 用例 + 分层边界测试就是护栏的一部分 | 为赶工先删测试（禁止） |

---

## 5. 待评审议题（契约缺口，我不能自己改）

按 API.md 附录 C 第 5 条，Agent/我均无权改字段。**下列每条都只在代码注释里标了编号，改法由 BE-A 定夺。**
每条给「现状 / 影响 / 我的临时兜底」，评审时直接照着过。

| # | 议题 | 现状与出处 | 影响 | 临时兜底 |
|---|---|---|---|---|
| Q1 | §2.3 响应示例的 `target.fat_g = 55` 与附录 A 算不拢 | `api/__mock__/nutrition.ts` 头注释 | 前端拿到的脂肪目标可能是示例值而非口径值 | Mock 按附录 A（日热量 27%）算，示例仅作字段形态参考 |
| Q2 | 忌口选项是单 `excludes_tag`，无法表达「纯素」 | `api/__mock__/avoidOptions.ts`：`vegan` 需排除 pork/beef/seafood/egg/milk 多标签 | 纯素用户可能仍被推荤 | Mock 里对 `vegan` 特判多标签；请评审把 `excludes_tag` 改为 `excludes_tags[]` |
| Q3 | 缺 `GET /api/v1/meal-logs/:id` | `composables/useMealLogLookup.ts` 头注释 | 反馈页刷新/换设备后要拉整页列表才能定位一条 | sessionStorage 缓存 + 列表过滤兜底 |
| Q4 | §2.4 `MealLog.target` 只有 `kcal` 与 `protein_g` | `views/FeedbackView.vue:31` 注释 | 反馈页脂肪/碳水/钠三条对比条只能显示「暂无目标」 | `MacroBar` 无目标时不画目标线、文案「暂无目标」（不显示「目标 0」） |
| Q5 | 「忌口过滤后无解」的判据未定义 | `tests/unit/closureEndpoints.test.ts:67` | 55 道菜 + 现有组合结构下，实测任何忌口组合都还有解，`notice` 分支在真实数据上不可达 | 断言改为「返回合法 combos」；`NoSolutionNotice` 组件与其单测保留，等 BE-A 给出无解判据 |
| Q6 | e2e 里建档/推荐两步是接口模拟 | `tests/e2e/closureFlow.test.ts` 头注释 | FE-A 页面合并前，e2e 不覆盖真实建档交互 | FE-A 合并后把两步替换成真实页面跳转（需 FE-A 提供可测的 DOM 锚点） |
| Q7 | 传输层失败（断网/超时/取消）没有契约错误码 | `api/client.ts:48` 注释 | 前端只能借用 `INTERNAL`，与"服务端异常"混在同一文案桶 | 借 `INTERNAL` + 可操作文案；请评审是否补 `CLIENT_NETWORK_ERROR` |
| Q8 | 根配置缺 `.nvmrc`，Node 版本未锁 | COLLAB.md 防线 3 要求；CODEOWNERS 已预留 `/.nvmrc @be-b` | 成员 Node 版本不一致时 CI 结果不可复现（本机 v22.23.4，文档示例 v24） | 无权限建根文件，等 BE-B 落 `.nvmrc` |
| Q9 | CODEOWNERS 未覆盖 `web/src/composables/`、`web/src/utils/`、`web/src/dev/` | `.github/CODEOWNERS`（`1275782` 引入）只列了 views 子目录、`components/`、`api/` | 这三个目录的 PR 会被兜底规则派给 @be-b，FE-B 成了非所有者，Review 链条绕人 | 代码已按现状提交；请 BE-B 补三行归属（建议归 @fe-b） |
> **与 FE-A 议题合并**（`origin/feat/fe-a-api-review-w1:reviews/fe-a/API-REVIEW.md`，评审时不要开两遍）：
> FE-A 的 **B3**（combo 槽位结构未下发）= 我的 Q1 + Q4；**Y4**（`combo.id` 过期处置 + 采纳→回填交接路径）= 我的 Q3 + 决策 B3；
> **G3**（`ApiResult` 边界形态给死）= 我的 Q7。四题同源，建议一次评审定完。

---

## 6. 踩坑记录（出错可溯源）

格式：**现象 → 真因 → 处置**。现象都有，真因才是重点，别再猜。

| # | 现象 | 真因 | 处置 |
|---|---|---|---|
| P1 | `NutritionSummary.vue(20,12) TS1005 ')' expected`，指向 `defineProps` 行 | 报错行是幌子。真因在 `<template>`：`:class="[...]` 模板串漏了收尾引号，解析器一路吃到 script 才炸 | 用「最小复现 + 逐步恢复」定位；class 改对象语法 `{ 'macros--compact': density === 'compact' }` |
| P2 | `<script setup>` 里 `export interface TabItem` 编译失败 | `<script setup>` 不允许顶层 export 类型声明 | 共享的组件入参类型抽到 `src/components/types.ts` |
| P3 | tsconfig 报 TS5101（baseUrl 已废弃） | TypeScript 6 起 `baseUrl` 不再默认支持 | 删 `baseUrl`，`paths` 改写为 `./src/*`、`../shared/*` 相对根 |
| P4 | `npm run e2e` 报 No test files found | vitest 的 `--dir` 参数与 `include` 组合下找不到文件 | 脚本改 `vitest run src/tests/e2e`（直接给路径） |
| P5 | e2e 三个用例全卡在 loading | Mock 网络层 `setTimeout(120)`，`flushPromises` 等不到真实定时器 | 新增 `VITE_MOCK_NETWORK=test`（0ms），`tests/setup.ts` 里强制；再加 `settle()`（flushPromises + macrotask ×4） |
| P6 | `RangeError: Maximum call stack size exceeded` | 批量替换把 `settle()` 函数体内的 `flushPromises()` 也换成了 `settle()`，自递归 | 恢复函数体；教训：批量替换要跳过被替换符号自身的定义体 |
| P7 | 推荐只返回 1 套（断言要 3 套），或主食重复 | 单遍贪心 + 去重条件互相矛盾：先满足「主食互不相同」就凑不满 3 套 | 三遍放宽 `pass(true,true)→(true,false)→(false,false)` + `taken` 集合去重 |
| P8 | `layerBoundary.test.ts` 里 `__dirname is not defined` / `The URL must be of scheme file` | ESM 无 `__dirname`；jsdom 下 `import.meta.url` 不是 file scheme | 改 `join(process.cwd(), 'src')` 并统一 `rel()` 前缀（views/components/tests） |
| P9 | 测试里 `expect(result.error)` 报 TS2339（`Property 'error' does not exist on ApiResult<never>`） | 判别联合必须先用 `if` 收窄，`expect(x).toBe(false)` 不产生类型收窄 | 断言前显式 `if (result.ok) throw`，让 TS 走失败分支 |
| P10 | 组件测试给 `useAsync` 传 `ApiResult<T>` 泛型 | `useAsync<T>` 的 T 是**业务数据类型**，包络由内部处理 | 泛型改回 `T`；顺带把「断网」用例从 fetch stub 改成直接单测 `transportError`（client 在 Mock 模式根本不走 fetch） |
| P11 | eslint 报 3 个 `_drop` 未使用 / 解构剔字段被判 unused | 默认规则不认「解构剩余」用法 | `ignoreRestSiblings: true` + `varsIgnorePattern: '^_'`；`camelcase: off`（契约字段是 snake_case，不是我们发明的） |
| P12 | 浏览器控制台 `[Vue warn]: Failed to resolve component: AppTabs` | 把餐次/日期切换从 `AppTabs` 换成 `AppSegmented` 时，顺手删了分类 Tab 仍在用的 `AppTabs` import。测试全绿（jsdom 对未解析组件只 warn） | 补回 import；**验收不能只看测试绿，必须开浏览器看 console warn** |
| P13 | 反馈页对比条显示「目标 0」 | 契约 `MealLog.target` 无脂肪/碳水/钠目标（议题 Q4），传 0 进来被当成真目标 | `MacroBar` 区分「无目标」：文案「暂无目标」、不画目标虚线、`data-state=neutral`；补单测 |
| P14 | 回填页副标题显示 `今天 · lunch` | 直接把契约枚举值渲染给用户 | 加 `mealLabel` 走 `MEAL_OPTIONS` 的中文标签（历史页/反馈页原本就对了） |
| P15 | 根页面有个点了没反应的「‹返回」 | 见决策 B9 | `AppNavBar` 的 `backLabel` 默认空、空则不渲染；反馈页补 `@back` |
| P16 | `git push` 挂住十几分钟、日志空、`git ls-remote` 却 2 秒成功 | 本机用的是 Qoder 自带 Git（`C:/Users/27370/.qoder-cn/bin/git`），其 `credential.helper=helper-selector` 会弹一个**看不见的 GUI 选择框**；凭据库里没有任何 github 条目，于是 git 一直等输入。读操作不需要凭据，所以 `ls-remote` 正常 —— 别把「读得通」当成「认证通了」 | 见 §11：改由本人在自己的终端跑 device 授权；Agent 侧不再重试（重试只会留下僵尸 git.exe，需 `taskkill //IM git.exe //F` 清场） |

---

## 7. 契约符合性自查（对照 API.md v1.1）

| 契约条款 | 前端落点 | 自动化把关 |
|---|---|---|
| §0.1 口径唯一，前端不算数值 | 视图/组件无营养公式 | `layerBoundary.test.ts`：禁止对 `kcal/protein_g/fat_g/carbs_g/sodium_mg/day_kcal` 做算术 |
| §0.3 snake_case 字段 | 只从 `@shared/types` 取类型 | `layerBoundary.test.ts`：禁止本地重写 `Dish/Profile/Combo/MealLog/MenuResponse/ApiResult` |
| §0.6 session_id 透传 | `useSession()` 生成 UUID 存 localStorage | e2e 全链路带同一 session |
| §0.7 幂等键 | `useLogDraft.logId` 提交成功前不变 | `closureEndpoints.test.ts` 重复提交断言 `duplicate: true` |
| §0.8 统一包络 | `client.ts` 单点解包成 `ApiResult<T>` | `apiContract.test.ts` 断言成功不裹 `data` |
| §1 错误码 | `AppErrorBanner` 按 code 给处置文案 + `fields` 定位 | `apiContract.test.ts` 越界字段断言 `fields[0].path === 'height_cm'` |
| §2.2 未成年双保险 | `AppRadioGroup.disabledReason` 禁用减脂 | 附录 A 断言：`age 16 + lose → goal health + warnings` |
| §2.3 combo.id 24h | `useRecommendationCache` TTL；过期提示回落自选 | e2e 用例 2（自选路径） |
| §2.4 回填判定 | 反馈页只渲染 `verdict` | `components.test.ts` VerdictCard |
| 合规边界 3/4 | `DishCard` 隐藏 B/C 级克重、`AppDisclaimer` 常驻 | `components.test.ts`：B 级不出现 `120g`、出现「估算值」 |

---

## 8. 验收证据

2026-11-06 实测（本机 Windows / Node v22.23.4）：

```
npm run lint      → 无输出（0 error / 0 warning）
npm run typecheck → 无输出（0 error）
npm run test      → Test Files 6 passed (6) / Tests 47 passed (47) / Duration 2.26s
                    layerBoundary 5 · apiContract 9 · asyncStates 5 · components 12 · closureEndpoints 13 · e2e 3
npm run build     → ✓ 118 modules transformed / built in 373ms
                    dist/assets/index.css 23.73 kB (gzip 4.58) · index.js 158.94 kB (gzip 55.74)
```

浏览器实测（`npm run dev` + 真机 Chrome，移动端 430px 视口）：

- `/dev/components`：色板、字号、按钮、卡片、步骤条（5 步）、分段/Tab/Chip、步进器、表单、菜品卡（A 级显克重 / B 级显「估算值」）、
  搭配卡与理由文案、5 条宏量对比条、判定卡、徽标/空态/加载/错误全部渲染正常。
- `/log`：餐次/日期分段、分类 Tab 计数（主食 9 / 主菜 19 / 蔬菜 9 / 汤品 4）、步进器 0.5 递增、
  底部「N 项已选」与「生成反馈」禁用态正确；提交后跳 `/feedback?id=...`。
- `/feedback`：判定「需调整 · 蛋白质没跟上」+ 服务端 body 原文；热量/蛋白有目标线，脂肪/碳水/钠显「暂无目标」；两个 CTA 生效。
- `/history`：近 7 天统计（1 餐 / 采纳率 0% / 291 kcal / 14 g 蛋白）、记录行可点回反馈页、免责声明常驻。
- console 无 Vue warn（P12 修复后复扫干净）。

---

## 9. 下一步（我这边欠的）

1. 与 FE-A 合并建档/推荐页：把路由 `/`、`/profile`、`/recommend` 的临时重定向改回，并按议题 Q6 重写 e2e 前两步。
2. 议题 Q1–Q9 提交评审；通过后删掉对应兜底代码（`__mock__` 目录整体删除是最大一块）。
3. W3 剩余边界（TEAM v1.2）：限流 429、菜品下架后回填旧记录、跨天回填（凌晨填昨晚）三例补测。
4. 周三中途集成点（TEAM v1.2 新增）：从 main 拉最新代码真机冒烟，需要 BE-A 的菜单/推荐 API 到位后把 `VITE_API_BASE` 切到真实后端跑同一套 e2e。
5. 视觉回归：目前靠肉眼过故事页，等 CI 有基线后补截图对比。

---

## 10. 变更记录

| 日期 | 提交 | 做了什么 | 关联 |
|---|---|---|---|
| 2026-11-06 | `cb731df` shared: 按 API.md v1.1 转写契约类型与常量 | `shared/types.ts`（254 行）+ `constants.ts` + `package.json` | 防线 1 |
| 2026-11-06 | `164f756` web: 搭 Vite+TS+ESLint+Vitest 脚手架与设计令牌、路由与外壳 | `vite/tsconfig/eslint` 配置、`tokens.css`、`router`、`App.vue` | 踩坑 P3、P11 |
| 2026-11-06 | `3a585e9` web: 请求层单点解包 + 内置 Mock 后端替身 | `api/client.ts`、`api/endpoints.ts`、`api/__mock__/*`、`composables/*`、`utils/display.ts` | 决策 B2/B3/B4/B7，议题 Q1/Q2/Q7 |
| 2026-11-06 | `cdc4742` web: 组件库 22 个（基础 16 + 业务 6） | `components/base/*`、`components/business/*`、`components/types.ts` | 决策 B5/B6/B8，踩坑 P1/P2 |
| 2026-11-06 | `5a7083f` web: 回填 / 反馈 / 历史三页与组件故事页 | `views/*`、`dev/*` | 决策 B1 |
| 2026-11-06 | `1caffb6` web: 契约/分层边界单测 + 闭环 e2e（47 用例） | `tests/unit/*`、`tests/e2e/*`、`tests/setup.ts` | 踩坑 P5/P6/P7/P8/P10，议题 Q5/Q6 |
| 2026-11-06 | 浏览器验收修正（折进上面两笔提交，非独立提交） | 补 `AppTabs` import；回填页餐次中文标签；`MacroBar` 无目标态；`AppNavBar` 死返回按钮；+1 单测 | 踩坑 P12–P15，决策 B9 |
| 2026-11-06 | `6781916` + `32c5c66` docs: 本开发记录 | 记录决策 / 议题 / 踩坑 / 验收证据 | — |
| 2026-11-06 | 拉取 `origin/main` → `1275782`（TEAM v1.2 三周排期 + CODEOWNERS + PR 模板 + API.md 管理端说明） | 本地 main 原落后 1 个提交；`git merge --ff-only` 更新 main 后把本分支 rebase 到新 main | 决策 B10/B11 |
| 2026-11-06 | `bed3472` web: 三页移入 `log/` `feedback/` `history/` 目录 | 让 CODEOWNERS 的按目录授权真正生效；同步改 `router` 与 e2e 的 import 路径；CI 三件套复跑全绿 | 决策 B10，议题 Q9 |
| 2026-11-06 | `1524931` docs: 开发记录对齐 TEAM v1.2 | 补决策 B10/B11、议题 Q9、rebase 后的提交号 | 决策 B10/B11 |
| 2026-11-06 | `746569a` docs: 记录推送认证受阻的根因与一次性授权步骤 | 新增 §11 | 踩坑 P16 |
| 2026-11-06 | `9e19d0f` docs: 议题与 FE-A 接口评审意见合并对照 | B3/Y4/G3 ↔ Q1/Q3/Q4/Q7 对照块 | §5 |
| 2026-11-06 | 本笔：§11 补「延后推送」决定与三条已试认证路径 | 记录 device 流在无头会话拿不到验证码、浏览器无 GitHub 会话，及两条被放弃的路子 | 踩坑 P16，§11 |

> **提交号会变**：上表的哈希是 rebase 之后的值。rebase 会重写哈希，所以引用提交号时**先确认分支没再 rebase**；
> 想知道某段代码的来历，用 `git log --follow -- <路径>` 比记哈希可靠。

分支：`feat/fe-b-web`（已 rebase 到 `origin/main` = `1275782`，工作区干净，13 个提交）。
远端状态：`main` 与本地一致；`feat/fe-b-web` **尚未推送**——推送卡在认证（踩坑 P16），需本人完成一次交互式授权，步骤见 §11。

---

## 11. 推送前置：一次性 GitHub 授权（待本人执行）

**2026-11-06 决定：延后推送**（本人不在电脑旁）。当夜尝试过的三条路都不通，记录在此免得下次重复试：

| 试法 | 结果 |
|---|---|
| `git push`（默认 helper） | 挂住无输出——`helper-selector` 弹不可见 GUI（P16） |
| `GCM_AUTHMODE=device` 直接跑 `git-credential-manager.exe get` | 走到 `Creating new credential...` 后停住，**始终没有吐出一次性验证码**；本机是无头会话，OAuth 授权页起不来 |
| 内置浏览器打开 `github.com/login/device` | 跳登录页——这台机器的浏览器**没有 GitHub 会话**，不能替本人完成授权 |

放弃的方向及原因：装 GitHub CLI 走 device 流（要往本机塞一个新工具和一份 OAuth token）、
让本人从手机粘 PAT（密钥经聊天传递）——都不如等回电脑跑一条命令。

**结论：本地分支状态完好（13 个提交、工作区干净、CI 全绿），推送延后到本人回到电脑旁。**


Agent 侧无法完成这一步：device 授权流要人在浏览器里输验证码，而本机的 `helper-selector` 弹的是不可见 GUI（P16）。在自己的终端（Git Bash）里执行：

```bash
cd /d/work/projects/nutritionist-prototype
GCM_AUTHMODE=device git push -u origin feat/fe-b-web
# 输出会给出 https://github.com/login/device 和一个形如 707C-BB63 的一次性代码
# 浏览器打开该地址、填代码、授权 → 推送自动继续
```

授权成功后凭据会落进 Windows 凭据库，之后不必再来一次。核验（`cmdkey /list` 在 Git Bash 里必须加
`MSYS2_ARG_CONV_EXCL='*'`，否则 `/list` 被 MSYS 当路径转换，会得到「凭据列表为空」的假象——FE-A 踩过同一个坑）：

```bash
MSYS2_ARG_CONV_EXCL='*' cmdkey /list | grep -i github
```

推送前如果想改署名（提交尚未公开，重写零风险）：

```bash
git rebase -i origin/main --exec   'git commit --amend --no-edit --author="你的名字 <你的 noreply 邮箱>"'
```

> 建议用 GitHub 的 noreply 邮箱（账号设置里勾了「Keep my email addresses private」时，
> 写真实邮箱等于把私邮放进公开历史）。当前 10 个提交沿用了仓库既有作者
> `zhang san <66499532+givehope488@users.noreply.github.com>`，未改动任何 git 配置。

推完之后：按 `.github/PULL_REQUEST_TEMPLATE.md` 开 PR（五项自检 + AI Agent 使用声明都要勾），
Reviewer 找 BE-B；`web/src/api/` 是 FE-A/FE-B 双所有者，PR 记得同时 @ FE-A。
