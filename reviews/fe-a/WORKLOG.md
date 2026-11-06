# FE-A 工作日志（决策与溯源记录）

> 目的：出问题时能顺着时间线定位「当时依据什么做的、验证到什么程度、环境改过什么、怎么回滚」。
> 规则：每个条目都带**依据出处**和**可复现命令**。未经运行验证的结论一律标注「未验证」。
> 工作副本目录：`fe-a/`（会话目录内，非仓库文件）；对外交付物见 §5。

---

## 1. 环境与工作副本（2026-11-06 上午）

| 项 | 值 | 备注 |
|---|---|---|
| 工作副本 | `C:\Users\ph\Documents\Qoder\2026-11-06\b96fd52f\nutritionist-prototype` | `git clone --depth 20 https://github.com/givehope488/nutritionist-prototype.git` |
| 上游 | `main` @ `037a9cd "Add files via upload"`（14 小时前），共 2 个提交，无分支、无 PR、无 Issue | `git log --oneline` / `git branch -a` |
| 仓库实际内容 | 仅 `README.md`、`docs/{API,ARCHITECTURE,COLLAB,TEAM}.md`、`server/data/menu-seed.json` | **无 `web/`、无 `shared/`、无 Mock API、无 CI** |
| Node（新装） | `v26.13.0` + `npm 11.20.0`，路径 `C:\Users\ph\AppData\Local\Programs\nodejs-26` | 见 §1.2 |

### 1.1 装机前的事实（可复现）

```
which node npm        → 均不存在（/usr/bin/bash: node: command not found）
cmd //c "node -v"     → 'node' 不是内部或外部命令
```
结论：这台机器在 FE-A 手里是**跑不了前端工程**的，vite / typecheck / e2e 全部无从验证。这是本轮最先暴露的阻塞。

### 1.2 Node 安装过程与踩坑（3 次尝试才成功）

| # | 动作 | 结果 | 教训 |
|---|---|---|---|
| 1 | `curl https://nodejs.org/dist/index.json` | 12s 超时（exit 28） | 直连官方源不稳，改用 `https://cdn.npmmirror.com/binaries/node/`（2.6s 200 OK） |
| 2 | `tar -xf node-v26.13.0-win-x64.zip` | `tar: This does not look like a tar archive` | 该 bash 里的 `tar` 不支持 zip；zip 本身完整（`PK\003\004` 头 + `PK\005\006` 尾），改用 `unzip -q -o` 成功 |
| 3 | `powershell -Command "$old=[Environment]...; Set-Content ..."` | `CommandNotFoundException`，且备份目标目录 `fe-a/` 当时还不存在 | 内联长命令含 `$` 与括号在 bash 里易被吃掉；改为写 `.ps1` 脚本文件 + `-File` 执行，成功 |

版本选择：仓库无 `.nvmrc`，无从对齐。**决策：装当前 latest LTS（v26.13.0）**，来源 `cdn.npmmirror.com/binaries/node/index.json` 中首条 `lts` 非空记录（`v26.13.0 / Lithium`）。
风险登记：若 BE-B 的 `.nvmrc` 最终锁 24.x（`Krypton`），需重装；回滚成本低（见下）。

安装方式与影响面：
- 用户级 zip 解压，**不跑 installer、不请求管理员权限、不写系统 PATH**；
- 仅追加到**当前用户的** PATH 尾部；改前原值已备份到 `fe-a/path-backup.txt`；
- 生效条件：**新开**终端进程才可见；本次会话内的 bash 工具仍需用绝对路径调用 `node.exe` / `npm`。

回滚方式（两步，都不需要管理员）：
```
# 1) 恢复 PATH
powershell -File <把 fe-a/path-backup.txt 内容 SetEnvironmentVariable('Path', <原值>, 'User')>
# 2) 删除目录
rm -rf /c/Users/ph/AppData/Local/Programs/nodejs-26
```
未做的事（**有意留下，避免越界**）：未创建或修改全局 `~/.npmrc`，未把 npm registry 指向镜像。后续 `npm install` 若超时，再单独决定，且该配置属 COLLAB.md 防线 3 的「根配置」范畴，应由 BE-B 统一给。

## 2. 数据侧核验（评审意见的证据来源）

方法：perl `JSON::PP` 全量解析 `server/data/menu-seed.json`（本机无 node，故未用 JS）。命令与结论可复现。

**踩坑记录（重要，影响过一次结论）**：第一版脚本里写了
`next unless grep { $_ eq "breakfast" } @{$x->{meals}} && $x->{category} eq "staple";`
grep 的 LIST 把 `&& ...` 整段吞掉，导致「午餐 protein 池 = 0 道」这类**错误统计**。已改为显式子程序 `has($x,$m)` 重跑，下表为**重跑后的正确值**。教训：统计类脚本不要相信第一次输出，先挑一个已知值（种子共 55 道）对一遍。

| 核验项 | 结果 |
|---|---|
| 菜品总数 / reliability / status | 55 道，`reliability` **全为 B**，`status` 全为 `active` |
| 字段集合 | `carbs_g category drink fat_g id kcal meals name portion_label price_yuan protein_g reliability **source** sodium_mg tags` |
| `source` 取值 | **55 条完全相同**：`"原型估算种子数据，需按反推法复核"` → 契约与架构文档均无此字段（评审单 Y6） |
| 各餐段池 | 早餐 `staple=7 protein=5 fruit=2 veg=0 soup=0`；午/晚餐 `staple=9 protein=19 veg=9 soup=4 fruit=0`（→ 评审单 B3） |
| tag 总量 | `meat=18 pork=13 gluten=11 egg=8 spicy=6 seafood=3 vegprotein=9 beef=1 milk=2 peanut=1` |
| **`pork` 但不含 `meat`** | `s11 小笼包`、`s12 蒸饺`、`s13 肉包`（均早餐 staple）→ `excludes_tag` 单值无法表达素食，会把猪肉包子推给素食者（评审单 B2） |
| `meat` 但非猪/牛/海鲜 | 5 道禽类：`m06 红烧鸡腿 m07 宫保鸡丁 m08 白切鸡 m09 香菇滑鸡 m19 手撕鸡丝` |
| 午餐蛋白池 tag 分布 | 19 道：`meat=15 pork=7 egg=3 seafood=2 vegprotein=4 beef=1 gluten=1 peanut=1` |
| 纯素过滤（排 meat/pork/beef/seafood/egg/milk）后 | 早餐 `fruit=2 protein=2 staple=3`；午/晚餐 `protein=2 staple=7 veg=9`，**soup=0** |
| 早餐 + 忌 `gluten` | 7 道主食只剩 `s10 白粥` 1 道（其余 6 道全带 gluten）→ 无解是常见路径不是边角（评审单 Y3） |
| 汤池 | 4 道全含 `egg` 或 `pork/meat`，无纯素汤 |
| `portion_label` 形态 | 混用克重与非克重：`200g / 8只 / 6只 / 1个 / 1根 / 300ml / 250ml / 150g` → 「精确克重」需定义（评审单 Y5） |
| `price_yuan` | 全部满足「1 位小数」口径，无违规值 |

## 3. 本轮产出物的关键决策与依据

| 决策 | 依据 | 若推翻的后果 |
|---|---|---|
| 不修改 `docs/API.md`，评审意见以独立文档 + 评审单形式提交 | API.md 附录 C.1「先改文档、只改文档」由**提出人提 PR**，且 §5.5 `API.md` 归 BE-A；DoD 第 3 条「PR 只含自己所有权目录」 | 若我直接改字段 → 触发 F1，且违反 C.5 |
| 交付物放仓库根新建 `reviews/fe-a/`，并在 PR 里请团队判定落位 | COLLAB 防线 2 未分配 `reviews/`；`docs/` 归 BE-A/BE-B/PD，塞进去必被打回 | PR 直接被 Reviewer 按「查护栏」退回，白跑一轮 |
| 「换一批」按钮**先不实现** | B1 未决 + D1 前端禁算 → 本地重排即口径漂移 | 做出骗人的交互，W3 验收当场翻车 |
| 建档页 `age<18` 禁用减脂选项**可以做** | §2.2 明文「前端须同时禁用减脂选项（双保险）」；这是 UI 可用性约束，非营养计算 | 违反 §2.2，未成年走服务端兜底后前端仍显示可选，用户困惑 |
| 忌口选项不在前端硬编码 | §2.1「忌口选项集合由服务端下发，避免前后端硬编码两份」 | F1 重演，PD 改选项即前端失真 |
| 未决项统一用 TODO 注释指向本评审单，不留临时实现 | COLLAB §5 禁止项 + 求助判据 | 临时兜底代码会在联调时以「看起来能跑」的形态掩盖契约缺口 |

## 4. 验证做到哪一步（诚实边界）

已完成（有原始输出）：
- clone、提交历史、文件树、`main` 内容清点；
- 55 道种子数据全量统计（§2，含一次自我纠错）；
- 本机 Node 可用性核验与安装（`node.exe -v` → `v26.13.0`，`npm -v` → `11.20.0`）；
- 四份文档逐字段比对，产出 3 阻塞 + 7 需澄清 + 4 建议 + 1 流程归属缺口。

**未做 / 无法做（不存在，谈不上验证）**：
- `npm run lint / typecheck / test / smoke / e2e` —— 仓库里既无 `package.json` 也无 CI，命令不存在；
- 任何页面运行效果 —— 无 `web/` 脚手架、无 Mock API、无 `shared/` 类型包；
- `api.github.com` 的 Issue/PR 列表 —— 未认证请求命中限流（403 rate limit），改用本地 clone 得到同等结论（仓库仅 2 提交、无分支）。
- Node 装完后**尚未在新终端里复验** `node -v` 是否可直接命中 PATH（会话内 PATH 未刷新）。下轮开工第一件事就是复验这条。

## 5. 交付物清单与后续动作

| 文件 | 用途 | 交付对象 |
|---|---|---|
| `API-REVIEW.md` | W1 接口冻结评审意见单（签字条件在文末） | BE-A（主笔）、PD（Y5）、FE-B（B3/Y4/G3） |
| `CONTRACT-NOTES.md` | 三页字段绑定基准 + 上游依赖清单 | FE-A 自用，联调前与 FE-B 对槽位 |
| `AGENT-PROMPT.md` | W1 验收项「约定各自 Agent 的禁止项模板」 | 团队群内确认三条铁律时同步 |
| `WORKLOG.md` | 本文件 | 溯源用，持续追加 |
| `path-backup.txt` | 用户 PATH 原值 | 回滚用 |
| `PR.md` | PR 描述正文（含越界目录审批请求） | Reviewer 三查 |

下一步（按依赖顺序）：
1. 把 B1/B2/B3 三条阻塞在接口评审会上过掉，Y5 单独 @ PD；
2. @ BE-B 确认 `shared/`、Mock API、`VITE_API_BASE` 的就绪时间，@ FE-B 确认脚手架是否含 router / `client.ts` / session 工具（评审单「流程问题」表）；
3. 依赖到位后进入 W2 建档页，届时 `.nvmrc` 若与 v26 不符，先对齐再装依赖；
4. 里程碑若有延期 >2 天，按 TEAM.md §5.1 在群里说明并更新文档（本文档属 PD，需 @ 他）。

## 6. 日志追加规则

后续每完成一个可交付动作，在**文末**按 `## 7.`、`## 8.` 递增追加一节，写：做了什么 / 依据 / 跑了什么命令 / 输出是什么 / 留下什么未验证。**不回改历史条目**，出错就新增一条纠正记录并指明被纠正的原条目。

## 7. 2026-11-06 交付动作与验证结果

### 7.1 分支与提交范围核验

```
git checkout -b feat/fe-a-api-review-w1
git add reviews/fe-a
git diff --cached --stat main
→ reviews/fe-a/AGENT-PROMPT.md   |  75 +++
  reviews/fe-a/CONTRACT-NOTES.md | 112 +++
  reviews/fe-a/API-REVIEW.md     | 162 +++
  reviews/fe-a/WORKLOG.md        | 119 +++
  4 files changed, 468 insertions(+)
```

**关键结论：暂存文件列表里没有任何 `docs/`、`shared/`、`web/`、`server/`、`package.json`、CI 配置** —— 这是 DoD 第 3 条与 COLLAB 防线 2 的自查，Reviewer「查护栏」可直接引用这条输出。

未纳入提交的本地产物：`PR.md`（PR 描述正文，贴 GitHub 用）、`path-backup.txt`（本机 PATH 原值，属个人环境，不进仓库）。

### 7.2 对本机环境登记的纠正（不覆盖 §1.2 的历史记录）

§1.2 写的「新开终端才生效」需要更精确的实测结论：

```
powershell "[Environment]::GetEnvironmentVariable('Path','User')"
→ ...WindowsApps;C:\Users\ph\AppData\Local\Programs\nodejs-26   ← 用户 PATH 已持久化，正确

node -v          （在当前工具的 shell 里）→ command not found
绝对路径 node.exe -v → v26.13.0   npm.cmd -v → 11.20.0
```

纠正后的事实：用户级 PATH 已写对，但**本会话内所有子进程继承的是 Qoder 主进程的旧环境块**，因此在 Qoder 里起的终端 / Agent 工具都不会自动看到 node。

影响与对策：
- 我这侧：本轮所有 node/npm 调用一律走绝对路径 `C:\Users\ph\AppData\Local\Programs\nodejs-26\npm.cmd`；
- 你（真人）侧：**完全退出并重启 Qoder**（不是重开会话）后，新终端里 `node -v` 才会直接命中；
- 若重启后仍不生效，用 `$env:Path += ';C:\Users\ph\AppData\Local\Programs\nodejs-26'` 临时救一次，并把这条反馈给 BE-B 写进 `.nvmrc` / 环境文档。

### 7.3 当前状态与待办

| 项 | 状态 |
|---|---|
| 评审意见单 / 契约笔记 / Agent 模板 / 工作日志 | 已完成，待提交（缺 git 身份：名字 + 邮箱） |
| `git commit` | 暂存完毕，等身份；提交后 push 与开 PR 由 FE-A 本人执行 |
| CI 三件套 | **无法运行**：仓库无 CI、无 `package.json`、无 `.nvmrc`（BE-B 的 W1 脚手架未落地）。已在 PR 描述「查护栏」一节如实标注，不作为我的 DoD 缺失 |
| 页面代码 | 未写。上游 `shared/`、Mock API、脚手架均不存在，且 B1/B2/B3 未决 |
