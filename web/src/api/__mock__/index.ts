// Mock 后端路由：按 docs/API.md v1.1 逐端点实现，响应形态严格遵循 §0.8 包络。
// 后端（BE-A/BE-B）实装后本目录整体删除，切换只需改 VITE_API_BASE。
import { API_PREFIX, DATE_PATTERN, PROFILE_LIMITS, SERVINGS_MAX, SERVINGS_STEP } from '@shared/constants';
import type {
  ActivityLevel,
  Combo,
  ComboDish,
  Goal,
  MealLog,
  MealLogInput,
  MealType,
  Profile,
  ProfileInput,
  RecommendRequest,
  Sex,
} from '@shared/types';
import { AVOID_OPTIONS, isKnownAvoidKey } from './avoidOptions';
import {
  comboIdOf,
  dishById,
  allDishes,
  activeDishes,
  findCombo,
  findLog,
  getProfile,
  insertLog,
  listLogs,
  saveCombos,
  upsertProfile,
  type StoredLog,
} from './db';
import { mealTarget, bmiTag, dayKcal, resolveGoal, scale, sumNutrition } from './nutrition';
import { buildCombos, reasonTemplate } from './recommender';
import { simulateNetwork } from './network';
import { verdictOf } from './verdict';

export interface MockResponse {
  status: number;
  body: unknown;
}

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner'];
const SEXES: Sex[] = ['male', 'female'];
const ACTIVITIES: ActivityLevel[] = ['low', 'mid', 'high'];
const GOALS: Goal[] = ['health', 'lose', 'gain'];

function fail(
  status: number,
  code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL',
  message: string,
  fields?: { path: string; issue: string }[],
): MockResponse {
  return { status, body: { error: { code, message, ...(fields?.length ? { fields } : {}) } } };
}

function invalid(fields: { path: string; issue: string }[]): MockResponse {
  return fail(400, 'VALIDATION_ERROR', '请求参数不合法', fields);
}

function mealLabel(meal: MealType): string {
  return meal === 'breakfast' ? '早餐' : meal === 'lunch' ? '午餐' : '晚餐';
}

function isoDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ---------------------------------------------------------------------------
// §2.1 菜单
// ---------------------------------------------------------------------------
function getMenu(query: URLSearchParams): MockResponse {
  const meal = query.get('meal');
  const includeInactive = query.get('include_inactive') === 'true';
  if (meal !== null && !MEALS.includes(meal as MealType)) {
    return invalid([{ path: 'meal', issue: `取值须为 ${MEALS.join('/')}` }]);
  }
  const dishes = includeInactive
    ? allDishes()
    : activeDishes(meal === null ? undefined : (meal as MealType));
  return { status: 200, body: { dishes, avoid_options: AVOID_OPTIONS } };
}

// ---------------------------------------------------------------------------
// §2.2 档案
// ---------------------------------------------------------------------------
function validateProfileInput(input: Partial<ProfileInput>): { path: string; issue: string }[] {
  const issues: { path: string; issue: string }[] = [];
  const push = (path: string, issue: string) => issues.push({ path, issue });

  if (!input.session_id) push('session_id', '不能为空');
  if (!SEXES.includes(input.sex as Sex)) push('sex', `取值须为 ${SEXES.join('/')}`);
  if (!ACTIVITIES.includes(input.activity as ActivityLevel)) {
    push('activity', `取值须为 ${ACTIVITIES.join('/')}`);
  }
  if (!GOALS.includes(input.goal as Goal)) push('goal', `取值须为 ${GOALS.join('/')}`);
  if (!MEALS.includes(input.default_meal as MealType)) {
    push('default_meal', `取值须为 ${MEALS.join('/')}`);
  }
  const check = (field: 'height_cm' | 'weight_kg' | 'age') => {
    const value = input[field];
    const { min, max } = PROFILE_LIMITS[field];
    if (typeof value !== 'number' || Number.isNaN(value) || value < min || value > max) {
      push(field, `取值须在 ${min}~${max}`);
    }
  };
  check('height_cm');
  check('weight_kg');
  check('age');
  if (!Array.isArray(input.avoid)) push('avoid', '须为数组');
  else input.avoid.forEach((key) => {
    if (!isKnownAvoidKey(key)) push('avoid', `未知忌口选项 ${key}`);
  });
  return issues;
}

function postProfile(body: Partial<ProfileInput>): MockResponse {
  const issues = validateProfileInput(body);
  if (issues.length > 0) return invalid(issues);

  const input = body as ProfileInput;
  const resolved = resolveGoal(input.age, input.goal);
  const profile: Profile = {
    session_id: input.session_id,
    sex: input.sex,
    height_cm: input.height_cm,
    weight_kg: input.weight_kg,
    age: input.age,
    activity: input.activity,
    goal: resolved.goal,
    avoid: input.avoid,
    default_meal: input.default_meal,
    bmi: Math.round((input.weight_kg / (input.height_cm / 100) ** 2) * 100) / 100,
    bmi_tag: '',
    day_kcal: 0,
    warnings: resolved.warning ? [resolved.warning] : [],
  };
  profile.bmi_tag = bmiTag(profile.bmi);
  profile.day_kcal = dayKcal(profile);
  return { status: 200, body: upsertProfile(profile) };
}

function getProfileMe(query: URLSearchParams): MockResponse {
  const sessionId = query.get('session_id');
  if (!sessionId) return invalid([{ path: 'session_id', issue: '不能为空' }]);
  const profile = getProfile(sessionId);
  if (!profile) return fail(404, 'NOT_FOUND', '档案不存在，请先建档');
  return { status: 200, body: profile };
}

// ---------------------------------------------------------------------------
// §2.3 推荐
// ---------------------------------------------------------------------------
function postRecommendation(body: Partial<RecommendRequest>): MockResponse {
  if (!body?.session_id) return invalid([{ path: 'session_id', issue: '不能为空' }]);
  const requestedMeal = body.meal;
  if (requestedMeal !== undefined && !MEALS.includes(requestedMeal)) {
    return invalid([{ path: 'meal', issue: `取值须为 ${MEALS.join('/')}` }]);
  }
  const profile = getProfile(body.session_id);
  if (!profile) return fail(404, 'NOT_FOUND', '档案不存在，请先建档');

  if (body.overrides?.goal && !GOALS.includes(body.overrides.goal)) {
    return invalid([{ path: 'overrides.goal', issue: `取值须为 ${GOALS.join('/')}` }]);
  }
  const meal = (requestedMeal ?? profile.default_meal) as MealType;
  const goal = body.overrides?.goal ?? profile.goal;
  const avoid = body.overrides?.avoid ?? profile.avoid;
  // overrides 仅本次请求生效、不落库（API.md §2.3）
  const target = mealTarget({ ...profile, goal }, meal);
  const combos = buildCombos({ meal, goal }, avoid, target);

  if (combos.length === 0) {
    return {
      status: 200,
      body: {
        target,
        combos: [],
        notice: '符合忌口条件的菜品太少，建议放宽一两个限制或换个时段',
      },
    };
  }

  const names = new Map(allDishes().map((dish) => [dish.id, dish.name]));
  const payload: Combo[] = combos.map((combo) => {
    const dishes: ComboDish[] = combo.dish_ids.map((id) => {
      const dish = dishById(id)!;
      const scaled = scale(dish, 1);
      return {
        id: dish.id,
        name: dish.name,
        category: dish.category,
        portion_label: dish.portion_label,
        servings: 1,
        kcal: scaled.kcal,
        protein_g: scaled.protein_g,
        fat_g: scaled.fat_g,
        carbs_g: scaled.carbs_g,
        sodium_mg: scaled.sodium_mg,
      };
    });
    return {
      id: comboIdOf(combo.dish_ids),
      dishes,
      totals: combo.totals,
      reason: reasonTemplate(combo, target, combo.dish_ids.map((id) => names.get(id) ?? ''), meal),
      engine: 'template',
    };
  });
  saveCombos(body.session_id, meal, combos.map((combo) => combo.dish_ids));
  return { status: 200, body: { target, combos: payload, notice: null } };
}

// ---------------------------------------------------------------------------
// §2.4 回填
// ---------------------------------------------------------------------------
function validateMealLog(body: Partial<MealLogInput>): { path: string; issue: string }[] {
  const issues: { path: string; issue: string }[] = [];
  const push = (path: string, issue: string) => issues.push({ path, issue });
  if (!body.id) push('id', '客户端 UUID 不能为空（幂等键）');
  if (!body.session_id) push('session_id', '不能为空');
  if (!body.date || !DATE_PATTERN.test(body.date)) push('date', '格式须为 YYYY-MM-DD');
  if (!MEALS.includes(body.meal as MealType)) push('meal', `取值须为 ${MEALS.join('/')}`);
  if (!Array.isArray(body.items) || body.items.length === 0) push('items', '至少回填一个菜品');
  else {
    body.items.forEach((item, index) => {
      if (!dishById(item.dish_id)) push(`items[${index}].dish_id`, `菜品 ${item.dish_id} 不存在`);
      const servings = item.servings;
      if (
        typeof servings !== 'number' ||
        servings <= 0 ||
        servings > SERVINGS_MAX ||
        Math.abs(servings / SERVINGS_STEP - Math.round(servings / SERVINGS_STEP)) > 1e-9
      ) {
        push(`items[${index}].servings`, `取值须为 ${SERVINGS_STEP} 的整数倍且不超过 ${SERVINGS_MAX}`);
      }
    });
  }
  return issues;
}

function postMealLog(body: MealLogInput): MockResponse {
  const issues = validateMealLog(body);
  if (issues.length > 0) return invalid(issues);

  const existing = findLog(body.id);
  if (existing) {
    // 幂等：重复 id 返回首次结果并附 duplicate=true（API.md §0.7）
    const { session_id: _drop, ...log } = existing;
    return { status: 200, body: { ...log, duplicate: true } };
  }

  const profile = getProfile(body.session_id);
  if (!profile) return fail(404, 'NOT_FOUND', '档案不存在，请先建档');

  const totals = sumNutrition(
    body.items.map((item) => scale(dishById(item.dish_id)!, item.servings)),
  );
  const target = mealTarget(profile, body.meal);
  const combo = body.adopted_combo_id ? findCombo(body.adopted_combo_id) : undefined;
  const adopted =
    combo !== undefined &&
    combo.session_id === body.session_id &&
    sameSet(combo.dish_ids, body.items.map((item) => item.dish_id));

  const stored: StoredLog = {
    id: body.id,
    session_id: body.session_id,
    duplicate: false,
    date: body.date,
    meal: body.meal,
    items: body.items.map((item) => ({
      dish_id: item.dish_id,
      name: dishById(item.dish_id)!.name,
      servings: item.servings,
    })),
    totals,
    target: { kcal: target.kcal, protein_g: target.protein_g },
    verdict: verdictOf(totals, target, mealLabel(body.meal)),
    adopted,
  };
  insertLog(stored);
  const { session_id: _drop, ...response } = stored;
  return { status: 200, body: response };
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function getMealLogs(query: URLSearchParams): MockResponse {
  const sessionId = query.get('session_id');
  if (!sessionId) return invalid([{ path: 'session_id', issue: '不能为空' }]);
  const page = Math.max(1, Number(query.get('page') ?? 1));
  const pageSize = Math.max(1, Number(query.get('page_size') ?? 20));
  const all = listLogs(sessionId, query.get('from') ?? undefined, query.get('to') ?? undefined);
  const logs: MealLog[] = all.slice((page - 1) * pageSize, page * pageSize).map((log) => {
    const { session_id: _drop, ...rest } = log;
    return rest;
  });
  return { status: 200, body: { total: all.length, page, logs } };
}

// ---------------------------------------------------------------------------
// §2.5 统计
// ---------------------------------------------------------------------------
function getInsightsSummary(query: URLSearchParams): MockResponse {
  const sessionId = query.get('session_id');
  if (!sessionId) return invalid([{ path: 'session_id', issue: '不能为空' }]);
  const days = Math.max(1, Number(query.get('days') ?? 7));
  const from = isoDate(days - 1);
  const logs = listLogs(sessionId, from, isoDate());
  const adopted = logs.filter((log) => log.adopted).length;
  const avg = (pick: (log: StoredLog) => number) =>
    logs.length === 0 ? 0 : Math.round(logs.reduce((sum, log) => sum + pick(log), 0) / logs.length);
  return {
    status: 200,
    body: {
      logged_meals: logs.length,
      adopted,
      adoption_rate: logs.length === 0 ? 0 : Math.round((adopted / logs.length) * 100) / 100,
      avg_kcal: avg((log) => log.totals.kcal),
      avg_protein_g: avg((log) => log.totals.protein_g),
    },
  };
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------
export async function handleMockRequest(
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  body: unknown,
): Promise<MockResponse> {
  await simulateNetwork();
  const parsed = new URL(url, 'http://mock.local');
  const path = parsed.pathname.replace(API_PREFIX, '');
  const query = parsed.searchParams;

  if (method === 'GET' && path === '/menu') return getMenu(query);
  if (method === 'POST' && path === '/profiles') return postProfile(body as Partial<ProfileInput>);
  if (method === 'GET' && path === '/profiles/me') return getProfileMe(query);
  if (method === 'POST' && path === '/recommendations') {
    return postRecommendation(body as Partial<RecommendRequest>);
  }
  if (method === 'POST' && path === '/meal-logs') return postMealLog(body as MealLogInput);
  if (method === 'GET' && path === '/meal-logs') return getMealLogs(query);
  if (method === 'GET' && path === '/insights/summary') return getInsightsSummary(query);
  return fail(404, 'NOT_FOUND', `接口不存在：${method} ${path}`);
}
