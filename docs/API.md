# 接口协定（API Contract）

> 版本 v1.2.7（2026-11-25），早餐占比调整版。**本文档是前后端并行开发的唯一事实源：先改文档、评审通过、再改代码。** 修改流程见附录 C。开发行为规范见 `docs/COLLAB.md`。
>
> **v1.2.5 定稿回填采纳快照字段**：§2.4 `POST /meal-logs` 新增可选 `adopted_combo`（推荐快照），与 `adopted_combo_id` 绑定，并写明逐菜判定规则（`fixed` 集合级比对 / `weigh` ±15% / 无 id 自选 `false`）。口径由 PD 11-17 拍板，属新增字段、兼容变更、无过渡期。服务端实现归 BE-B、快照发送归 FE-B。
>
> **v1.2.4 对齐实测菜单 v3 并补齐联调两处契约缺口**：① §0 第 4 条删「价格元」（产品 2026-11-13 决定不提供价格）；② §2.1 示例换成 v3 真实菜，补 `floor` / `stall` / `serving_mode` / `pricing_mode` / `recommendable` 五个可选字段，并新增三段说明（份量形态四态 / 结算方式两态 / 可推荐性）；③ §2.3 `ComboDish` 补 `pricing_mode?`、`Combo` 补 `has_weighed_dish?`（两处称重标记，让前端满足 W2 验收 I5）；④ §2.2 新增 `DELETE /profiles/me`（合规删除入口，连带删除该 session 的 meal-logs）。以上均为**新增字段 / 新增端点，属兼容变更，无过渡期**（附录 C 第 3 条）。
>
> **v1.2 只做「让文档、类型、实现三者对齐」，不含字段结构变更。** 具体改了四处：示例里的 `vegan` 改为实现使用的 `nomeat`、份量示例改为展示用语、新增附录 D 忌口全表、补 `meal` 枚举。**v1.2.1 仅更正 §2.1 一处自相矛盾**（`portion_grams` 到底下发不下发），结论是**一律不下发**。**v1.2.2 补上 §2.3 缺失的「一套组合由哪些类目组成」，并明确早餐放宽**（此前这条规则文档里根本没有，引擎各写各的）。**v1.2.3 修两处会导致实现出错的数字缺口**：附录 A 三餐占比之和原本是 1.05（按餐目标吃必然超日目标 5%），改为 `dinner 0.30` 使之和 = 1.0；附录 B 只写「钠 >1600 线性罚」却没给系数，实现各自取值，现明确分段系数并补上「超 1900」的控盐提示要求。同时给附录 B 的「补小荤」补一句边界：它不得新增菜品、不得改变 §2.3 的组合件数。B1/B2/B3、Y1~Y4 等结构性议题仍留待 v1.3，不在本版解决。

## 0. 总则

1. **口径唯一**：一切营养计算（BMR / 目标 / 推荐评分 / 反馈判定）在服务端完成；前端只提交输入、渲染响应，禁止自行计算数值。
2. 风格：REST + JSON；路径前缀 `/api/v1`。
3. 命名：字段 snake_case；枚举值小写（`lunch`、`male`）。
4. 单位：热量 kcal、蛋白质/脂肪/碳水 g、钠 mg、身高 cm、体重 kg。**不提供价格**——2026-11-13 产品决策，响应中不存在价格字段。
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
      "id": "cly-01", "name": "蟹黄肉酱拌面/粉", "category": "staple",
      "portion_label": "1 碗", "meals": ["breakfast", "lunch", "dinner"],
      "kcal": 607, "protein_g": 23, "fat_g": 19, "carbs_g": 86, "sodium_mg": 1500,
      "tags": ["seafood", "gluten", "meat"], "drink": false,
      "reliability": "B", "status": "active",
      "floor": 2, "stall": "二楼·朝陇阳",
      "serving_mode": "single", "pricing_mode": "fixed", "recommendable": true
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

**菜单 v3 的五个可选字段（v1.2.4 新增）**：`floor` / `stall` / `serving_mode` / `pricing_mode` / `recommendable` 来自实测菜单（`server/data/menu-seed.v3.json`，384 道）。**老种子（原型 55 道）没有这五列，此时服务端不写这个键**（不是写 `null`）——避免前端与契约测试多处理一种形状；`shared/src/types.ts` 里它们全部带 `?`。`meals` 现在可能是三项（`["breakfast", "lunch", "dinner"]` 为常态，二楼档口全天供应），不再只有两项。

**份量形态 `serving_mode`（v1.2.4 新增）**：一道菜在一餐里扮演什么角色，四态枚举 `combo` / `single` / `component` / `plate`。

| 枚举 | 现实是什么 | 引擎怎么处理 | 当前道数 |
|---|---|---|---|
| `combo` | 一楼中晚餐：拿盘选几样，每样按标价牌累加 | 参与组合，与主食/主菜/素菜各取其一 | 25 |
| `single` | 二楼成品餐与一楼面点：点一碗面 / 一盒饭就是**一整餐** | 自成一套，**不得再配主食** | 258 |
| `component` | 健康餐食材、麻辣烫配菜与汤底：自己在柜子里挑几样配主食 | 自由组合（麻辣烫是「汤底必选 + 配菜任选」的三段式） | 76 |
| `plate` | 一楼早餐自选线：拿盘称重、不可单点 | 不进 `combos`，只给配盘建议 | 25 |

> 缺省按 `combo` 处理（原型 55 道本就是这个结构，缺省成别的会让存量行为突变）。**使用方：引擎据此分流；前端建议不用**（「一份即一餐」已表达在 `combos` 的 dish 件数里，`plate` 根本不进推荐）。

**结算方式 `pricing_mode`（v1.2.4 新增）**：份量能不能说死，两态枚举 `fixed` / `weigh`。

| 枚举 | 现实是什么 | 热量怎么表达 | 当前道数 |
|---|---|---|---|
| `fixed` | 按标价牌点，份量固定 | `kcal` 可直接引用 | 284 |
| `weigh` | 称重结算，用户拿多少现场定 | `kcal` 是**参考值**，前端展示须注明「份量以现场称重为准」 | 100 |

> 称重档口（服务端据此下发 `weigh`）：一楼早餐线 28 道、二楼健康餐 32 道、二楼西蜀毛哥麻辣烫配菜 40 道；麻辣烫的汤底与免费米饭按份给，单独标 `fixed`。**使用方：前端必用**（W2 验收 I5 的文案判断，且推荐响应的 `ComboDish.pricing_mode` / `Combo.has_weighed_dish` 也同源，见 §2.3）；引擎用它在评分时放宽热量罚。

**可推荐性 `recommendable`（v1.2.4 新增）**：这道菜在不在推荐池里。`false` = **入库可查，但不进推荐**；当前 `false` 的 78 道来自汉堡工厂 37 / 缙云烧饼 16 / 炸串精选 14 / 绍兴小吃 11 四个档口，它们仍在 `/menu` 响应里（用户能查到食堂有什么），但推荐引擎不给出。缺省 `true`——**这是运营口径，不是技术开关**，调整档口推荐资格只改数据不改代码。**使用方：引擎据此过滤；前端建议不用**（若菜单页想标「不推荐」则可用，但不得据此隐藏菜）。

**楼层 `floor` 与档口 `stall`（v1.2.4 明确）**：`stall` 是展示用的档口全称，含楼层前缀（如 `"二楼·朝陇阳"`）；`floor` 供前端按楼层分组用（一楼 57 道 / 二楼 327 道），**二者信息有重叠但不冗余**——前端按楼层分组直接读 `floor`，不必解析 `stall` 字符串。**使用方：前端（按楼层/档口分组展示）**。

**`reliability`（v1.2.4 明确）**：数据可信度，A 称重 / B 反推 / C 众包。v3 的 384 道全为 B 级（按标准配比反推，已填 `ingredients`，但依据不进响应）；**前端当前不据此分支渲染（见 D4「A / B 级同一套 UI」），保留用于数据治理与将来可能的分级策略**。

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

**`DELETE /api/v1/profiles/me?session_id=...`（v1.2.4 新增，合规删除入口）**：

| 情况 | 响应 |
|---|---|
| 删除成功 | `204 No Content`（无响应体） |
| 档案不存在 | `404 NOT_FOUND`（与 `GET /profiles/me` 一致） |

**删除语义（v1.2.4 判定）**：**连带删除该 `session_id` 名下的全部 `meal-logs`**，不是只删档案。依据 README「合规边界」第 3 条——「涉及用户身体数据按个人信息处理，提供删除入口」；只删档案、留着按 session 关联的用餐记录不算清干净（那些记录同样能定位到个人）。代价是该用户的 `insights` 统计归零，这是删除的应有之义。前端加二次确认时须明确告知「会删除档案与全部用餐记录」。此端点属新增端点、兼容变更，无过渡期（附录 C 第 3 条）。

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
          "servings": 1, "kcal": 232, "protein_g": 4.4, "fat_g": 0.6, "carbs_g": 51.6, "sodium_mg": 2,
          "pricing_mode": "fixed" }
      ],
      "totals": { "kcal": 736, "protein_g": 32, "fat_g": 17, "carbs_g": 88, "sodium_mg": 1353 },
      "reason": "这一餐约 736 kcal，基本贴着午餐目标 730 kcal；蛋白质 32g 达标……",
      "engine": "llm",
      "has_weighed_dish": false
    }
  ],
  "notice": null
}
```

- `combos` 固定最多 3 套；服务端保证主菜组合不重复、主食互不相同（菜品池不足时放宽，见架构文档 §3）。
- **称重标记（v1.2.4 新增，两级，兼容）**：`ComboDish.pricing_mode?` 透传该道菜的结算方式（与 `Dish.pricing_mode` 同义，缺省按 `fixed` 处理），让前端能定位到具体哪一道是称重的；`Combo.has_weighed_dish?` 由服务端算好（本套任一道菜 `pricing_mode === "weigh"` 即为 `true`），前端一行判断即可决定是否显示「份量以现场称重为准」，不必遍历几十套组合。二者用于满足 W2 验收 I5；含称重菜时 `kcal` 为参考值，`reason` 文案亦会注明。两字段均为可选（老种子无 `pricing_mode` 时不下发 `pricing_mode`、`has_weighed_dish` 记 `false`）。
- **一套组合由哪些类目组成**（v1.2.2 新增，此前文档未定义）：

  | `meal` | 必备件 | 可选件 | 说明 |
  |---|---|---|---|
  | `lunch` / `dinner` | 主食 × 主菜 × 素菜 | 汤 | 汤不进必备件，有则加分、无则不影响成组 |
  | `breakfast` | **主食 × 主菜** | 水果 | **不要求素菜、不要求汤** |

  **早餐放宽的依据（数据实测）**：55 道种子里早餐 14 道，构成为主食 7 / 主菜 5 / 水果 2，**素菜 0 道、汤 0 道**。若沿用午晚的「主食 × 主菜 × 素菜」，早餐组合数直接为 0，推荐接口对早餐必然返回空。故早餐按「主食 × 主菜」成组，可选加一份水果。
  这条是**类目规则**，不新增字段：渲染仍按每道菜自带的 `category` 区分，见 §4.1-B。
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
  "adopted_combo_id": "c9f31a02",
  "adopted_combo": {
    "id": "c9f31a02",
    "items": [ { "dish_id": "s01", "servings": 1 }, { "dish_id": "m08", "servings": 1 } ]
  }
}
```

`servings` 取值 0.5 / 1 / 1.5 / 2（0.5 步进，上限 5）；`adopted_combo_id` 可空（自选）。

**采纳快照 `adopted_combo`（v1.2.5 新增）**：`{ id, items: [{ dish_id, servings }] }`。数据来自前端预填用的推荐缓存（零额外请求），`items` 的 `servings` 取**推荐当时**的份数（不是用户回填调整后的实际份数），`items` 的 `dish_id` 集合即被采纳那套的菜。与 `adopted_combo_id` **绑定**：带了 `adopted_combo_id` 就**必须**带 `adopted_combo`，缺快照 → `400 VALIDATION_ERROR`（字段级错误，`fields` 指向 `adopted_combo`，语义「无法验证采纳」）；两者都不带 = 自选，`adopted` 记 `false`（§4.1-C 不变）。快照随请求携带，`adopted` 判定不再依赖 `combo.id` 是否在 24h 有效期内。前端在缓存 24h 过期或丢失时降级为自选提交（不带 id、不带快照），避免服务端因缺快照返回 400。

**`adopted` 判定规则（v1.2.5 落定，服务端实现见 §2.1 BE-B 第 4 项）**：按「实际吃了哪套」逐菜比对——

- `fixed` 菜：**集合级比对**，`dish_id` 集合一致即算采纳，不比份量（没多吃/少吃/换菜就是吃了那套）；
- `weigh` 菜：实际份量须落在快照里推荐份量的 **±15%** 以内（0.5 步进下区间很窄，推荐 1 份时仅恰好 1 份能过——列为观察项，W3 人工抽检若发现误判过严再调阈值）；
- 无 `adopted_combo_id` / 无快照 = 自选，`adopted = false`。

落库加快照列 + 幂等迁移，**老记录 `adopted` 维持原值不重算**（历史无快照不可重算，7 天窗口滚动后影响自消）。`insights` 计算式不变（`adopted` 数 / 有记录餐数），变的只是 `adopted` 的判定依据。

响应（判定与文案均由服务端生成）：

```json
{
  "id": "b7e2-client-uuid", "duplicate": false,
  "date": "2026-11-04", "meal": "lunch",
  "items": [ { "dish_id": "s01", "name": "白米饭", "servings": 1 } ],
  "totals": { "kcal": 736, "protein_g": 32, "fat_g": 17, "carbs_g": 88, "sodium_mg": 1353 },
  "target": { "kcal": 730, "protein_g": 31, "fat_g": 55, "carbs_g": 96, "sodium_mg": 1600 },
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
| 餐次占比 | breakfast 0.25 / lunch 0.40 / dinner 0.35。**三者之和必须 = 1.0**，否则三餐目标相加 ≠ `day_kcal`（v1.2.3 先修和 = 1.05；v1.2.7 按 2026-11-24 实机体验把早餐降至 0.25、晚餐升至 0.35） |
| 单餐钠参考线 | 1600mg（超 1900 提示控盐） |
| 未成年 | age<18 时 lose 强制降级 health |

### 附录 B：推荐评分口径（权重基准）

热量偏离 ×120（health/gain 下热量 <85% 目标额外罚 ×140）；蛋白不足罚 ×45、超 160% 罚 ×35；脂肪能量占比 >42% 罚 ×200、<15% 罚 ×100；**钠罚分（v1.2.3 补系数，此前只写「线性罚」没给数值，实现各自取值）**：`Na ≤ 1600` 不罚；`1600 < Na ≤ 1900` 按 `(Na − 1600) × 0.05`；`Na > 1900` 在前者基础上再叠 `(Na − 1900) × 0.10`（即 1900 以上部分合计 ×0.15）。校验样例：`Na = 2150` → `550 × 0.05 + 250 × 0.10 = 52.5`。**`Na > 1900` 的组合理由文案必须带控盐提示**（附录 A「超 1900 提示控盐」的落地）。含蔬菜/水果 +7；lose 且脂肪 <32% +6；gain 且蛋白达标 +9。两阶段补「小荤」条件：`kcal ≤ 260 或 fat ≤ 12g`——**但补小荤不得新增菜品、不得改变 §2.3 的组合件数**（v1.2.3 限定）：它只用于「在结构之内优先挑高蛋白主菜」，不是再添一道菜。早餐不存在补小荤，因为早餐已放宽为两件套。

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
| v1.2.2 | 2026-11-06 | **补上 §2.3 缺失的组合结构规则。** 原文只写「最多 3 套、主食互不相同、主菜不重复」，从未定义一套由哪些 `category` 组成，导致引擎无从实现。现明确：午晚 = 主食 × 主菜 × 素菜（汤为可选加分项）；**早餐 = 主食 × 主菜，不要求素菜、不要求汤**（依据：早餐 14 道中素菜 0、汤 0，沿用午晚规则则组合数恒为 0）。无字段结构变更 |
| v1.2.3 | 2026-11-06 | **补两处会让实现直接算错的数字缺口。** ① 附录 A 餐次占比原为 `0.30 / 0.40 / 0.35`，**三者之和 1.05**——按餐目标加总会比 `day_kcal` 高 5%（实测日目标 2344kcal，三餐相加 2461.2）。改为 `dinner 0.30`，并写明「三者之和必须 = 1.0」，测试须断言此等式。② 附录 B 只写「钠 >1600mg 线性罚」却没给系数，BE-A 取了 ×0.01（超 900mg 仅扣 9 分），实测午餐三套钠 2150 / 2150 / 2500mg 全超标，而池内 1539 套组合中有 937 套（60.9%）能做到 ≤1600mg。现定分段系数 `(Na−1600)×0.05` + `(Na−1900)×0.10`，并要求超 1900 的组合理由带控盐提示。③ 附录 B「补小荤」补边界：不得新增菜品、不得改变 §2.3 组合件数（原规则与 v1.2.2 的结构定义冲突，会产出「双主菜」四件套）。无字段结构变更 |
| v1.2.4 | 2026-11-17 | **对齐实测菜单 v3 并补齐联调两处契约缺口**（BE-A 定稿，来源 PD 草稿 2026-11-15）。① §0 第 4 条删「价格元」（产品 2026-11-13 决定不提供价格）。② §2.1 示例换成 v3 真实菜（`cly-01`），删 `price_yuan`、补五个可选字段 `floor` / `stall` / `serving_mode` / `pricing_mode` / `recommendable`（老种子不下发这五个键），新增四段说明：份量形态四态 / 结算方式两态 / 可推荐性 / 楼层档口与 reliability 的使用方判定。③ §2.3 补两级称重标记 `ComboDish.pricing_mode?` + `Combo.has_weighed_dish?`（兼容新增，满足 W2 验收 I5）。④ §2.2 新增 `DELETE /profiles/me?session_id=`（204 / 404，**连带删除该 session 全部 meal-logs**，合规删除入口）。均为新增字段 / 新增端点、无过渡期 |
| v1.2.5 | 2026-11-18 | **回填采纳快照字段定稿**（BE-A 定稿，口径由 PD 11-17 拍板，见 PROGRESS §6 裁决行）。§2.4 `POST /meal-logs` 请求体新增可选 `adopted_combo: { id, items: [{dish_id, servings}] }`，与 `adopted_combo_id` 绑定——带 id 必带快照，缺 → `400 VALIDATION_ERROR`，用于逐菜比对替代「id 非空即采纳」。写明 `adopted` 判定：`fixed` 集合级比对、`weigh` 推荐份量 ±15%、无 id = 自选 `false`；快照随请求携带不再查 combo，老记录维持原值不重算。新增字段、兼容变更、无过渡期 |
| v1.2.6 | 2026-11-24 | **回填响应 `target` 补齐脂肪 / 碳水 / 钠**（PD 2026-11-24 实机体验反馈，BE-A 复核）。`calcTargets` 本来就产出六项，此前响应只映射 `kcal` / `protein_g`，导致反馈页这三条没有目标、只能显示「仅供参考」且对比条恒为空。现 `MealLogTarget = { kcal, protein_g, fat_g, carbs_g, sodium_mg }`。**判定口径不变**：`verdict` 仍只按 kcal 与 protein_g 计算。纯新增字段、兼容变更、无过渡期 |
| v1.2.7 | 2026-11-25 | **早餐占比 0.30 → 0.25，晚餐 0.30 → 0.35，午餐 0.40 不变**（2026-11-24 实机体验：日目标 2673 kcal 下早餐目标 801.9 kcal，推荐三套均为 700+ kcal 单碗，用户确认调整）。三者之和仍 = 1.0；仅 `MEAL_RATIO` 常量与 Mock 同步，服务端 112 / 前端 89 用例锁定新值。无字段结构变更 |

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
