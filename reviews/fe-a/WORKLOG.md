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

## 8. 2026-11-06 仓库权限受阻记录（重要：这是 W1 的未登记依赖）

起因：需要把评审产出推到 `github.com/givehope488/nutritionist-prototype`，但 FE-A 本机没有 GitHub 账号。

实测的认证条件（全部为空，可复现）：

```
which gh                    → 未安装（GitHub CLI 不存在）
ls ~/.ssh                   → 目录不存在（无 SSH key）
git config --get credential.helper → helper-selector（无已存凭据）
git config --global user.email     → 空（无 git 身份）
仓库 owner                → givehope488 / zhang san（唯一贡献者，1 人）
```

结论与处置：

| 事项 | 能不能做 | 原因 |
|---|---|---|
| 由 Agent 代注册 GitHub 账号 | **不做** | 注册需真实邮箱验证 + 人机验证 + 本人同意服务条款，属必须由本人完成的动作；自动化注册也违反 GitHub 服务条款 |
| 由 Agent 直接 push | **不能** | 既无账号也无凭据；且该仓库 owner 是 zhang san，即使有账号，非 collaborator 也只有读权限 |
| 本地 commit | **已做** | `9f4dfa1`，分支 `feat/fe-a-api-review-w1`。身份临时用 `FE-A <fe-a@users.noreply.github.com>`（未推送，可随时改，命令见下） |
| 离线交接 | **已做** | 见 §8.2 三个产物 |

### 8.1 提交与改身份（本地已完成，等真人 push）

```
# 已完成（用 -c 临时身份，没有改动任何 git 配置）
git -c user.name="FE-A" -c user.email="fe-a@..." commit -m "reviews: ..."

# 若日后拿到真实账号，推送前改成自己的署名（历史未公开，可安全重写）
git commit --amend --author="你的名字 <你的邮箱>" --no-edit
```

### 8.2 三条可行路径（按成本排序）

| 路径 | 操作 | 适合 |
|---|---|---|
| A. 交给有权限的人 | 把 `handoff/fe-a-api-review.bundle` 发给 BE-A/zhang san，他执行 `git fetch <bundle> main..feat/fe-a-api-review-w1` 后 push | 今天就想让团队看到，零账号成本 |
| B. 申请 collaborator | 自己花 2 分钟注册账号 → 请 zhang san 在 Settings → Collaborators 邀请 → 我再帮你配 HTTPS 令牌或 SSH key → 正常 push 开 PR | 6 周项目里还要提很多次 PR，推荐尽快走通 |
| C. Fork + PR | 注册后 fork 到自己名下，push 到 fork，向原仓库发 PR | owner 不方便给权限时 |

### 8.3 要上报的团队问题（不是我个人环境问题）

TEAM.md §5.2 与 COLLAB.md 防线 2/4 整套机制建立在「每人能开 PR、CI 必跑」上，但 W1 的**成员仓库权限发放**在任务表里没有责任人（W1 只有 BE-B 的「仓库脚手架」一项）。FE-A 现在的状态是：产出物已就绪，但没有账号 → 无法提 PR → DoD 第 3/4 条（PR 范围、Reviewer 三查）无法履行。建议在站会/评审会上把「5 人 GitHub 权限 + 提交身份 + 认证方式」补为 W1 的显式任务并指派给 BE-B，否则 W2 的「对接真实 API」会卡在同一个地方。

另：`shared/`、Mock API、CI、`.nvmrc` 均未落地，加上本条权限问题 —— FE-A 侧 W2 开工前的依赖是 4 项而不是 3 项。

## 9. 2026-11-06 交接包核验（离线交付路径已验证可用）

产物（`fe-a/handoff/`）：`fe-a-api-review.bundle`、`0001-reviews-FE-A-v1.1.patch`、`0002-reviews-W1.patch`、`FE-A-W1-deliverables.zip`、5 份 md 原件。

| 核验 | 命令 | 结果 |
|---|---|---|
| bundle 完整性 | `git bundle verify fe-a-api-review.bundle` | `is okay`，前置提交 `037a9cd`（对方持有即可 fetch） |
| patch 可复现 | 在 `main` 的全新 clone 里 `git am 0001 0002` | 退出码 0，`git ls-tree -r HEAD` 列出 `reviews/fe-a/` 4 个文件 |
| 内容一致性 | `git diff --stat FETCH_HEAD HEAD -- reviews` | 空 → 交接包重建出的分支与本地分支树内容完全相同 |
| 越界检查 | 两个提交的 `--stat` | 只含 `reviews/fe-a/*`，未触碰 `docs/`、`shared/`、`web/`、`server/` |

已知瑕疵：`CONTRACT-NOTES.md` 第 357 行表格有 1 处行尾空格（`git am` 报 trailing whitespace 警告）。纯 Markdown 排版，不影响内容；待 CI 的 markdownlint 上线后随下一次文档提交一并清掉。

## 10. 2026-11-06 下午：认证诊断 + 远端 main 变更（影响重大）

### 10.1 认证为什么没通（三条实测证据）

| 探测 | 命令 | 结果 | 判读 |
|---|---|---|---|
| 凭据是否已存 | `cmdkey /list` 过滤 github | 无条目 | GCM 从未成功拿到 token |
| 是否有 GCM 进程 | `tasklist //FI "IMAGENAME eq git-credential-manager.exe"` | 无 | 授权环节没起来或已退出 |
| git 协议连通 | `git ls-remote --heads https://github.com/givehope488/nutritionist-prototype` | **2.4s 成功**，返回 `refs/heads/main` | 网络对 git 是通的，之前「卡住」不是网络 |

结论：用户在**内置浏览器**登录 GitHub，只是登录了网页会话；GCM 的浏览器授权要回连它自己在本机监听的端口，两者不是同一条链路。所以「我在浏览器登过了」≠「git 能认证」。

我自己的两个操作错误也记在这里（都属于方法缺陷，不是环境问题）：
1. 第一次探测用了 `git push ... 2>&1 | tail -25` —— `tail` 要等 EOF 才输出，导致 10 分钟内我拿到的是空文件，白等；
2. 第二次把命令放进 shell 的 `&` 后台，工具调用一结束子进程就被回收，所以日志空、进程消失，那次探测无效。
正确做法：用工具自带的 run_in_background，并把输出**直接重定向到文件**（不接管道），再轮询文件。

清场：`taskkill //IM git.exe //F` 后复查进程数为 0。

### 10.2 FE-A 身份（读自内置浏览器的 GitHub 会话）

- 用户名 `Aredjdhd`，用户 ID `161108928`；
- 隐藏邮箱 `161108928+Aredjdhd@users.noreply.github.com`；
- 「Keep my email addresses private」**已开启** → 提交署名必须用上面这串 noreply，用真实邮箱会把她私邮写进公开历史；
- 「Block command line pushes that expose my email」**未开启**（所以错了不会被 GitHub 拦，只能靠我自己守）。

### 10.3 远端 main 从 `037a9cd` 变成 `1275782`（我干活期间有人推了新提交）

`git fetch origin` 后看到单条新提交：`docs: 排期压缩为 3 周（TEAM v1.2 裁剪清单+周三集成点）；API v1.1 统一响应包络；新增 CODEOWNERS 与 PR 模板`，改动 5 个文件 +113/-41。

对 FE-A 产出物的实际冲击，以及我做的适配：

| 变更事实 | 对我原判断的影响 | 我改了什么 |
|---|---|---|
| 排期 6 周 → **3 周**，FE-A 里程碑变为「W2 二 对接真实 API」「W2 末 走通建档→推荐」 | 我所有引用 W2-W3 / W4 / W5 的地方全部失效；工期没有缓冲 | API-REVIEW 逐条改引用；CONTRACT-NOTES 依赖表按新里程碑重排 |
| 「换一批」**没有被砍**，仍在我的 W2 末验收里 | B1 依然成立且更急 | 保留 B1，标注新时限 |
| 新增 `.github/CODEOWNERS` | 我原先写的「`web/src/api`、router、session 四处无人认领」**不成立** | 删掉旧结论，改为 C1~C5 五个新问题（占位符未替换 / `web/src/api` 双所有者 / TEAM.md 落兜底与 §5.5 冲突 / `.nvmrc`+`shared`+CI 不存在 / §3 标题仍写「六周排期」） |
| CODEOWNERS 给的我的路径是 `views/profile`、`views/goal`、`views/recommend` | 我原先假设是 `views/onboarding/` | AGENT-PROMPT 与 CONTRACT-NOTES 的「允许修改目录」全部改成真实路径 |
| 新增 `.github/PULL_REQUEST_TEMPLATE.md`（含 AI Agent 使用声明五项必勾） | 我的 PR.md 格式不合规模板 | PR.md 整篇按官方模板五段重写 |
| §3.4 裁剪：LLM 层 / 管理端 UI / 100 道数据 / 压测 / 埋点看板 / 30 人灰度 全部后移 | 我的 G4「埋点无契约」范围缩小为「确认 `insights/summary` 是否就是那条采纳率接口」 | G4 重写；CONTRACT-NOTES 里 `engine` 说明改为「首版实际恒为 template」 |
| §3.4 声明 CI 三件套 / smoke / 接口冻结 / 三查 为**不可砍项** | 我 PR 里「CI 跑不了」不能算我自评通过 | 自检五项如实标成「无法执行」而非「通过」，并 @ BE-B |
| §4.4「延期 >2 天当天亮红」 | 给了我上报依赖缺失的正确姿势 | PR.md 末尾按亮红格式写了 W2 依赖告警 |

`docs/API.md` 本次只加了 2 行（§3 管理端：3 周计划无 UI，改由 `scripts/dish-admin.mjs` CLI 调用），**契约字段一个没动** → 我的 B/Y/G 各条结论与字段引用不受影响，无需重做评审。

### 10.4 分支需要 rebase（尚未推送，重写历史零风险）

我的 `feat/fe-a-api-review-w1` 基于 `037a9cd`，`origin/main` 已在 `1275782`。未推送，故 rebase 安全；推送前必须 rebase，否则 PR diff 会把别人的新提交算进来。

### 10.5 待办（本轮未完成）

- 认证仍未打通 → 需重新尝试（改用 run_in_background + 实时日志文件）；
- 三个 commit 的作者署名仍是占位 `FE-A <fe-a@users.noreply.github.com>`，应改为 `Aredjdhd <161108928+Aredjdhd@users.noreply.github.com>`；
- push 与开 PR 仍未执行。
