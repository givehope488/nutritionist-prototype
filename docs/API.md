# 接口协定（API Contract）

> 版本 v1.2.1（2026-11-06），一致性修正版。**本文档是前后端并行开发的唯一事实源：先改文档、评审通过、再改代码。** 修改流程见附录 C。开发行为规范见 `docs/COLLAB.md`。
>
> **v1.2 只做「让文档、类型、实现三者对齐」，不含字段结构变更。** 具体改了四处：示例里的 `vegan` 改为实现使用的 `nomeat`、份量示例改为展示用语、新增附录 D 忌口全表、补 `meal` 枚举。**v1.2.1 仅更正 §2.1 一处自相矛盾**（`portion_grams` 到底下发不下发），结论是**一律不下发**。B1/B2/B3、Y1~Y4 等结构性议题仍留待 v1.3，不在本版解决。

## 0. 总则

1. **口径唯一**：一切营养计算（BMR / 目标 / 推荐评分 / 反馈判定）在服务端完成；前端只提交输入、渲染响应，禁止自行计算数值。
2. 风格：REST + JSON；路径前缀 `/api/v1`。
3. 命名：字段 snake_case；枚举值小写（`lunch`、`male`）。
4. 单位：热量 kcal、蛋白质/脂肪/碳水 g、钠 mg、身高 cm、体重 kg、价格元（number，保留 1 位小数）。
5. 时间：日期 `YYYY-MM-DD`；时间戳 ISO 8601 UTC。
6. 认证：用户端无账号，请求携带 `session_id`（前端首次生成 UUID 存 localStorage，透传到所有需要身份的接口）；管理端用 `X-Admin-Token` 请求头。
7. 幂等：`POST /meal-logs` 以请求体 `id`（客户端 UUID）为幂等键，重复提交返回首次结果并附 `"duplicate": true`。
8. **响应结构（统一包络，不得自创）**：
   - 成功（2xx）：**直接返回业务对象**，不额外裹 `data` / `ok` / `result` 等包装层。例：`GET /menu` 返回 `{ "dishes": [...], "avoid_options": [...] }`。
   - 失败（4xx / 5xx）：返回 §1 定义的单一 `error` 对象，`code` 取自下表。
   - 前端统一解包逻辑写在 `web/src/api/client.ts` 一处，业务代码不各自判断 `res.data` 还是 `res`。
   - `shared/types.ts` 中对应定义为 `type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }`，由 `client.ts` 负责把 HTTP 响应映射成该联合类型——**业务代码只见这两种形态**。

## 1. 错误约定

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数不合法",
    "fields": [ { "path": "height_cm", "issue": "取值须在 140~210" } ]
  }
}
```

| HTTP | code | 场景 | 前端处置 |
|---|---|---|---|
| 400 | VALIDATION_ERROR | 参数缺失 / 越界 / 枚举非法 | 按定位提示用户修正 |
| 401 | UNAUTHORIZED | 管理端 token 缺失或失效 | 跳登录 |
| 404 | NOT_FOUND | 资源不存在（如 dish_id） | 提示并返回上一页 |
| 409 | CONFLICT | 管理端并发修订（version 不匹配） | 提示刷新后重试 |
| 429 | RATE_LIMITED | 触发限流 | 提示稍后再试 |
| 500 | INTERNAL | 服务端异常 | 通用错误页 |

> 注意：**忌口过滤后无推荐解不是错误**——返回 200 与空 `combos[]` + `notice` 文案，前端展示放宽条件引导（见 §2.3）。

## 2. 用户端接口

### 2.1 菜单 `GET /api/v1/menu?meal=lunch&include_inactive=false`

按餐段返回可选菜品与忌口选项（忌口选项集合由服务端下发，避免前后端硬编码两份）。

```json
{
  "dishes": [
    {
      "id": "s01", "name": "白米饭", "category": "staple",
      "portion_label": "1 份", "meals": ["lunch", "dinner"],
      "kcal": 232, "protein_g": 4.4, "fat_g": 0.6, "carbs_g": 51.6, "sodium_mg": 2,
      "price_yuan": 1.0, "tags": [], "drink": false,
      "reliability": "B", "status": "active"
    }
  ],
  "avoid_options": [
    { "key": "nospicy", "label": "不吃辣", "excludes_tag": "spicy" }
  ]
}
```

`category` 枚举：`staple` / `protein` / `veg` / `soup` / `fruit`。
`meal` 与 `default_meal` 枚举：`breakfast` / `lunch` / `dinner`。
`status` 枚举：`active`（在架）/ `hidden`（下架）。
`tags` 枚举（忌口过滤依据）：`pork` `beef` `seafood` `egg` `milk` `gluten` `peanut` `spicy` `meat` `vegprotein`。

**份量字段（v1.2 明确）**：`portion_label` 只放展示用语（`1 份` / `1 碗` / `8 只` / `半份`），**不得包含克重数字**。这样「B 级以下不在前端展示精确克重」（README 合规条目 4）才真的成立——`reliability` 为 B / C 的菜品，前端没有克重可展示，也不会被用户误当成精确值。

精确克重存放在内部字段 `portion_grams`，与 `ingredients`、`source` 一样**只存在于数据文件**，属于数据治理用途，**不出现在任何 API 响应中，A 级也不下发**（`server/test/app.test.ts` 有断言守着）。

> v1.2.1 更正：本段此前写作「`portion_grams` 仅当 `reliability = "A"` 时下发」，与紧随其后的「不出现在任何响应中」自相矛盾，且与实现和 `shared` 类型（无该字段）都不符。按现状统一为**一律不下发**——前端拿不到任何克重，A / B 级只能展示 `portion_label` 的份量用语，正好与 D4「A / B 级同一套 UI、不加估算标记」一致。若将来要让 A 级展示精确克重，那是新增字段，须走 v1.3 并把 `shared` 类型一起改。

**忌口选项的全量 key 见附录 D，那是唯一事实源。** 前端不得硬编码，只能渲染 `avoid_options` 返回的列表。

### 2.2 档案 `POST /api/v1/profiles`（upsert，以 session_id 为键）

```json
{
  "session_id": "3f2b1c...",
  "sex": "male", "height_cm": 172, "weight_kg": 65, "age": 20,
  "activity": "mid", "goal": "health",
  "avoid": ["nospicy"], "default_meal": "lunch"
}
```

响应（含服务端派生值，前端直接展示、不重复计算）：

```json
{
  "session_id": "3f2b1c...",
  "sex": "male", "height_cm": 172, "weight_kg": 65, "age": 20,
  "activity": "mid", "goal": "health", "avoid": ["nospicy"], "default_meal": "lunch",
  "bmi": 21.97, "bmi_tag": "正常",
  "day_kcal": 2282, "warnings": []
}
```

校验规则：身高 140~210、体重 35~150、年龄 14~70；`activity` ∈ `low/mid/high`；`goal` ∈ `health/lose/gain`。
**未成年规则**：`age < 18` 且 `goal = "lose"` → 服务端强制存储为 `"health"`，并在 `warnings` 返回 `["未满18岁不提供热量缺口方案，已调整为日常保健"]`。前端须同时禁用减脂选项（双保险）。

`GET /api/v1/profiles/me?session_id=...` 返回同结构；档案不存在返回 404。

### 2.3 推荐 `POST /api/v1/recommendations`

```json
{
  "session_id": "3f2b1c...",
  "meal": "lunch",
  "overrides": { "goal": "lose", "avoid": ["nomeat", "nospicy"] }
}
```

`overrides` 临时覆盖（本次请求生效，不落库），用于「换目标试算」场景；缺省用档案值。

响应：

```json
{
  "target": {
    "day_kcal": 1826, "kcal": 730, "protein_g": 31,
    "fat_g": 55, "carbs_g": 96, "sodium_mg": 1600, "meal_ratio": 0.4
  },
  "combos": [
    {
      "id": "c9f31a02",
      "dishes": [
        { "id": "s01", "name": "白米饭", "category": "staple", "portion_label": "1 份",
          "servings": 1, "kcal": 232, "protein_g": 4.4, "fat_g": 0.6, "carbs_g": 51.6, "sodium_mg": 2 }
      ],
      "totals": { "kcal": 736, "protein_g": 32, "fat_g": 17, "carbs_g": 88, "sodium_mg": 1353 },
      "reason": "这一餐约 736 kcal，基本贴着午餐目标 730 kcal；蛋白质 32g 达标……",
      "engine": "llm"
    }
  ],
  "notice": null
}
```

- `combos` 固定最多 3 套；服务端保证主菜组合不重复、主食互不相同（菜品池不足时放宽，见架构文档 §3）。
- `engine` ∈ `template` / `llm`，如实标记实际使用的理由引擎。
- 无解时：`"combos": []`，`notice` 为引导文案（如 `"符合忌口条件的菜品太少，建议放宽一两个限制或换个时段"`）。
- `combo.id` 短哈希，供回填时关联采纳，有效期 24 小时。

### 2.4 回填 `POST /api/v1/meal-logs`

```json
{
  "id": "b7e2-client-uuid",
  "session_id": "3f2b1c...",
  "date": "2026-11-04", "meal": "lunch",
  "items": [ { "dish_id": "s01", "servings": 1 }, { "dish_id": "m08", "servings": 1 } ],
  "adopted_combo_id": "c9f31a02"
}
```

`servings` 取值 0.5 / 1 / 1.5 / 2（0.5 步进，上限 5）；`adopted_combo_id` 可空（自选）。

响应（判定与文案均由服务端生成）：

```json
{
  "id": "b7e2-client-uuid", "duplicate": false,
  "date": "2026-11-04", "meal": "lunch",
  "items": [ { "dish_id": "s01", "name": "白米饭", "servings": 1 } ],
  "totals": { "kcal": 736, "protein_g": 32, "fat_g": 17, "carbs_g": 88, "sodium_mg": 1353 },
  "target": { "kcal": 730, "protein_g": 31 },
  "verdict": { "level": "ok", "title": "吃得挺准", "body": "这一餐 736 kcal，和午餐目标只差 6 kcal……" },
  "adopted": true
}
```

`level` ∈ `ok` / `warn`。幂等：重复 `id` 返回首次结果且 `"duplicate": true`。

### 2.5 记录与统计

`GET /api/v1/meal-logs?session_id=...&from=2026-11-01&to=2026-11-07&page=1&page_size=20`
→ `{ "total": 12, "page": 1, "logs": [ { 同 2.4 响应结构 } ] }`

`GET /api/v1/insights/summary?session_id=...&days=7`
→ `{ "logged_meals": 12, "adopted": 8, "adoption_rate": 0.67, "avg_kcal": 705, "avg_protein_g": 30 }`

## 3. 管理端接口（Header: `X-Admin-Token: <token>`）

> 3 周计划中管理端**无 UI**，本节端点由 CLI 脚本 `scripts/dish-admin.mjs`（W2 由 BE-B 提供）直接调用，供 PD 维护数据；管理端 UI 列入 V2。接口契约不因此简化。

| 方法 | 路径 | 用途 | 要点 |
|---|---|---|---|
| GET | `/api/v1/admin/dishes` | 全量菜品（含 inactive） | 支持按 category / status 筛选 |
| POST | `/api/v1/admin/dishes` | 新增菜品 | 全字段校验 + `reliability` 必填 |
| PUT | `/api/v1/admin/dishes/:id` | 修订营养数据 | 请求体须含 `reason`；写入 `dish_revisions` 留痕 |
| POST | `/api/v1/admin/dishes/:id/status` | 上架/下架 | `{ "status": "active" \| "hidden" }` |
| GET | `/api/v1/admin/dishes/:id/revisions` | 修订历史 | 审计用 |
| POST | `/api/v1/admin/dishes/bulk-import` | 批量导入 | JSON 数组，逐行校验，返回逐行成败 |

修订请求示例：

```json
{
  "kcal": 245, "protein_g": 4.6, "fat_g": 0.6, "carbs_g": 54.2,
  "reason": "10月抽检称重，实际份量 210g"
}
```

**生产数据只经此通道变更，禁止直接改库或改 `menu-seed.json`。**

## 4. 附录

### 附录 A：营养计算口径（服务端实现、测试引用的唯一基准）

| 项 | 口径 |
|---|---|
| BMR | 男：`10W + 6.25H − 5A + 5`；女：`10W + 6.25H − 5A − 161`（Mifflin-St Jeor） |
| 活动系数 | low 1.2 / mid 1.4 / high 1.6 |
| 目标系数 | health ×1.0 / lose ×0.8（且不低于 BMR×1.05）/ gain ×1.12 |
| 蛋白 g/kg | health 1.2 / lose 1.6 / gain 1.8 |
| 脂肪 | 日热量 27%；碳水 = 余量（下限 60g） |
| 餐次占比 | breakfast 0.30 / lunch 0.40 / dinner 0.35 |
| 单餐钠参考线 | 1600mg（超 1900 提示控盐） |
| 未成年 | age<18 时 lose 强制降级 health |

### 附录 B：推荐评分口径（权重基准）

热量偏离 ×120（health/gain 下热量 <85% 目标额外罚 ×140）；蛋白不足罚 ×45、超 160% 罚 ×35；脂肪能量占比 >42% 罚 ×200、<15% 罚 ×100；钠 >1600mg 线性罚；含蔬菜/水果 +7；lose 且脂肪 <32% +6；gain 且蛋白达标 +9。两阶段补「小荤」条件：`kcal ≤ 260 或 fat ≤ 12g`。

### 附录 C：接口变更流程

1. 提出人提交 `docs/API.md` 的 PR（只改文档），@ 受影响方 Review，24h 响应；
2. 合并后约定切换时间（群内 @ 双方）；
3. 兼容策略：**新增字段直接加**（旧前端忽略即可）；**修改/删除字段保留一个版本的过渡期**，响应同时给出新旧字段并标注废弃；
4. 每次变更在本文档头部版本号 +1，并记录变更摘要。
5. **AI Agent 无权发起变更**：Agent 提出的「改字段名 / 改结构就能解决」的建议一律转为人工评审议题，由 BE-A 判定后按上述流程执行。

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-11-03 | 首版冻结 |
| v1.1 | 2026-11-05 | 总则新增 §0.8 统一响应包络（成功直返业务对象、失败单一 error 对象、`ApiResult<T>` 联合类型）；附录 C 补充 Agent 变更限制 |
| v1.2 | 2026-11-06 | **一致性修正版，无字段结构变更。** §2.3 示例 `vegan` → `nomeat`（实现一直用后者，文档写错）；§2.1 §2.3 份量示例 `200g` → `1 份`，并明确 `portion_label` 禁含克重；§2.1 补 `meal` / `status` 枚举；新增附录 D 忌口选项全表（9 项，含新增的 `nogluten`）及其两条硬约束 |
| v1.2.1 | 2026-11-06 | **只改一处自相矛盾的表述。** §2.1 原文既说 `portion_grams`「仅当 `reliability = "A"` 时下发」，又说它「不出现在任何 API 响应中」。按实现与 `shared` 类型（无该字段）统一为**一律不下发**，A 级也不给克重；与 D4「A / B 级同一套 UI」一致。无字段结构变更 |

### 附录 D：忌口选项全表（v1.2 新增，唯一事实源）

**本表与 `GET /menu` 返回的 `avoid_options` 必须逐行一致。** `server/test/contract.test.ts` 会解析本表并与实现比对，不一致直接 CI 红。前端不得硬编码，只渲染服务端下发的列表。

| key | label | excludes_tag |
|---|---|---|
| `nospicy` | 不吃辣 | `spicy` |
| `nopork` | 不吃猪肉 | `pork` |
| `nobeef` | 不吃牛肉 | `beef` |
| `noseafood` | 不吃海鲜 | `seafood` |
| `noegg` | 不吃鸡蛋 | `egg` |
| `nomilk` | 不吃奶制品 | `milk` |
| `nopeanut` | 不吃花生 | `peanut` |
| `nogluten` | 不吃麸质（小麦制品） | `gluten` |
| `nomeat` | 素食 | `meat` |

两条硬约束（`npm run check:data` 与上述测试强制）：

1. **`meat` 是「含动物性食材」的兜底标签。** 任何带 `pork` / `beef` / `seafood` 的菜品必须同时带 `meat`。否则用户勾「素食」时，`excludes_tag: meat` 的过滤会把这盘菜放行——早餐的猪肉包就曾因此被推给素食者。
2. **新增或改名一个忌口 key，先改本表再改服务端**，两处不一致 CI 直接红。前端 Mock 也必须同步，禁止自造 key（曾有 `vegan` 这个文档里不存在、实现里也不存在的第三种写法）。

> 已知局限：`excludes_tag` 是**单值**，一个 key 只能排除一类标签。所以「素食」排的是 `meat`（含鱼虾），**不代表纯素**——蛋、奶仍会出现在推荐里。纯素（连蛋奶一起排）在现有池子里午餐蛋白质只剩 2 道、汤 0 道，是否支持单独评估，见 v1.3 议题。
