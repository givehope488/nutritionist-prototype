# FE-A 的 Agent 任务提示词模板与禁止项卡片

> 依据：COLLAB.md §5（统一模板 + 固定禁止项）、§6（人工检查点）、防线 7（合并门禁）、API.md 附录 C.5（Agent 无权发起接口变更）。
> 用途：W1 验收项「约定各自 Agent 的禁止项模板」。以下三段是 FE-A 给 Agent 下任务时**必须原样粘贴**的内容。

## 一、三条铁律（贴在每个任务开头，缺一条不开工）

1. **共用 `@canteen/shared` 类型**：前端 view 里不出现任何手写的接口类型或字段名常量，一律 `import type` 自 `@canteen/shared`（包名是 `@canteen/shared`，不是 `shared/`；`shared/` 已随 PR #2 就绪，不得再用「未就绪」当借口手写类型）。
2. **CI 红不合并**：`lint` / `typecheck` / `test` 三件套必须全绿；不绕过、不注释规则、不加 `any` 骗过类型检查。
3. **只动自己目录**：按 `.github/CODEOWNERS`，FE-A 的地盘是 `web/src/views/profile/`、`web/src/views/goal/`、`web/src/views/recommend/` 三个目录；`web/src/api/` 与 FE-B **共担**（未约定主笔前不动）。`shared/`、根配置、`package.json`、`.nvmrc`、`.github/`、CI 配置、`web/src/components/`、别人的 view、`server/` —— 一律只读。越界文件 GitHub 会自动把所有者加成必需 Reviewer，所以越界不是「被骂」而是「合不进去」。
4. **PR 走防线 7 门禁（COLLAB 新增）**：必须 1 人批准才可合并；**自己不能批自己的 PR**；push 新提交后旧批准自动失效；禁止 force-push；`main` 禁强推。`/reviews/` 在 CODEOWNERS 里归 PD（`givehope488`）——我改评审文档需要 PD 批准。仓库若转 private（Free 计划会丢全部保护），当天升级 Pro 或按防线 7 人工补位，不能裸奔。

## 二、FE-A 专属禁止项（在 COLLAB.md §5 固定禁止项之上追加）

```
- 禁止在页面中写任何营养计算公式（BMR / TDEE / 目标热量 / 蛋白分配 / 推荐评分 / BMI / 反馈判定），
  数值只能取服务端响应字段。依据：API.md §0.1、ARCHITECTURE.md D1。
- 禁止新增或修改 docs/API.md 的字段、枚举、结构。若你认为「改一下字段就能解决」，
  立即停止编码，输出一段「接口变更申请」文字交给我，由我提给 BE-A 走附录 C 流程。
  依据：API.md 附录 C.5「AI Agent 无权发起变更」。
- 禁止自创错误处理形态：失败只认 §1 的单一 error 对象，成功只认直返业务对象，
  解包逻辑应集中在 web/src/api/client.ts；该目录是 FE-A + FE-B 共担、主笔未定（评审单 C2），**定主笔之前不要创建或修改该文件**。
- 禁止在页面里硬编码：身高/体重/年龄校验范围、餐段枚举、忌口选项。
  前两者应从 @canteen/shared 导入（PROFILE_BOUNDS、Meal/Sex/Activity/Goal 枚举类型；展示名映射放页面，值不本地化）；
  忌口选项必须运行时取 GET /menu 的 avoid_options。
- 禁止在页面里写「vegan」等任何硬编码忌口 key，禁止自带 key→tag 映射表。
  契约 v1.1 示例里的 vegan 已过时（F1）：实测素食 key 是 nomeat。key 只能从 avoid_options 下发清单取；
  清单若缺某项（如「忌麸质」没有对应 key），那是契约议题（Y3 前置），报我，不写兜底。
- 禁止新增依赖（含 devDependency）。需要库 → 停下来问 BE-B，由 BE-B 统一评估。
  依据：COLLAB.md 防线 3。
- 禁止改动 menu-seed.json 或任何 server/data 下文件。生产数据只走管理端 API。
  依据：API.md §3 末尾。
- 禁止实现「换一批」等 B1 未决交互，禁止实现依赖 combo 槽位结构的排版（B3 未决）。
  遇到这类位置：留 TODO 注释标明「阻塞项 B1/B3，见 reviews/fe-a/API-REVIEW.md」，并停下来告诉我。
- 禁止用「文案字符串匹配」驱动交互分支（例如判断 warnings 里是否含「未满18岁」来决定跳转）。
  中文文案只展示不判断，结构化 code 待 Y2 结论。
- 禁止把推荐结果写入 localStorage 之外的位置，禁止在 FE-B 的回填页里塞 FE-A 专属逻辑。
```

## 三、任务提示词模板（复制即用，尖括号是待填项）

```
角色：你在为「食堂营养师」项目实现：<一句任务描述，例如「建档页表单与提交交互」>。

契约：严格遵守以下类型 / 接口定义，字段名一字不改：
<粘贴 @canteen/shared（shared/src/types.ts / constants.ts）相关段落；若类型与 API.md v1.1 示例不一致（F1/F2），以 shared 类型 + CONTRACT-NOTES §5.1 实测样本为准，差异上报给我>
补充上下文：<粘贴 fe-a/CONTRACT-NOTES.md 对应小节>

范围：只允许修改 <目录，例：web/src/views/profile/（CODEOWNERS 已给我的是 profile / goal / recommend 三个）>，不改其他任何文件。
禁止：新增依赖；改 shared/；改接口结构；自定义错误格式；写营养计算公式；
      硬编码校验范围与枚举；实现未决交互（B1/B2/B3/Y2/Y5）。
完成标准：<验收命令，例：npm run lint && npm run typecheck && npm run test> 通过；
         跑给我看输出，失败就贴原始报错，不要改契约来让它通过。
交付前自检：PR 文件列表是否只含上面目录；字段名是否与契约逐字一致。
```

## 四、字段绑定核对表（COLLAB.md §6「查契约」的可执行版本）

每次 PR 前自己逐行勾，Reviewer 也照这张勾，不用读代码逻辑：

| 页面 | 我要核对的字段（对照 API.md 段落） | 出处 |
|---|---|---|
| 建档 | `sex` `height_cm` `weight_kg` `age` `activity` `goal` `avoid` `default_meal` → 请求；`bmi` `bmi_tag` `day_kcal` `warnings` → 响应 | §2.2 |
| 目标与忌口 | `avoid_options[].key` `label` `excludes_tag` | §2.1 |
| 推荐 | `target.{day_kcal,kcal,protein_g,fat_g,carbs_g,sodium_mg,meal_ratio}`；`combos[].{id,dishes[].*,totals.*,reason,engine}`；`notice` | §2.3 |
| 通用 | `error.{code,message,fields[].path,fields[].issue}` | §1 |

## 五、何时停下来找真人（不自愈，不硬耗）

- 同一报错修 3 次仍不过；
- Agent 开始改任务目录以外的文件（**失控信号**，立刻停手并回滚，见 WORKLOG.md 的回滚条目）；
- Agent 说「改一下接口/字段结构就能解决」→ 这不是代码问题，转成接口变更议题交 BE-A；
- Agent 需要 `@canteen/shared` 里的类型但其中缺失 → 这是上游依赖缺口（如 ACTIVITY_OPTIONS / GOAL_OPTIONS 仍缺），回来找我按依赖表推进，不要就地手写类型「先跑起来」。
- Agent 建议装个新库来解决 → 问 BE-B。

## 六、PR 必须附的「AI Agent 使用声明」（`.github/PULL_REQUEST_TEMPLATE.md` 新增硬性段落）

模板要求每个 PR 勾这四项，其中最后一项是**给你自己填的**，不是给 Agent 填的：

```
- [x] 本次任务给 Agent 的提示词附带了契约上下文（API.md 段落或 shared/ 类型）
- [x] Agent 产出的代码我已逐字段核对过字段名（对照 API.md / shared 类型）
- [x] Agent 未新增依赖、未修改接口结构
- 使用的 Agent / 模型：<如实填写>
```

FE-A 的执行方式：每次开工就把本文件第三节模板整段贴给 Agent，PR 时把用了什么模型如实写进声明。这条不是形式 —— TEAM.md §3.4 把它归到「不可砍项」，而且出问题时「是模型能力问题还是契约理解问题」只能靠这行判断。

## 七、变更记录

| 日期 | 变更 |
|---|---|
| 2026-11-06 | 首版：三条铁律 + 9 条 FE-A 专属禁止项 + 字段核对表 + 停手判据 |
| 2026-11-06 | 同步 `origin/main` `1275782`：目录改为 CODEOWNERS 实际路径（profile/goal/recommend）；`web/src/api/` 由待认领改为共担；新增第六节 PR 的 Agent 使用声明要求 |
| 2026-11-06 | 同步 `origin/main` `496c1ef`：导入路径全部改 `@canteen/shared`（包名订正，禁止再写 `shared/`）；铁律加第 4 条防线 7 门禁（不能自批 / 旧批准失效 / 转 private 门禁失效 / `/reviews/` 归 PD）；禁止项 +1「禁止硬编码 vegan 等忌口 key」（F1，素食 key 实测为 `nomeat`）；模板的契约粘贴段指向 shared 类型 + CONTRACT-NOTES §5.1 | main 前移 4 个 PR |
