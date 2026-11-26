/**
 * 本文件由 docs/API.md（v1.1）逐字段固化，是前后端共用的唯一类型事实源。
 *
 * 规则（见 docs/COLLAB.md 防线 1）：
 * - web/ 与 server/ 只能从这里 import 类型，禁止手写同名 interface；
 * - 改这里 = 改 docs/API.md，必须先走 API.md 附录 C 的接口变更流程；
 * - AI Agent 提出的「改字段名/改结构」建议一律视为变更请求，由 BE-A 判定，不得直接改。
 */

/* ---------- 基础枚举（API.md §2.1 §2.2） ---------- */

export type Meal = 'breakfast' | 'lunch' | 'dinner';

export type Category = 'staple' | 'protein' | 'veg' | 'soup' | 'fruit';

export type Sex = 'male' | 'female';

export type Activity = 'low' | 'mid' | 'high';

/**
 * 饮食目标四档（v1.2.9）：
 * - `health`      保持：维持体重，按 TDEE 吃（展示名「保持」）
 * - `lose`        减肥：留热量缺口，并下调脂肪能量占比（展示名「减肥」）
 * - `gain`        增肌：小幅热量盈余 + 高蛋白（展示名「增肌」）
 * - `weight_gain` 增重：更大幅度的热量盈余，蛋白维持量（展示名「增重」）
 */
export type Goal = 'health' | 'lose' | 'gain' | 'weight_gain';

/** 菜品数据可信度：A 称重 / B 反推 / C 众包 */
export type Reliability = 'A' | 'B' | 'C';

export type DishStatus = 'active' | 'hidden';

/** 理由文案引擎：llm 校验失败会降级为 template，响应中如实标记（ARCHITECTURE.md §4） */
export type TextEngine = 'template' | 'llm';

/** 回填反馈判定 */
export type VerdictLevel = 'ok' | 'warn';

/** 忌口过滤依据（API.md §2.1） */
export type DishTag =
  | 'pork'
  | 'beef'
  | 'seafood'
  | 'egg'
  | 'milk'
  | 'gluten'
  | 'peanut'
  | 'spicy'
  | 'meat'
  | 'vegprotein';

/* ---------- 统一响应包络（API.md §0.8 §1） ---------- */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export interface ApiErrorField {
  path: string;
  issue: string;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  fields?: ApiErrorField[];
}

/**
 * HTTP 层的映射结果。业务代码只见这两种形态：
 * 成功直返业务对象（响应体无 data/ok 包装层），失败返回单一 error 对象。
 * 解包逻辑只在 web/src/api/client.ts 一处实现。
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

/* ---------- 菜品与菜单（API.md §2.1） ---------- */

/**
 * 份量形态（菜单 v3 实测数据引入）。
 *
 * - `combo`     ：一楼中晚餐，拿盘选几样、每样按标价牌累加，是组合的**成员**（25 道）
 * - `single`    ：二楼成品档口 + 一楼面点，一份即一餐，**不得再配主食**（258 道）
 * - `component` ：轻食 / 麻辣烫配菜，需按「汤底 + 配菜」或按克重组合（76 道）
 * - `plate`     ：一楼早餐自选线，称重不可单点，只给配盘建议、不进 `combos`（25 道）
 *
 * 板上的规格只写了前三种（`plate | single | component`），但实测数据里有 25 道
 * `combo`，漏掉它会让 `menu-seed.v3.json` 无法通过类型检查。
 */
export type ServingMode = 'combo' | 'single' | 'component' | 'plate';

/** 结算方式：`fixed` 按标价牌 / `weigh` 称重（称重份量现场定，热量只作参考） */
export type PricingMode = 'fixed' | 'weigh';

export interface Dish {
  id: string;
  name: string;
  category: Category;
  portion_label: string;
  meals: Meal[];
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  sodium_mg: number;
  tags: DishTag[];
  drink: boolean;
  reliability: Reliability;
  status: DishStatus;

  /**
   * 以下五个字段来自菜单 v3（`server/data/menu-seed.v3.json`），**全部可选**：
   * 55 道原型种子没有它们，v3 的 384 道才有。只有 v3 才用得到的逻辑自己判空。
   *
   * `price_yuan` 已按 2026-11-13 的产品决策删除（产品不向用户提供价格），
   * 不要再加回来。
   */
  floor?: number;
  stall?: string;
  serving_mode?: ServingMode;
  pricing_mode?: PricingMode;
  recommendable?: boolean;
}

/** 忌口选项由服务端下发，前后端不各存一份（API.md §2.1） */
export interface AvoidOption {
  key: string;
  label: string;
  excludes_tag: DishTag;
}

export interface MenuResponse {
  dishes: Dish[];
  avoid_options: AvoidOption[];
}

/* ---------- 用户档案（API.md §2.2） ---------- */

/** avoid 元素是 AvoidOption.key（如 "nospicy"），不是 tag */
export interface ProfileInput {
  session_id: string;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  age: number;
  activity: Activity;
  goal: Goal;
  avoid: string[];
  default_meal: Meal;
}

/** 响应含服务端派生值，前端直接展示、不重复计算（架构 D1） */
export interface Profile extends ProfileInput {
  bmi: number;
  bmi_tag: string;
  day_kcal: number;
  warnings: string[];
}

/* ---------- 推荐（API.md §2.3） ---------- */

export interface NutritionTotals {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  sodium_mg: number;
}

export interface MealTarget extends NutritionTotals {
  day_kcal: number;
  meal_ratio: number;
}

export interface RecommendationRequest {
  session_id: string;
  meal: Meal;
  /** 临时覆盖本次请求，不落库（「换目标试算」场景） */
  overrides?: {
    goal?: Goal;
    avoid?: string[];
  };
}

export interface ComboDish {
  id: string;
  name: string;
  category: Category;
  portion_label: string;
  servings: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  sodium_mg: number;

  /**
   * 该道菜的结算方式（API.md v1.2.4 §2.3，**可选**）。
   *
   * 与 `Dish.pricing_mode` 同义，只为让前端能定位「具体是哪一道称重」；
   * **缺省按 `fixed` 处理**。老种子（原型 55 道）没有该字段，服务端不下发这个键。
   */
  pricing_mode?: PricingMode;
}

export interface Combo {
  /** 短哈希，供回填关联采纳，有效期 24 小时 */
  id: string;
  dishes: ComboDish[];
  totals: NutritionTotals;
  reason: string;
  engine: TextEngine;

  /**
   * 本套里是否含称重菜（API.md v1.2.4 §2.3，**可选**）。
   *
   * 由服务端算好（任一道 `pricing_mode === 'weigh'` 即 true），前端一行判断即可决定
   * 是否显示「份量以现场称重为准」，不必自己遍历组合。
   * 老种子没有 `pricing_mode` 时为 `false`（或不下发），前端按缺失/false 处理。
   */
  has_weighed_dish?: boolean;
}

export interface RecommendationResponse {
  target: MealTarget;
  /** 最多 3 套；忌口无解时为空数组 + notice 文案（不是错误） */
  combos: Combo[];
  notice: string | null;
}

/* ---------- 回填与反馈（API.md §2.4） ---------- */

export interface MealLogItemInput {
  dish_id: string;
  /** 0.5 步进，上限 5 */
  servings: number;
}

export interface MealLogRequest {
  /** 客户端生成的 UUID，作为幂等键 */
  id: string;
  session_id: string;
  /** YYYY-MM-DD */
  date: string;
  meal: Meal;
  items: MealLogItemInput[];
  adopted_combo_id?: string | null;

  /**
   * 被采纳组合的**快照**（API v1.2.5，PD 2026-11-17 裁决策略 B）。
   *
   * 服务端的 `combo.id` 是无状态短哈希（不落库、24h 过期），光有 id 无法判断
   * 「用户到底是不是照那套吃的」。所以由前端把预填时的组合缓存随请求一起发来，
   * 服务端拿它跟实际 `items` 逐菜比对：
   *
   * - `fixed` 菜：**集合级**比对（dish_id 集合一致即算，不比份量——没换菜就是吃了那套）
   * - `weigh` 菜：实际份量须在推荐份量 **±15%** 以内
   * - 无 `adopted_combo_id`：自选，`adopted = false`
   *
   * **带 dopted_combo_id 必须带快照，否则 400**（不允许「只带 id 不带证据」）。
ull 同省略。
   */
  adopted_combo?: AdoptedComboSnapshot;
}

export interface AdoptedComboSnapshot {
  /** 必须与 `adopted_combo_id` 一致 */
  id: string;
  items: MealLogItemInput[];
}

export interface MealLogItem {
  dish_id: string;
  name: string;
  servings: number;
}

export interface Verdict {
  level: VerdictLevel;
  title: string;
  body: string;
}

/**
 * 回填响应里的本餐目标。
 * v1.2.6（PD 2026-11-24）：补齐脂肪/碳水/钠 —— 服务端 `calcTargets` 本来就算出五项营养值
 * （另带 day_kcal / meal_ratio 两个元数据），只是此前只在响应里映射了前两项，导致反馈页这
 * 三条没有目标、只能显示「仅供参考」。
 * 判定口径不变：`judgeVerdict` 仍只看 kcal 与 protein_g。
 */
export interface MealLogTarget {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  sodium_mg: number;
}

export interface MealLogResponse {
  id: string;
  duplicate: boolean;
  date: string;
  meal: Meal;
  items: MealLogItem[];
  totals: NutritionTotals;
  target: MealLogTarget;
  verdict: Verdict;
  adopted: boolean;
}

/* ---------- 记录与统计（API.md §2.5） ---------- */

export interface MealLogListResponse {
  total: number;
  page: number;
  logs: MealLogResponse[];
}

export interface InsightsSummaryResponse {
  logged_meals: number;
  adopted: number;
  adoption_rate: number;
  avg_kcal: number;
  avg_protein_g: number;
}

/* ---------- 管理端（API.md §3） ---------- */

export interface DishRevisionListResponse {
  revisions: Array<{
    id: string;
    dish_id: string;
    changed_fields: Record<string, unknown>;
    operator: string;
    reason: string;
    created_at: string;
  }>;
}

export interface DishBulkImportResult {
  succeeded: number;
  failed: number;
  rows: Array<{ index: number; ok: boolean; message?: string }>;
}
