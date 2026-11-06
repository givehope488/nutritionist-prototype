# 食堂营养师（Canteen Nutritionist）

面向高校食堂场景的单餐营养推荐系统：学生填写身体数据、选择营养目标（保健 / 减脂 / 增肌）与忌口，系统结合食堂菜品营养库，给出本餐的具体搭配与推荐理由；用餐后回填实际吃了什么，形成「建议 → 执行 → 反馈」闭环。

> 本产品输出为日常膳食参考，**不构成医疗或营养处方建议**。未满 18 岁用户不提供热量缺口方案。

## 产品定义

- **用户**：杭电绍兴校区在校学生（住宿、以食堂为主要就餐场景）
- **核心场景**：饭点前打开 → 看 3 套搭配（含热量 / 蛋白 / 脂肪 / 碳水 / 钠与理由）→ 去对应窗口打菜 → 吃完回填 → 得到对比反馈
- **成功指标**：建档完成率、建议采纳率（回填结果与推荐一致的比例）、7 日留存

## 当前状态

| 阶段 | 状态 |
|---|---|
| 可交互原型（纯前端，全流程跑通） | ✅ 完成，见 `../nutritionist-prototype/index.html` |
| 种子数据（55 道菜，可信度 B） | ✅ 已导出至 `server/data/menu-seed.json`，待反推法复核扩充 |
| 团队版（前后端分离） | 🚧 本仓库目标，**开发周期 3 周**：核心闭环（建档→推荐→回填→反馈）优先，LLM 文案层与管理端 UI 后移至上线后（架构已预留切换，见 ARCHITECTURE.md §4.3） |

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 前端 | Vue 3 + Vite，移动优先 H5 | 单页应用，无 SSR 需求 |
| 后端 | Node.js (Express) + TypeScript | REST API，服务端为营养计算口径唯一来源 |
| 数据库 | SQLite（起步）→ PostgreSQL（可平滑迁移） | 用 ORM（如 Drizzle/Prisma）隔离方言 |
| LLM 文案层 | 可插拔（`template` / `llm`） | 数值全部由代码计算，LLM 仅润色理由文案，输出校验失败自动降级到模板 |

## 快速开始

```bash
# Node 版本见 .nvmrc（22），依赖由 npm workspaces 统一管理，根目录装一次即可
npm install

# 后端（已实现 /healthz 与 GET /api/v1/menu 两个探针，其余端点按 W2 排期实装）
npm run dev                       # http://localhost:8787

# 护栏三件套：与 CI 执行的命令完全一致，提交前本地跑一遍
npm run lint
npm run typecheck
npm test
```

前端 `web/` 尚未建脚手架（W1 由 FE-B 落地）。建好后在需要时把它加入根 `package.json` 的 `workspaces`，CI 会自动接管它的 lint / typecheck / test（已写好条件判断，无需改 workflow）。

> `npm run seed`（种子写入数据库）随 W2 的 SQLite 落库一并提供，当前后端直接读 `server/data/menu-seed.json`。

## 目录结构

```
canteen-nutritionist/
├── README.md               # 本文件
├── package.json            # 根工作区（workspaces: shared / server），护栏命令入口
├── tsconfig.base.json      # 共享 TS 配置（strict 全开）
├── eslint.config.mjs       # 全仓 lint 规则（含"类型必须 import type"约束）
├── .nvmrc                  # 锁 Node 22
├── docs/
│   ├── PROGRESS.md         # **项目进程（公用协调入口）**：现在到哪、谁做什么、卡在谁身上
│   ├── ARCHITECTURE.md     # 项目架构文档（模块职责、数据流、LLM 层设计、ADR）
│   ├── TEAM.md             # 分工安排（角色矩阵、三周排期、协作机制）
│   ├── COLLAB.md           # AI 辅助开发协作规约（新手 + Agent 的防线与合并门禁）
│   └── API.md              # 接口协定 v1.2（端点定义、数据模型、错误码、变更流程）
├── .github/
│   ├── CODEOWNERS          # 目录所有权（真实用户名，PR 自动拉对应负责人）
│   ├── progress-pd.sha256  # 进程文档 §0~§4 的指纹（只有 PD 能改那几节）
│   └── workflows/ci.yml    # CI：lint / typecheck / test（含数据体检与进程文档体检）
├── scripts/
│   └── check-progress.mjs  # 进程文档体检：PD 专区指纹 + §5/§6 追加行格式
├── shared/                 # 前后端共享类型与常量（由 API.md 固化，唯一事实源）
│   └── src/{types,constants}.ts
├── server/                 # 后端（Express + TS）
│   ├── data/menu-seed.json # 菜品种子数据（v2：份量字段已拆）
│   ├── data/review/        # 55 行 PD 复核底稿（CSV，Excel 可直接开）
│   ├── scripts/            # check-data.mjs：数据体检，拦录入错误
│   ├── test/               # vitest：契约断言 + 契约一致性（解析 API.md 附录 D 比对）
│   └── src/
│       ├── app.ts          # createApp：中间件 → 路由 → 404 → 统一错误出口
│       ├── http/errors.ts  # HttpError + 统一错误包络（禁止各模块自创格式）
│       ├── routes/         # 端点（当前仅 menu）
│       ├── data/           # 数据访问（当前读种子，W2 换 SQLite）
│       ├── engines/        # 营养计算引擎、推荐引擎 —— 待 BE-A
│       ├── services/       # 用户档案、用餐记录、统计 —— 待 BE-B
│       ├── llm/            # 理由生成（template / llm 双引擎 + 校验降级）—— 待 BE-B
│       └── admin/          # 管理端 API（菜品 CRUD、数据校准）—— 待 BE-B
└── web/                    # 前端（Vue 3）—— FE-B 已建脚手架，待合并
    └── src/
        ├── views/          # 建档 / 目标 / 推荐 / 回填 / 反馈 / 历史
        └── components/
```

## 团队协作约定

- **分支模型**：`main`（受保护）+ `feat/*` `fix/*` 短分支，PR 合并须至少 1 人 Code Review
- **接口即契约**：所有前后端交互以 `docs/API.md` 为唯一事实源，改接口先改文档、发起评审，再动代码（流程见 API.md 附录）
- **类型即护栏**：前后端只能从 `shared/` 导入类型，禁止各自手写接口类型；CI（lint / typecheck / test / 数据体检 / 进程文档体检）不绿不合并
- **进程只在一处**：进度、分工、卡点统一记在 [`docs/PROGRESS.md`](docs/PROGRESS.md)。除 PD 外，其他人只往它的「变更记录」「问题登记」追加一行，不改其他章节（CI 会比对指纹）
- **目录所有权**：每人只改自己负责的目录，动别人的目录先 @ 所有者
- **Agent 协作**：给 AI Agent 下任务必须附契约上下文（API.md 段落 / `shared/` 类型）与禁止项，模板见 `docs/COLLAB.md`
- **里程碑**：**3 周**紧凑排期（W1 地基 / W2 核心闭环 / W3 上线）与范围裁剪清单见 `docs/TEAM.md` §3
- **数据维护**：菜品营养数据由数据负责人在管理端维护，禁止直接改 `menu-seed.json`（该文件仅作为首次初始化种子）

## 文档索引

| 文档 | 用途 |
|---|---|
| [docs/PROGRESS.md](docs/PROGRESS.md) | **先看这个。** 项目进程与公用协调入口：现在到哪、每人下一步做什么、卡在谁身上、谁改了什么 |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架构设计、模块边界、LLM 层约束、技术决策记录 |
| [docs/TEAM.md](docs/TEAM.md) | 分工、排期、协作机制 |
| [docs/COLLAB.md](docs/COLLAB.md) | **新手 + AI Agent 协作规约**：防线与合并门禁、提示词模板、DoD、失败速查表 |
| [docs/API.md](docs/API.md) | 接口协定 v1.2，前后端并行开发的依据；忌口项见附录 D |

## 合规边界（全员必读）

1. 全流程展示「非医疗建议」免责声明；不做疾病膳食处方、补剂推荐
2. 未满 18 岁：减脂目标强制降级为保健，前后端双重校验
3. 涉及用户身体数据（身高 / 体重 / 年龄）按个人信息处理，仅存必要字段，提供删除入口
4. 菜品数据标注可信度等级（A 称重 / B 反推 / C 众包），B 级以下不在前端展示精确克重
