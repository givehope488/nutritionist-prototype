# API.md v1.1 前端侧评审意见单（FE-A）

> 评审人：FE-A（建档 / 目标与忌口 / 推荐页负责人）
> 评审对象：`docs/API.md` v1.1（2026-11-05，W1 评审冻结版）
> 评审日期：2026-11-06
> **v1.2 适配（2026-11-06 追加）**：`origin/main` 新增提交 `1275782`（TEAM.md v1.2 把 6 周压成 **3 周**、新增 CODEOWNERS 与 PR 模板、API.md 管理端补注）。已据此修订本文的排期引用与「目录归属」一节，见文末 C1~C5。**契约字段本身未变**（API.md 本次只在 §3 管理端加了 2 行说明），所以 B1~G3 各条结论不受影响；但工期压成 3 周后，每条的处置时限都提前了。
> **v1.3 复核（2026-11-06 晚追加）**：`origin/main` 已前移至 `496c1ef`（本单 PR #1 合入 + #2 脚手架/shared/CI + #3 COLLAB 防线 7 + #4 种子 v2）。**C1/C3/C5 已结案**；B2/Y5/Y6 的证据被上游更新；另发现 F1~F4 四处「代码先行、契约未跟」。逐条处置见文末「复核增补」；正文保留评审时点原文不改写。
> 评审视角：**只评「前端能不能不靠猜就把页面写出来」**，不评算法口径（归 BE-A）、不评数据准确性（归 PD）。
> 流程约束：按 COLLAB.md 防线 5 / API.md 附录 C.5，本单所有「改字段」的建议**都只是提请评审议题**，FE-A 与其 Agent 均不自行改动契约，也不在前端做兜底实现。

## 结论先说

**FE-A 目前无法签字冻结 v1.1。** 有 3 条阻塞项（B1/B2/B3）会让 W2 的「建档→推荐」链路在写代码阶段就退化成各自猜，正是 COLLAB.md §1 列的 F1/F3 失败模式。另有 1 条是合规红线，在 3 周计划里拖到 W3 合规自查才发现就来不及了（Y5）。

其余条目不阻塞冻结，但需要在下周会前给出归属或答复。

严重程度：**B = 阻塞冻结**，**Y = 需澄清（不解决会在 W2/W3 卡住）**，**G = 建议**。

---

## B1（阻塞）「换一批」在契约里没有实现路径

- 契约位置：API.md §2.3 请求体只有 `session_id` / `meal` / `overrides`，无分页、无排除、无随机参数。
- 需求位置：TEAM.md v1.2 W2「推荐页（3 套组合卡 + 宏量条 + 理由 + **换一批**）」，里程碑 **W2 末走通 建档→推荐**（原 6 周计划里的 W2-W3 已被压缩，FE-A 是 A/R）。
- 为什么阻塞：架构文档 §3 的推荐链路是「过滤 → 枚举 → 评分排序 → 取 3 套」的确定性过程，同参数重复请求必然返回同样 3 套。前端唯一能「换」的办法是自己把后面的组合挪到前面——这违反 D1「服务端是营养计算口径唯一来源」，属于速查表里「前后端显示的数字对不上」那一类。
- 请 BE-A 定夺（择一，均为新增字段，按附录 C.3 可直接加）：
  1. 请求加 `exclude_combo_ids: string[]`，前端把已展示过的 3 个 id 回传；
  2. 请求加 `variant: integer`（0/1/2…），服务端决定如何取第 N 批；
  3. 需求降级：把「换一批」改成「换一餐段」，同步更新 TEAM.md 验收标准。
- FE-A 立场：选 3 也可以接受，但**必须在冻结前定**，不要等 W2 写完了再回来改契约。

## B2（阻塞）忌口选项全量清单与多标签排除语义未定义

- 契约位置：API.md §2.1 `avoid_options` 只给了 1 条示例 `{ "key": "nospicy", "excludes_tag": "spicy" }`；§2.2 `avoid` 示例 `["nospicy"]`；§2.3 `overrides.avoid` 示例又冒出 `["vegan", ...]`——`vegan` 这个 key 在契约任何位置都没有定义，`tags` 枚举里也没有 `vegan`。
- 需求位置：TEAM.md W2「目标与忌口页」是 FE-A 的 A/R，页面主体就是这组多选。
- 未定义的三件事：
  1. 全量 `key` 清单及其展示名（建档页渲染要逐条来自服务端下发，这是 §2.1 括号里写明的设计意图，但示例只 1 条，前端无法验证「下发是否完整」）；
  2. 多个 key 之间是 AND（同时满足）还是 OR（任一命中即排除）；
  3. **一个 key 需要排除多个 tag 时无法表达**——`excludes_tag` 是单值字符串。
- 数据证据（`server/data/menu-seed.json`，55 道全量统计）：
  - `tags` 里 `meat` 与 `pork` 是交集而非包含关系：`pork` 共 13 道，其中 3 道**只标 `pork` 不标 `meat`**——`s11 小笼包`、`s12 蒸饺`、`s13 肉包`（均为早餐 `staple`）。
  - 因此若「素食」类忌口映射为 `excludes_tag = "meat"`，早餐组合会把 3 道猪肉包子当成非肉主食推出来。这是把忌口用户直接推错的餐，不是显示问题。
  - 午餐蛋白池 19 道，tag 分布：`meat=15 / pork=7 / egg=3 / seafood=2 / beef=1 / vegprotein=4 / gluten=1 / peanut=1`。纯素场景需同时排除 `meat/pork/beef/seafood/egg/milk` 六个 tag，排除后 `protein` 仅剩 2 道、`soup` 剩 **0 道**。单值 `excludes_tag` 从结构上就表达不了这件事。
- 建议（走附录 C 流程，由 BE-A 判定）：`avoid_options` 项改为 `excludes_tags: string[]`（`excludes_tag` 保留一个版本过渡，附录 C.3），并在 API.md 附录补一张「key → 排除 tag 集合」全量对照表，语义由 PD + BE-A 共同认定。
- FE-A 不会做的事：不在前端自己维护一份 `key → tag` 映射表兜底（那就是「前后端硬编码两份」，正是 §2.1 想避免的）。

## B3（阻塞）combo 的槽位结构未定义，卡片骨架与跨页交接都落不了地

- 契约位置：API.md §2.3 `combos[].dishes[]` 只有 `category` 字段，未规定每套含哪些槽位、几个菜、汤是否必需。
- 架构位置：ARCHITECTURE.md §3.b 写「枚举 主食×主菜×素菜×汤 组合（**早/午晚两种结构**）」——结构信息只存在于后端算法内部，没有下发给前端。
- 为什么阻塞 FE-A：推荐页卡片要按槽位排版（TEAM.md「3 套组合卡 + 宏量条」）；更关键的是 TEAM.md W2 里 FE-B 的回填页要求「预填」，两页必须共用同一套槽位理解。契约不给，FE-A 和 FE-B 只能各猜一套，周五集成演示当天才会暴露。
- 数据证据：早餐池 `staple=7 / protein=5 / fruit=2`，`veg=0`、`soup=0`；午餐池 `staple=9 / protein=19 / veg=9 / soup=4`，`fruit=0`。即早餐结构里不可能出现汤槽，午餐不可能出现水果槽——但前端现在是靠我统计 JSON 才知道的。
- 建议：§2.3 响应为每套 combo 增加槽位标记（如 `dishes[].slot` 或 `combo.structure: "breakfast" | "main_meal"`），或在 API.md 明文写出两种餐段结构的槽位定义与「汤/水果可选」规则。后者零接口改动，最快。

## Y1（需澄清）`bmi_tag` 无值域定义，且「BMI 实时」与「前端禁止计算」存在口径冲突

- 契约位置：§2.2 响应示例 `"bmi": 21.97, "bmi_tag": "正常"`，全文没有 `bmi_tag` 的枚举表；附录 A 只给了 BMR / 活动 / 目标系数，**没有 BMI 分档阈值**。
- 需求位置：TEAM.md W2「建档 / 目标与忌口页（含未成年分流、**BMI 实时**）」；同时 API.md §0.1 与架构 D1 规定前端不做任何营养数值计算。
- 冲突点：BMI 若实时显示，要么前端自己算（违反 D1），要么每次输入变动都打 `POST /profiles`——但那是 **upsert 落库**，用户还没点提交就已经写库并触发未成年目标降级，副作用不可接受。
- 请 BE-A 定夺：
  1. 附录 A 补 BMI 公式与分档阈值，值域固定（`偏瘦/正常/偏胖/肥胖` 之类），并考虑同时下发机器可读码（如 `bmi_code`），前端不拿中文串做分支；
  2. 「实时」的实现路径：建议由后端提供**只读试算**入口（不落库），或明确允许「本地只做输入合法性提示，数值以服务端返回为准」——后者需要 PD 确认它与 D1 的关系。
- FE-A 立场：我倾向第二种（服务端试算端点），但这属于**新增端点 = 接口变更**，我不会让 Agent 自己加，等 BE-A 定。

## Y2（需澄清）未成年降级只有中文文案，前端无法可靠分支

- 契约位置：§2.2 `warnings: ["未满18岁不提供热量缺口方案，已调整为日常保健"]`（自由字符串数组）。
- 需求位置：TEAM.md v1.2 W3 FE-A 任务「异常与边界（… 忌口无解提示）」、W2「未成年分流」都要求按场景出不同交互。3 周计划里 W3 就是上线周，这条若拖到 W3 等于没有应对时间。
- 风险：前端只能靠字符串匹配来区分「未成年降级」和别的告警。文案一改，交互就静默失效——这是 COLLAB.md §1 的 F3。
- 建议：`warnings` 项结构化（`{ "code": "minor_goal_downgraded", "message": "…" }`），或顶层加 `flags: string[]`。
- 不阻塞说明：§2.2 末尾已明确「前端须同时禁用减脂选项（双保险）」，这条**契约是够用的**，FE-A 可以照做（`age < 18` 时禁用 `goal = lose`，纯 UI 约束、非营养计算）。本条只关乎事后的提示分支。

## Y3（需澄清）`notice` 是整段文案，无解场景做不出「放宽哪一项」的可操作引导

- 契约位置：§1 注释 + §2.3「无解时 `combos: []`，`notice` 为引导文案」。
- 数据证据：早餐 + 忌口含 `gluten` 时，7 道早餐主食只剩 **1 道（s10 白粥）**，其余 6 道（小笼包/蒸饺/肉包/菜包/油条/煎饼果子）全带 `gluten`。也就是说无解不是边角情况，是常见路径，必须有交互兜底。
- 建议：请 BE-A 评估新增 `relax_suggestions: [{ "key", "label" }]`（指出放宽哪一项能出解），纯新增字段。前端保留「只展示 `notice` 整句」作为降级。

## Y4（需澄清）`combo.id` 过期 / 采纳→回填交接路径未定义

- 契约位置：§2.3「`combo.id` 短哈希，供回填时关联采纳，有效期 24 小时」；§2.4 请求体 `adopted_combo_id`；§1 错误表**没有对应场景**。
- 缺口：
  1. 过期后 `POST /meal-logs` 是返回 404 还是 200 + `adopted: false`？两种处置在回填页完全不同（跳错误页 vs 提示「已按自选记录」）。
  2. 全仓库没有 `GET /recommendations/:id`，回填页无法凭 `combo.id` 反查该套菜品做预填。目前只能靠前端路由参数 / localStorage 交接，**用户刷新页面即丢**，而推荐页和回填页恰好分属 FE-A 与 FE-B。
- 建议：§2.4 补一句过期处置（倾向 200 + `adopted: false` + `duplicate` 不受影响）；交接方式请 BE-B / FE-B 一起定，若结论是「前端本地传」，需要在 COLLAB.md 防线 2 里明确这段共享代码归谁。

## Y5（需澄清，合规红线）`reliability` 展示策略与 `portion_label` 直接冲突

- 冲突两边：README「合规边界（全员必读）」写「**B 级以下不在前端展示精确克重**」；而 API.md §2.1 的 dish 响应无条件携带 `portion_label`，示例正是 `"200g"`；`menu-seed.json` 里 **55 道全部 `reliability = B`**。
- 两种解读都不能接受：严格解读 → 推荐页/回填页对所有菜品都禁显克重，卡片信息量塌掉；宽松解读 → 直接违反团队自己写的合规条目，W3「合规自查（PD 主责）」判失败。
- 附带事实：`portion_label` 并非都是克重——早餐里是 `"8只"`、`"6只"`、`"1个"`、`"1根"`、`"300ml"`、`"250ml"`、`"150g"`。所以「精确克重」本身需要定义清楚是「带 g 的数字」还是「所有份量标签」。
- 归属：这是**产品决策，不是技术决策**，按 TEAM.md §5.5 合规自查由 PD 主责。请 PD 给出 A/B/C 三档 × 展示字段的矩阵，并写进 API.md 或 README。**必须在 W2 开工前给**（v1.2 后就是几天内）——W2 末要演示推荐卡，克重显不显示是卡片设计的第一步，等 W3 合规自查才发现就是整页重做。
- 架构依据：ADR D5「可信度分级让前端展示策略有依据」说明这一档本来就是给展示层用的，现在缺的正是那份策略。

## Y6（需澄清）种子里的 `source` 字段，契约和架构文档都没有

- 事实：`menu-seed.json` 每道都带 `source`，且 55 条取值完全相同（`"原型估算种子数据，需按反推法复核"`）。API.md §2.1 的 dish 响应没有它，ARCHITECTURE.md §5 的 `dishes` 模型也没有。
- 前端后果：BE-B 的 Mock API 若照 seed 直接透传，就出现「响应里有契约未记载字段」，违反 DoD 第 5 条，且 smoke 断言与前端类型对不上（F1）。
- 建议：BE-A 在 §2.1 明文「dish 响应字段白名单，未列入者 Mock 与真实实现均不下发」。
- 顺带提请 PD（不属 FE-A 职责，仅提示）：`source` 全表同值 ≈ 没有可追溯依据，与 TEAM.md W1「每条有配料依据可追溯，标注可信度」的验收标准存在差距；建议逐条填真实配料依据。

## Y7（需澄清）`meal` / `default_meal` 枚举未明文列出

- 事实：§2.2 示例 `"default_meal": "lunch"`，§2.3 `overrides` 示例，都只有值没有枚举表；附录 A 餐次占比出现 `breakfast / lunch / dinner` 三个值。§0.3 只说「枚举值小写」。
- 建议：把 `meal ∈ breakfast/lunch/dinner`、`sex ∈ male/female`、`activity ∈ low/mid/high`、`goal ∈ health/lose/gain`（后三个已在 §2.2 校验规则里，`meal` 缺）补成一张枚举表，供 `shared/constants.ts` 固化。属于「文档补齐」，不算改结构。

## G1（建议）校验范围与选项常量应落进 `shared/`，页面不写字面量

- §2.2 的取值范围（身高 140~210 / 体重 35~150 / 年龄 14~70）目前是散文。防线 1 说 `shared/` 含常量表。
- 请 BE-B 在 `shared/constants.ts` 暴露 `NUMERIC_RANGES`、`ACTIVITY_OPTIONS`、`GOAL_OPTIONS`；`AVOID_OPTIONS` 保持由 §2.1 接口下发（不要落进常量，避免两份）。
- FE-A 承诺：建档页不硬编码任何范围数字，全部从 `shared/` 导入；否则就是「前后端各一份」，改一处忘一处。

## G2（建议）`combo.totals` 建议增加 `price_yuan`

- 现状：`totals` 有 `kcal / protein_g / fat_g / carbs_g / sodium_mg`，唯独没有价格；dish 有 `price_yuan`。
- 场景：食堂选餐的第一决策因素是一顿多少钱，推荐卡想显示「合计 ¥14.5」。但前端禁算（D1），我自己加总就是又一份口径。
- 纯新增字段，成本极低，请 BE-A 一并考虑。

## G3（建议）`ApiResult` 的边界形态需要在 `shared/` 里给死

- §0.8 定了「成功直返业务对象 / 失败单一 error」，但没定：HTTP 204 或空响应体、网关返回 HTML 错误页（非 JSON）、5xx 但无 `error.code`、以及 `duplicate: true` 这类业务标记是否仍算 `ok: true`。
- 建议：`shared/types.ts` 给出 `ApiResult<T>` 精确定义，并由 BE-B 附一个 `client.ts` 的解包单测样例，FE-A / FE-B 共用同一份判据。这条不做，两个前端会各写一套兜底，正是速查表第 2 行。

## G4（建议，v1.2 已缩小范围）埋点只剩一条采纳率接口，确认它是否需要新契约

- 原文写的是 W4「埋点与采纳率统计看板」；TEAM.md v1.2 §3.4 裁剪清单已改成「**只做 1 条采纳率统计接口，查数用 SQL**」，看板整体后移。
- 于是这条从「缺埋点契约」降级为一个确认题：§2.5 的 `GET /api/v1/insights/summary`（返回 `adoption_rate`）**是否就是那一条采纳率接口**？若是，FE-A 无需任何新增契约，W3 也不做埋点 SDK。
- 唯一还需要 FE-A 配合的是「建议采纳率」的定义口径（README 成功指标：回填结果与推荐一致的比例）：`adopted_combo_id` 是否被服务端计入 `adopted`，请在 §2.5 补一句判定口径，避免 FE-A/FE-B 对「采纳」理解不同。

---

## 关于目录归属：已由新增的 `.github/CODEOWNERS` 回答（v1.2 同步修订）

**修订说明**：本节原文（v1.1 评审时）写的是「`web/src/api`、router、session 工具四处无人认领」。`origin/main` 新增的 `.github/CODEOWNERS` 已经给出了分配，我原来的判断不再成立，现按新事实改写。

CODEOWNERS 给 FE-A 的实际地盘是（不是我原先假设的 `views/onboarding/`）：

```
/web/src/views/profile/     @fe-a
/web/src/views/goal/        @fe-a
/web/src/views/recommend/   @fe-a
/web/src/api/               @fe-a @fe-b   ← 双所有者
*                           @be-b         ← 未列出的文件全部兜底给 BE-B
```

由此产生三个新问题，比原来的「缺口」更具体：

| 编号 | 问题 | 依据 | 影响 |
|---|---|---|---|
| C1 | **CODEOWNERS 里全是占位符**，文件头自己写着「把下面的 @占位符 替换成各成员的 GitHub 用户名」，而 `@fe-a` / `@be-b` / `@pd` 都不是真实账号 | `.github/CODEOWNERS` 第 5 行注释 | 平台层面的「越界自动加 Reviewer」目前**完全不生效**，防线 2 退回靠人记。W1 内必须替换，否则 COLLAB 的强制机制是空的。请 BE-B 处理 |
| C2 | `web/src/api/` 同时归 FE-A 和 FE-B，两人都会往里写 `client.ts` 的调用封装，**双所有者 = 无所有者**，合并冲突必然发生 | CODEOWNERS `/web/src/api/` | 建议约定：`client.ts`（解包 + session）由 **FE-A 主笔**，FE-B 只新增自己的 `*.api.ts` 调用文件、不改 `client.ts`；反之亦然。写进 COLLAB.md 或本文件即可 |
| C3 | `docs/TEAM.md` 与本次新增的 `reviews/` 都落到 `* @be-b` 兜底，但 TEAM.md §5.5 写「TEAM.md 归 PD」 | CODEOWNERS 默认规则 vs TEAM §5.5 | 文档失真按 §5.5「视为缺陷」。请 PD/BE-B 对齐：要么给 `docs/TEAM.md` 单列 `@pd`，要么承认兜底规则 |

另外两条与本次 v1.2 变更直接相关的观察：

- **C4**：`.nvmrc` 在 CODEOWNERS 里被明确列为 BE-B 所有，但 `origin/main` 的文件树中**该文件不存在**；`shared/`、`web/`、`package.json`、CI workflow 同样不存在。TEAM.md v1.2 §4.1 写「W1 是全局瓶颈，三样任何一样晚一天，五个人全部原地等待」——从 FE-A 视角，这三样现在一样都没有。
- **C5**：`docs/TEAM.md` v1.2 的 §3 标题仍是「**六周排期**」，内容已改为 3 周（W1 / W2 / W3 + 裁剪清单）。按 §5.5「文档失真视为缺陷，里程碑评审时抽查」，请 PD 顺手把标题改掉；我提这条只是因为我的评审意见要引用章节号，标题错了会误导后面的人。

**FE-A 签字条件（v1.3 复核后更新）**：B1 / B2 / B3 给出结论 + PD 就 Y5 出展示矩阵。C1 已由 BE-B 完成（CODEOWNERS 实名），从条件中划掉；F1 / F2 随 API.md v1.2 一并处理，见「复核增补」。

## 评审意见汇总

| 编号 | 严重度 | 一句话 | 该谁定 |
|---|---|---|---|
| B1 | 阻塞 | 「换一批」无请求参数支撑 | BE-A |
| B2 | 阻塞 | 忌口选项全量清单与多 tag 排除语义缺失（`excludes_tag` 单值表达不了，数据已证明会推错猪肉包子） | BE-A + PD |
| B3 | 阻塞 | combo 槽位结构未下发，FE-A / FE-B 各猜一套 | BE-A |
| Y1 | 需澄清 | `bmi_tag` 无值域；「BMI 实时」与前端禁算冲突 | BE-A + PD |
| Y2 | 需澄清 | 未成年降级只有中文文案，无法可靠分支 | BE-A |
| Y3 | 需澄清 | 无解引导需要结构化建议（早餐 + 忌麸质只剩 1 道主食，非边角场景） | BE-A |
| Y4 | 需澄清 | `combo.id` 过期处置 + 采纳→回填交接路径未定义 | BE-A + BE-B + FE-B |
| Y5 | 需澄清 | `reliability=B` 与「B 级以下不展示精确克重」直接冲突 | **PD** |
| Y6 | 需澄清 | seed 的 `source` 字段契约未记载 | BE-A + PD |
| Y7 | 需澄清 | `meal` 枚举未明文 | BE-A |
| G1 | 建议 | 校验范围常量落 `shared/` | BE-B |
| G2 | 建议 | `totals` 加 `price_yuan` | BE-A |
| G3 | 建议 | `ApiResult` 边界形态给死 | BE-B |
| G4 | 建议（v1.2 已缩小） | 确认 §2.5 `insights/summary` 就是那条采纳率接口 + 「采纳」判定口径 | BE-B + PD |
| C1 | 流程（新） | CODEOWNERS 全是 `@fe-a` 式占位符，未替换真实用户名 → 平台强制 Review 未生效 | BE-B |
| C2 | 流程（新） | `web/src/api/` 双所有者，需约定 `client.ts` 主笔 | FE-A + FE-B |
| C3 | 流程（新） | `docs/TEAM.md` / `reviews/` 落 `* @be-b` 兜底，与 §5.5「TEAM.md 归 PD」不一致 | PD + BE-B |
| C4 | 依赖（新） | `.nvmrc`、`shared/`、`web/`、`package.json`、CI workflow 在 `origin/main` 上均不存在 | BE-B |
| C5 | 文档（新） | TEAM.md v1.2 §3 标题仍写「六周排期」，内容已是 3 周 | PD |

**FE-A 签字条件（v1.3 复核后更新）：B1 / B2 / B3 给出结论，Y5 由 PD 出展示矩阵。C1 已结案。** 其余可按「新增字段直接加」的兼容策略放进 **API.md v1.2**（注意：与 TEAM.md v1.2 是两个不同的版本号，别混），不阻塞我进入 W2。

---

## 复核增补（2026-11-06 晚，基准 `origin/main` = `496c1ef`）

> 本节能回答「评审单交出去之后发生了什么」。依据全部是 `origin/main` 上可复现的文件与实测，非转述。
> 本单（PR #1）已被 PD 于 13:45 合入 `main`；之后 #2（BE-B 脚手架 + `@canteen/shared` + CI）、#3（COLLAB 防线 7）、#4（PD 种子 v2）先后落地。

### 1. 逐条结案状态

| 编号 | 状态 | 现在的依据（均在 `origin/main` 上） |
|---|---|---|
| C1 | **结案** | CODEOWNERS 已实名：BE-A `pigQAQ` / BE-B `yangelect` / FE-A `Aredjdhd` / FE-B `wyf-111` / PD `givehope488`。平台强制 Review 的机制恢复生效 |
| C3 | **结案** | `/docs/TEAM.md @givehope488`、`/reviews/ @givehope488` 已单列，与 §5.5 一致 |
| C5 | **结案** | TEAM.md §3 标题已改「三周排期」（本次 diff 仅此一行） |
| C4 | **部分结案** | 已存在：`.nvmrc`（=22）、根 `package.json`（workspaces: shared/server；scripts `lint/typecheck/test/check:data/dev/start`）、`shared/`（实际路径 `shared/src/`，包名 `@canteen/shared`）、`.github/workflows/ci.yml`（main HEAD 三 job 全绿）。**仍缺**：`web/` 前端脚手架、`VITE_API_BASE`、Mock API、`npm run smoke / e2e / seed` |
| C2 | 仍开 | `/web/src/api/` 仍是 `@Aredjdhd @wyf-111` 双所有者；`client.ts` 主笔约定未成文（types.ts 注释要求解包只在 `client.ts` 一处，但该文件尚不存在） |
| B1 | 仍开 | `RecommendationRequest`（shared/src/types.ts）仍只有 `session_id / meal / overrides`，「换一批」无参数 |
| B2 | 证据更新，仍开 | 数据例证已修：种子 v2 里 s11/s12/s13 tags=[`pork`,`gluten`,`meat`]（PD 补 `meat`）。但类型层 `AvoidOption.excludes_tag: DishTag` 仍是**单值**；实测纯素需排 6 个 tag（meat/pork/beef/seafood/egg/milk），排除后午餐 `protein` 19→2、`soup` 4→0。PD 的 DATA-AUDIT §3-D2 已把 `excludes_tags`（复数）排进 API v1.2。**新增矛盾**：实现下发的 8 个 key 用 `nomeat` 表达素食（server/src/data/avoid-options.ts），而 API.md §2.3 示例仍是 `"avoid": ["vegan"]`（第 103 行）→ 照文档写前端会被判 400，见 F1 |
| B3 | 仍开 | `Combo.dishes: ComboDish[]` 平铺数组、无槽位字段。种子 v2 复核不变：早餐池 14 道 `veg=0 soup=0`、午餐 41 道 `fruit=0` |
| Y1 | 仍开 | `bmi_tag: string`（types.ts）仍无值域 |
| Y2 | 部分 | `warnings: string[]` 仍是自由文本；但 `MINOR_AGE = 18` 已进 `shared/src/constants.ts`，前端不再写死 18 这个数 |
| Y3 | 仍开，且被独立复现 | DATA-AUDIT §4 独立给出同一结论（素食+忌麸质早餐主食只剩白粥）。**新增前置问题**：8 个忌口 key 里没有 `gluten` 项（avoid-options.ts），「忌麸质」用户在 UI 上无法表达 → Y3 的场景现在连入口都没有，需 PD/BE-A 补一个 gluten key 或过敏通道 |
| Y4 | 仍开 | `adopted_combo_id?: string \| null`（types.ts）；24h 过期后 `POST /meal-logs` 的处置仍无定义 |
| Y5 | 部分 | 数据侧已拆：`portion_label` 只留展示用语（实测午餐 41 道标签为「1 份/1 碗/1 个/1 只/1 根/半份」），克重进 `portion_grams`，55 条全 B 时服务端投影不下发（dishes.ts `toDishDto` + app.test.ts 断言）。PD 在 DATA-AUDIT §7 给出 v1.2 方案：`portion_grams?` 仅 `reliability === 'A'` 时下发。**但** API.md §2.1/§2.3 示例仍是 `"portion_label": "200g"`（第 54/121 行），而 `server/test/app.test.ts:107` 断言 portion_label 不得匹配 `/\d+(g|ml|克)/` → 契约示例与 CI 断言互斥，见 F2。展示矩阵本身 PD 仍未产出 |
| Y6 | 部分 | 种子 v2 新增 `ingredients: [{name,grams,source}]`（当前 55 条全空），`source` 保留且 55 条仍同值；响应白名单由 `toDishDto` 显式投影，测试断言 `portion_grams / ingredients / source` 不出现于响应。但 API.md 正文仍无任何记载 → 照流程问题报 |
| Y7 | 部分 | `Meal / Category / Sex / Activity / Goal / Reliability / DishTag` 枚举全部进了 shared/src/types.ts；API.md 正文仍无枚举表 → 文档补齐仍待 BE-A |
| G1 | 部分 | `PROFILE_BOUNDS / SERVING_STEP / MAX_SERVINGS / ERROR_STATUS / MINOR_AGE` 已入 shared/src/constants.ts；`ACTIVITY_OPTIONS / GOAL_OPTIONS` 仍缺 |
| G2 | 仍开 | `NutritionTotals` 仍无 `price_yuan` |
| G3 | 部分 | `ApiResult<T>` 已在 types.ts 定义；`web/src/api/client.ts` 仍不存在 → 解包实现与单测样例仍待落 |
| G4 | 仍开 | insights 端点未实现；「采纳」判定口径无记载 |

顺带更正我原 B2 一处数字：午餐蛋白池 tag 分布应为 `meat=15 / pork=7 / spicy=5 / egg=3 / seafood=2 / beef=1 / gluten=1 / peanut=1 / vegprotein=4`——原文漏列了 `spicy=5`，其余数字在种子 v2 上复核一致。

### 2. 新发现 F1~F4（代码先行、契约/流程未跟）

| 编号 | 一句话 | 证据 | 后果 | 该谁定 |
|---|---|---|---|---|
| F1 | API.md 示例用不存在的 key `vegan`，实现的 key 是 `nomeat` | API.md 第 103 行 vs `server/src/data/avoid-options.ts` 8 个 key | 照文档写建档页/试算请求 → `VALIDATION_ERROR`。这是「文档与实现互斥」，不是文档滞后 | BE-A（附录 C 流程） |
| F2 | API.md 示例 `portion_label: "200g"` 与 CI 断言互斥 | API.md 第 54/121 行 vs `server/test/app.test.ts:107`（`portion_label` 不得匹配 `/\d+(g\|ml\|克)/`） | 冻结契约里的示例按今天的实现标准是非法响应；Y5 的合规冲突以「测试断言」形式被钉死了 | BE-A + PD |
| F3 | COLLAB 承诺的 `smoke / e2e / seed` 脚本不存在 | COLLAB 防线 3/4、DoD 第 1 条 vs 根 `package.json` scripts（只有 lint/typecheck/test/check:data/dev/start） | 「CI 绿」会被误当「smoke 通过」上报；防线 4 的 9 组端点包络断言只剩 vitest 里 menu 一组的 5 个用例 | BE-B |
| F4 | 防线 7 的三条约束直接影响 FE-A 交付节奏 | `docs/COLLAB.md` 防线 7 | ①不能批准自己的 PR（我的每个 PR 都必须等别人批）；②旧批准自动失效（PR 再推新 commit 要重新等人批）；③仓库转 private 后 Free 套餐门禁全部失效（转 private 必须与升级 Pro 同一天）。另：`/reviews/` 归 PD 后，本单及所有 review 文档的后续修改需要 PD 批准——包括本次增补 | 全员知悉 |

F1/F2 的根治 = API.md 升 v1.2 并按附录 C 走变更流程，主笔是 BE-A，**FE-A 与 Agent 无权自己改契约**——本文档只负责把差异钉在明处。

### 3. 环境实测（供 W2 前对齐）

- 本机 Node v26.13.0 依次跑通 `npm ci` → `npm run lint / typecheck / test / check:data`，全部 exit 0；CI 在 node 22（`.nvmrc`）上同四步也全绿 → 22/26 版本差异未造成可见分歧（两侧证据都有，不是推断）。
- 本地起 `npm run start`（8787 端口），实测 `GET /api/v1/menu?meal=lunch` → 200，41 道、8 个忌口选项、字段白名单无泄漏（无 `portion_grams/ingredients/source`）；`?meal=brunch` → 400 + `{error:{code:VALIDATION_ERROR,fields:[{path:"meal"}]}}` 标准包络。真实响应样本已贴进 CONTRACT-NOTES。
