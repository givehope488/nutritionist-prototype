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

## 11. 2026-11-06 傍晚：认证打通 + 署名修正 + 分支已推送（纠正 §8 与 §10.5）

结论先说：**§10.5 的三条待办全部完成，分支已在远端**。开 PR 这一步由 FE-A 本人点，不由 Agent 执行。

### 11.1 认证：device 授权流走通

10.1 里两次失败的原因已确认（管道 `tail` 等 EOF、工具调用外的 `&` 子进程被回收）。本轮按纠正后的做法：GCM 强制 device 模式发起，日志直接落文件，再用内置浏览器输验证码。

```
GCM_AUTHMODE=device git push --dry-run -u origin feat/fe-a-api-review-w1
  → 输出：To authenticate, visit: https://github.com/login/device
          和一次性代码 707C-BB63
浏览器：填入 707C-BB63 → 授权页 snapshot 显示已跳 /login/device/success
```

推送后凭据确实已持久化（此前 §8 记录「无已存凭据」，现已改变）：

```
MSYS2_ARG_CONV_EXCL='*' cmdkey /list
  → 目标: LegacyGeneric:target=git:https://github.com
     类型: 普通 / 用户: Aredjdhd
```

注意：`cmdkey /list` 在 Git Bash 里必须加 `MSYS2_ARG_CONV_EXCL='*'`，否则 `/list` 被 MSYS 当路径转换成 `C:/Program Files/Git/list`，cmdkey 只回一句「命令行参数不正确」——我第一轮就被这个假象骗过，误判成「凭据列表为空」。输出还带 GBK 编码，需要 `iconv -f GBK -t UTF-8` 才能看清中文。

### 11.2 修正 §8 的结论：不是「没有写权限」，是「没有凭据」

§8 当时的判断是「本机无 GitHub 账号 → 需要 owner 授予 collaborator 后才能推」。实测结果是：**`Aredjdhd` 这个账号对该仓库本来就有写权限**，`git push` 一次成功、未被 403 拦。也就是说 W1 卡了半天的真正缺口只是本机缺凭据，不涉及授权流程。被纠正的原条目：§8（起因段与结论段）、§10.5 第三条。

另外，认证打通后先用 `git push --dry-run` 验了一次（exit=0，输出 `Would set upstream ... * [new branch]`）再真推——dry-run 不写数据，能在真正动手前把「凭据是否可用 + 远端是否可达 + ref 是否新建」三件事确认掉。这个顺序值得保留为惯例。

### 11.3 rebase + 署名重写（§10.4 / §10.5 第二条）

rebase 前 `git rebase origin/main` 因无 git 身份失败并留下中断的 rebase，`git rebase --abort` 后确认 4 个 commit 完好（HEAD 仍 `bf8db48` 链）。补齐身份变量后一条命令同时完成 rebase 与作者重写：

```
export GIT_COMMITTER_NAME=Aredjdhd
export GIT_COMMITTER_EMAIL=161108928+Aredjdhd@users.noreply.github.com
MSYS2_ARG_CONV_EXCL='*' git rebase origin/main --exec \
  'git commit --amend --no-edit --author="Aredjdhd <161108928+Aredjdhd@users.noreply.github.com>"'
```

`--author=` 必须包在 `MSYS2_ARG_CONV_EXCL='*'` 里，不然等号和尖括号会被 shell/MSYS 拆坏。署名统一用 noreply 那串（10.2：账号开了「Keep my email addresses private」，用真实邮箱会把私邮写进公开历史）。

### 11.4 推送与远端核验

```
git push -u origin feat/fe-a-api-review-w1
  → remote: Create a pull request ... /pull/new/feat/fe-a-api-review-w1
    To https://github.com/givehope488/nutritionist-prototype.git
     * [new branch]      feat/fe-a-api-review-w1 -> feat/fe-a-api-review-w1
    push_exit=0
```

核验（不信本地状态，重新 fetch 一遍再比对）：

```
git ls-remote --heads origin
  → bf8db484a848e5ef8c7ca5431e18412c009d6381  refs/heads/feat/fe-a-api-review-w1
    127578242ddf95b92e0dd07d36cd2c35401ca83c  refs/heads/main

git fetch origin '+refs/heads/*:refs/remotes/origin/*'
    注：git fetch origin <branch> 只写 FETCH_HEAD，不建 origin/<branch> 跟踪引用，
        所以直接用 origin/feat/... 会报 unknown revision。要用完整 refspec 或配好的 fetch。

git log --format='%h | %an <%ae> | %s' origin/feat/fe-a-api-review-w1 ^origin/main
  → bf8db48 / ab5f020 / f211c91 / c4e73a6，四条全部 Aredjdhd <161108928+...@noreply>

git diff --stat origin/main origin/feat/fe-a-api-review-w1
  → reviews/fe-a/{AGENT-PROMPT,API-REVIEW,CONTRACT-NOTES,WORKLOG}.md
    4 files changed, 681 insertions(+)   无删除、无越界文件
```

即：远端分支恰好在 `origin/main` 之上多 4 个 commit，且**只动 `reviews/fe-a/`**，符合 COLLAB 防线 2 的所有权规则。本节追加后 commit 数会变（+1），以 `git log origin/feat/fe-a-api-review-w1 ^origin/main` 实查为准。

### 11.5 仍未验证 / 仍未做

- **PR 未开**：按约定这一步由 FE-A 本人在浏览器点 `/pull/new/feat/fe-a-api-review-w1`，描述用 `fe-a/PR.md`（工作区草稿，不在仓库内）。PR 一旦创建，Reviewer 三查才算真的走起来；
- **CI 三件套依然不存在**（`.github/workflows/` 无文件、无 `package.json`、无 `shared/`），所以 PR 自检五项里 lint/typecheck/test 仍是「无法执行」，这条不因推送成功而改变；
- **`cmdkey` 里的 token 内容我没有读取**（只确认条目存在与所属用户），token 有效期与 scope 未查——若后续推送突然 403，先分清是 token 过期还是权限被改；
- Desktop 上的 `FE-A-W1-deliverables.zip` 与 `fe-a/handoff/` 现在只是冗余备份：远端已有分支，交接包不再必需。若 BE-B 需要离线包，可再 `git format-patch` 一次（注意：本地 commit 已重写，旧 patch 序列与新 HEAD 哈希不一致，用旧包 `git am` 仍能复现内容，但 commit 号对不上）。
- 本轮**没有推送 `main`**，也没有动任何人的文件。

### 11.6 交接包重做并验证（纠正 §11.5 第四条）

推送成功后，`fe-a/handoff/` 与 Desktop 的 `FE-A-W1-deliverables.zip` 里还是 rebase/改署名**之前**的 4 条 patch 和旧文档，属于会误导人的过期副本。已重建并核验：

```
git format-patch origin/main..HEAD -o fe-a/handoff/     → 5 条（0001..0005）
git bundle create fe-a-api-review.bundle feat/fe-a-api-review-w1
  → bundle verify: tip 0c23c76…, "records a complete history", is okay
    注：--branches=feat/fe-a-api-review-w1 这个写法会得到空 bundle 并被拒绝，
        直接把分支名作为参数传即可。
cp nutritionist-prototype/reviews/fe-a/*.md fe-a/handoff/   → 顶层文档副本同步为最新版
Compress-Archive → Desktop/FE-A-W1-deliverables.zip（15 项，181,563 B）
    注：Git Bash 里没有 zip 命令，用 powershell Compress-Archive；
        校验清单用 System.IO.Compression.ZipFile 读，才能看到每项字节数。
```

**离线复现验证**（这条决定交接包能不能给 BE-B 用）：在临时克隆里 checkout `1275782`，按序 `git am` 五条 patch，然后比对内容 ——

```
git diff --stat HEAD 0c23c76 -- reviews/fe-a   → 空输出
```

即 5 条 patch 应用后的文件内容与远端分支**逐字节一致**；commit 号不同（`4584d8e` 等）是 `git am` 重新签名所致，属预期，不影响内容。这也把 §11.5 里那句「用旧包仍能复现内容但 commit 号对不上」的顾虑消掉了：现在包就是新的，patch 序列、bundle、zip 三者都对应 `0c23c76`。

未验证的一点：patch 应用时 `0001` 报了一条 `warning: 1 line adds whitespace errors`（表格行尾空格），是风格提示不是错误，我没有为了消警告去改文档内容。

补一句避免以后对不上号：上面记录的 `5 条 patch` / `tip 0c23c76` 是**本节写入前**的状态。按 §6 的追加规则，本节自己 commit 之后 tip 前移、patch 条数 +1，这是必然的，不代表包坏了 —— 任何时候想让离线包对齐远端，重跑本节开头的三条命令（format-patch / bundle / Compress-Archive）即可，判据始终是末尾那条 `git diff --stat HEAD <新tip> -- reviews/fe-a` 输出为空。

## 12. 2026-11-06 晚：PR #1 已创建（改用 REST API 而非浏览器点按钮）

FE-A 明确授权「直接提交，一步到位」，于是本节把开 PR 这一步也做了。**结果：`pull/1` 已创建。**
<https://github.com/givehope488/nutritionist-prototype/pull/1>

### 12.1 先验证「能不能」，再选「用哪条路」

浏览器路由内置浏览器实测过：compare 页 `<meta name="user-login">` = `Aredjdhd`，标题栏默认值 `Feat/fe a api review w1`，`#pull_request_body` 已被仓库的 `.github/PULL_REQUEST_TEMPLATE.md` 预填（728 字符、5 个 `##` 段，自检五项和 Agent 声明三项都是 `- [ ]` 空勾；我的正文按同一顺序扩到 9 段）。这条路可行，但要靠 snapshot 拿 uid 再逐字输入 103 行中文，中间任何一次 React 受控状态没同步就是静默丢内容 —— 对「描述里全是阻塞项编号」的评审 PR 来说风险不值。

改走 REST：本机没有 `gh` CLI，但 git 里已存着 §11 那次 device 授权拿到的 token，可以直接调 API。动手前三条只读探测（`/tmp/prcheck.sh`）：

```
GET /repos/givehope488/nutritionist-prototype/pulls   → http=200, open_pr_count=0   （确认没有重复 PR）
GET /rate_limit                                       → http=200, X-OAuth-Scopes: gist, repo, workflow
token: 长度 40，前缀 gho_（device-flow OAuth token；我只读长度和前 4 位，没有打印全文）
```

`repo` 在 scope 里 → 建 PR 的权限成立。探测全程只读，没有为了「试试看」而写数据。

### 12.2 描述正文的生成与两处人工改动

正文不是我手打的字符串，而是从本地 `fe-a/PR.md` 剥掉前 9 行元信息（`# PR 描述…` / `标题：…` / `分支：…` / 入口链接 / `---`）后取剩余部分，前面补一行分支与 tip 的上下文，再由 perl 组装成 JSON（`/tmp/mkpayload.pl`）。这么做的原因是 4700 字符的中文塞进 shell 命令行一定会踩引号/编码，写成文件再 `--data-binary @file` 是唯一稳的路径。

提交前改了 PR.md 一处：模板的自检五项原本是 `- [ ]`，我先前为了「亮红」把它们标成了 `- [x]` + 「无法执行」—— 这等于勾了一个没跑过的检查，属于给 Reviewer 递假信号。已改回 `- [ ]` 并保留「无法执行」文字说明。最终正文里 8 个复选框的状态是：3 个未勾（lint / typecheck / test，仓库无 CI）、5 个已勾（目录未越界、无接口变更、Agent 三条声明，这五项我确实逐条验过）。

踩的坑记一条，免得下次再浪费三轮：校验 payload 时我对 `decode_json` 的结果又做了一次 `Encode::decode('UTF-8',…)`，perl 直接 `Wide character at line 5` 死掉。`decode_json` 传字节进去**出来的已经是字符字符串**，不需要再 decode；反过来 `JSON::PP->new->encode` 默认输出字节流，所以组装时用 `encode('UTF-8', …)` 写文件那一步是对的 —— 我用 `od -An -tx1` 看了首字节（`e5 88 86 e6 94 af` = 「分支」）确认没有双重编码，才敢 POST。

### 12.3 提交与回读校验

```
POST /repos/givehope488/nutritionist-prototype/pulls   → http=201
  number #1  state=open  draft=no  base=main  head=givehope488:feat/fe-a-api-review-w1
  commits=6  +792 / -0   files=4   created=2026-11-06T05:02:10Z  user=Aredjdhd

GET /pulls/1（回读） → body identical: YES / title identical: YES / body_chars=4702
```

`commits=6 +792/-0 files=4` 与 §11.4 本地算出的 diff 完全吻合 → 远端算出来的东西和我以为推上去的东西一致，这才是「推送成功」的终判据（不是看 push 那行回显）。

### 12.4 顺带证实了 C1：CODEOWNERS 的占位符没生效

回读里 `requested_reviewers` 是**空数组** —— 一个 Reviewer 都没被自动请求。原因当场查清：

```
MSYS2_ARG_CONV_EXCL='*' git show origin/main:.github/CODEOWNERS | head -30
  → 「# 用法：把下面的 @占位符 替换成各成员的 GitHub 用户名。」
    *  @be-b   /docs/API.md  @be-a   /web/src/views/profile/  @fe-a   …
```

`@be-b / @fe-a / @fe-b / @be-a / @pd` 全是字面占位符，GitHub 解析不到真实账号（我的真实用户名是 `Aredjdhd`，全文出现 0 次）。所以评审单里 C1 从「格式问题」升级为**已被事实证明的失效项**：平台强制所有权这条防线目前是空的，COLLAB 防线 2 仍只能靠人眼。→ 本 PR 不会自动通知任何人，**要 @ 群里那四位（或让 owner 直接看）才有人来评审**；这一步归 FE-A 本人，我没有替我在群里发消息。

### 12.5 遗留

- 我没往 PR 里加 comment、没 @ 任何人、没设 Reviewer、没点 merge —— 这些超出「开 PR」的授权范围，等 FE-A 指示；
- `mergeable_state=unknown` 是 GitHub 刚建完还没算完 merge 状态，不是冲突；无 CI 所以也不会有 check 结果；
- 本节 commit 会作为第 7 个 commit 进入 pull/1（PR 跟着分支自动更新，这是 §11.6 那条 tip 漂移说明的具体样子）；
- Desktop 的 zip 与 `fe-a/handoff/` 本节写完后再刷新一次，判据同 §11.6。

## 13. 2026-11-06 晚：PR 描述里自己踩的「写死数字」坑 + PATCH 修正

§12 的 commit 推上去之后，`pull/1` 变成 7 个 commit，而**我提交进 PR 正文第一行写的是「tip `c8eb3a4`，6 个 commit，+792 行」** —— 描述当场过期，是我自己一分钟前刚在 §11.6 提醒过的那个毛病（绝对值会随追加节漂移）。整份评审单都在讲契约要可核对，结果自己的 PR 头一句就核不上，这是真错，不是巧合。

修法不是把数字改成 7 —— 那只会再过期一次。改成不随时间失效的**判据**：

> commit 数与 tip 不写死；判据恒为一条 —— `git diff --stat origin/main..feat/fe-a-api-review-w1` 只含 `reviews/fe-a/` 4 个文档、只有新增行、无删除、无越界文件。

```
perl /tmp/mkpayload.pl（正文从 PR.md 的 `---` 之后取，头一行换成上面这句）
  → payload_bytes=8685 body_chars=4811 lines=103 has_FFFFD=no
PATCH /repos/givehope488/nutritionist-prototype/pulls/1   → patch_http=200
GET  /pulls/1（回读）                                    → body identical: YES
  state=open draft=0 commits=7 +850/-0 files=4 requested_reviewers=0
  mergeable_state=blocked   updated=2026-11-06T05:04:33Z
```

标题、base/head、正文其余 9 段一字未动（`body identical` 是拿提交前的 JSON 与回读的 JSON 直接字符串比较，不是我目测）。

### 13.1 新观测：`mergeable_state=blocked` 且 `requested_reviewers=0`

两条一起看才有意义，且它们互证 §12.4 的结论：仓库对 PR 有合并前置要求（所以是 `blocked` 而不是 `clean`/`behind`），但 GitHub **一个 Reviewer 都没请求到**，因为 CODEOWNERS 里 `@be-a/@fe-a/@fe-b/@be-b/@pd` 是字面占位符、解析不到真实账号。也就是说 C1 不替换的后果不只是「规范不好看」，而是**这个 PR 在平台上永远处于「等一个等不到的必需评审」状态**。

需要说清的边界：`blocked` 的具体触发项（是 branch protection 的 required review，还是 code-owner 规则，还是 required status check）我没有权限查 —— `GET /repos/.../branches/main/protection` 需要 admin 权限，owner 是 `givehope488`。所以「blocked 由 CODEOWNERS 占位符导致」是**推断**（依据是 0 个 reviewer 被请求 + 文件内容确实是占位符），不是实测；请 BE-B 或 owner 用一条命令定性：

```
curl -s -H "Authorization: Bearer <owner token>" \
  https://api.github.com/repos/givehope488/nutritionist-prototype/branches/main/protection
```

### 13.2 我这轮做的写操作清单（可核对，无遗漏）

| # | 操作 | 对象 | 结果 |
|---|---|---|---|
| 1 | `git push` ×3 | `refs/heads/feat/fe-a-api-review-w1` | 200，tip 现 `4ca45b7`→本节 commit 后前移 |
| 2 | `POST /pulls` | 新建 `pull/1` | 201 |
| 3 | `PATCH /pulls/1` | 改 `pull/1` 正文首行 | 200 |

**没有做过**：merge、加 comment、@ 任何人、设 Reviewer、加 label、动 `main`、动别人目录。授权范围是「开 PR」，我没有把它扩张成「替团队走完评审」。

### 13.3 交接包最终对齐

7 条 patch（现随本节 +1）、bundle（tip 与远端一致，`bundle verify` okay）、Desktop zip 重新打包；离线复现判据同 §11.6，即临时克隆 checkout `1275782` 后 `git am` 全序列，`git diff --stat HEAD <远端tip> -- reviews/fe-a` 输出为空。

### 13.4 更正 §13.1 的 `mergeable_state`（新增于同晚，写完后复查发现的）

push 本节之后的同一次回读里，`mergeable_state` 从 `blocked` 变成了 `unknown` —— GitHub 每次新 commit 都会重算 merge 状态，`unknown` 就是「还在算」。所以 §13.1 里那句「是 `blocked` 而不是 `clean`/`behind`，说明仓库有合并前置要求」**证据强度被我写高了**：那只是一个瞬时值，不能当结论用。

真正站得住的只有一条，而且它不随重算变化：`requested_reviewers = 0`，而 CODEOWNERS 内容确实是 `@be-a/@fe-a/…` 字面占位符（`git show origin/main:.github/CODEOWNERS` 可复现）。C1 的判断据此成立，无需依赖 `mergeable_state`。查 branch protection 的那条 curl 仍然要做，但它的目的从「证实 blocked」降为「查清合并前置到底是哪一条」。

顺手把这条也立成规矩：**只观测到一次的瞬时字段值，要写就写明时间戳和「未复查」**，别让它长成结论。本轮最终核验值：PR #1 open、8 commits、+894/−0、4 files、head `d5fa8ed`、回读 body 与我提交的 JSON 逐字一致；本地 `git status --porcelain` 为空。

## 14. 2026-11-06 晚·第二次复核：main 前移到 `496c1ef`，四份文档按新事实重写，走新分支 + 新 PR

§13 之后 main 在几小时内被四个 PR 前移了。我评审单里「当时是对的」的句子现在有好几句是错的。处理方式与 §13 一致：不删旧文，本节逐条更正 + 交付新版本。

### 14.1 远端前移事实（REST 读回 + 本地 git 验证，CST = UTC+8）

```
git log --oneline 1275782..origin/main
496c1ef 数据: 种子 v2 拆分份量字段 + 修正肉类标签 + 数据体检与复核底稿 (#4)
552068b docs: 新增防线 7「合并门禁」，标明管理员豁免与平台限制 (#3)
7f5f6a9 reviews: FE-A 接口协定 v1.1 前端侧评审（3 条阻塞项待结论）(#1)
863dba0 chore: 仓库脚手架 + shared 契约包 + CI 三件套（W1 地基）(#2)
```

API 读回的合并时间线（`GET /pulls?state=all` + `GET /pulls/1` + `GET /pulls/1/reviews`）：

| 时间 (CST) | 事件 |
|---|---|
| 13:27 | PD（givehope488）在 pull/1 上留 COMMENTED review（无行内评论，review_comments=0） |
| 13:44:45 | PR #2（脚手架 + `@canteen/shared` + CI）合并 → `863dba0` |
| 13:44:55 | PD 对 pull/1 点 **APPROVED** |
| 13:45:10 | PR #1 合并（`merged_by=givehope488` 管理员合并）→ squash commit `7f5f6a9` |
| 14:06:41 | PR #3（防线 7 合并门禁）合并 → `552068b` |
| 14:45:01 | PR #4（种子 v2）合并 → `496c1ef` |

pull/1 合并时最终形态（读回）：`state=closed merged=1`、`commits=9`、`+902/-0`、`files=4`、`comments=0`、`review_comments=0`；reviews 共 2 条，都在 head `9fb392b` 上。CODEOWNERS 实名化由 PR #2 完成（`git log origin/main -- .github/CODEOWNERS`：`863dba0` 与 `1275782` 两个 commit），现文件里用户名 = `pigQAQ / yangelect / Aredjdhd / wyf-111 / givehope488`，且新增 `/reviews/ @givehope488`（我改评审文档需 PD 批准）与 `/docs/TEAM.md @givehope488`。

### 14.2 更正我自己的两处旧记录

1. §13.4 及更早写的「review_count=0、一个 Reviewer 都没被请求」**作废**。那是我建 PR 后一小时内的瞬时值。合并时点的事实是：`requested_reviewers=0` 依然成立（CODEOWNERS 当时确实是占位符、平台防线没生效），但 PD 人工走了评审（COMMENTED → APPROVED），PR 是靠**人**合进去的，不是靠平台防线。旧句子按 §13.4 立的规矩处理：只观测到一次的瞬时值不能当结论，本节读回值为准。
2. 「合并前没有任何 CI 检查」成立，但要补时序才有意义：CI 是 13:44:45（PR #2）才落地的，我的 PR 13:45:10 就被 owner 合并，head `9fb392b` 的 `check_runs=0`。**即我的 PR 是在防线 7 出现之前、以「无前置 CI」的形态被管理员合入的**——按现在的门禁（CI 先绿 + 1 人批准 + 不能自批）这套动作不再合法。合并动作是 owner 做的，我只记录事实。squash commit `7f5f6a9` 在合并后 13:45:12 补跑了一次 ci → success（run 42170263227），所以「我的内容在 CI 上全绿」成立，但它是**事后**绿的。

### 14.3 结案与仍开（与 API-REVIEW.md「复核增补」同口径，这里只留编号）

- 结案：C1（CODEOWNERS 实名）、C3（`docs/TEAM.md` 归 PD）、C5（TEAM.md §3 标题实测已是「三周排期」）。
- 半结：C4（`shared/` + CI + `.nvmrc` 就绪；`web/` 目录、`VITE_API_BASE`、smoke/e2e/seed 仍缺）。
- 仍开：B1/B2/B3、Y1/Y2/Y3/Y4/Y5/Y6/Y7、G1/G2/G3/G4、C2——逐条处置状态见 API-REVIEW.md，不在这里复制。
- 新上报 F1~F4（代码先行、契约未跟，均是硬事实非推测）：
  - **F1**：API.md v1.1 §2.3 示例的忌口 key `vegan` 在实现里不存在，实测素食 key 是 `nomeat`。前端照契约写会拿 400。
  - **F2**：API.md v1.1 示例 `"portion_label": "200g"`，而 `server/test/app.test.ts:107` 断言份量标签**不得**匹配克重正则，种子 v2 实测全是「1 份/1 个/半份」类。契约与代码互斥，需 BE-A 定稿。
  - **F3**：COLLAB 防线 3/4 + DoD 第 1 条要求的 smoke/e2e/seed 脚本在根 scripts 里不存在（实测只有 `lint/typecheck/test/check:data/dev/start`）。
  - **F4**：防线 7 的三个直接后果——`/reviews/` 归 PD、main 禁强推（本复核必须走新分支+新 PR）、Free 计划转 private 会丢全部分支保护。

### 14.4 本地实跑记录（本机 Node 26，CI 侧 Node 22）

```
node -v            → v26.13.0
npm run lint       → lint_exit=0
npm run typecheck  → tc_exit=0
npm run test       → test_exit=0
npm run check:data → checkdata_exit=0
```

（`/tmp/trio.out` 原样输出。根 `package.json` `engines.node >=22`、`.nvmrc`=22，CI 用 `node-version-file`。本机只装了 26，22 侧证据来自 CI：`GET commits/496c1ef/check-runs` → `lint/typecheck/test` 三个 job 全 `success`。两端无版本分歧，但「22 本机实测」这句我**没有**做过，不写。）

真实服务端起服与收口（端口 8787，为把 400 包络落文件，本节又起了一次；与 §8 第一次结果一致）：

```
npm run start -w @canteen/server   （tsx src/index.ts；log：[server] http://localhost:8787 (text_engine=template)）
GET /api/v1/menu?meal=lunch  → 200  dishes=41  avoid_options=8   （/tmp/menu_lunch.json，10971 字节）
GET /api/v1/menu?meal=brunch → 400
  {"error":{"code":"VALIDATION_ERROR","message":"meal 取值须为 breakfast / lunch / dinner","fields":[{"path":"meal","issue":"取值非法"}]}}
GET /healthz → 200
收口：netstat 找 LISTENING PID（76660）→ taskkill //F //PID → 端口释放。
```

（taskkill 后 npm 包装进程退出码非 0，是「被杀死」的预期表现，不是服务错误；`server.log` 里那段 `npm error Lifecycle script` 同理，属收口痕迹。）

### 14.5 本次交付方式

- 分支 `feat/fe-a-review-update-w1`：从 `origin/main`（`496c1ef`）切出；切出后先验证 `git diff --stat origin/main -- reviews/fe-a` 为空（main 上我的内容是 PR #1 的 squash 结果，逐字节一致），再开始改。
- 改动四份文档：API-REVIEW.md（v1.3 复核增补）、CONTRACT-NOTES.md（§5 依赖表重写 + §5.1 实测样本）、AGENT-PROMPT.md（`@canteen/shared` 订正 + 铁律 4 防线 7 + 忌口 key 禁止项）、WORKLOG.md（本节）。
- 因 main 禁强推 + `/reviews/` 归 PD，交付必须走新 PR；PR 创建与回读校验记录在本节之后的续节。

### 14.6 新 PR 创建与回读校验（PR #5）

```
POST /repos/givehope488/nutritionist-prototype/pulls   → create_http=201
  number=5  state=open  draft=no  base=main  head=feat/fe-a-review-update-w1 (51d4cd9)
  commits=1  +181/-29  files=4
GET /pulls/5（回读）：
  body 与我提交的 JSON 逐字节一致（orig_bytes=got_bytes=5251，脚本 vrfy5c.pl）  YES
  title identical  YES
  requested_reviewers = givehope488
```

`requested_reviewers = givehope488` 是本节最有价值的一条：**CODEOWNERS 实名化（C1）在平台层面第一次真正生效**——PR #1 时是空数组（占位符解析不到人），现在 `/reviews/` 自动请求到了 PD。防线 2 从「靠人记」恢复为「平台强制」，C1 结案的证据链闭合。

CI：head `51d4cd9` 的 check-runs=3，`lint / test / typecheck` 全部 `success`（Node 22）——这次是**合并前**绿的，与 §14.2 记录的上一单「事后补绿」形成对照。

两处回读校验中的小插曲，按老规矩记下：第一次比对报 `body_identical=NO`，是我又把「字符串」和「字节串」直接比（`decode_json` 对 body 输出的是字节串），老毛病第三次犯，这次 3 分钟定位。终判据 `vrfy5c.pl` 用字节级比较，结果 YES。以后回读校验一律按「双方都落到字节再比」写脚本。

### 14.7 交接包对齐（沿用 §11.6 / §13.3 的同一判据）

离线复现包按三条命令刷新（format-patch / bundle / Compress-Archive），判据不变：临时克隆 checkout `496c1ef` 后 `git am` 全序列，`git diff --stat HEAD origin/feat/fe-a-review-update-w1 -- reviews/fe-a` 输出为空。包内文件数 = `reviews/fe-a/` 4 份 + 备用 patch 序列，与 PR #5 的 files=4 一致。

## 15. 2026-11-06 深夜·第三次复核：main 前移到 `b29deff`（API v1.2.1 + PROGRESS.md 决议），签字条件达成

§14 交付（PR #5）合并后，main 又在几小时内被 8 个 PR 前移。这轮不是「逐条更正」，是**评审单从「不能签字」变成「可以签字」**。

### 15.1 远端前移事实（REST 读回 + 本地 git 验证）

```
git log --oneline 496c1ef..origin/main
b29deff docs: 进程文档同步今天的两件事 (#14)
ebac571 docs: API v1.2.1 更正 portion_grams 自相矛盾，写死 D4 执行口径 (#13)
7ccd9e5 ci: web 走独立安装，修好 FE-B 分支上一直红的 typecheck/test (#12)
ea3e50a docs: 进程文档删掉一件已由 PD 自己完成的事 (#11)
98fd2f3 文档: 新增公用项目进程文档，并把「谁能改哪节」做成 CI 强制 (#10)
b4a7119 契约: API.md 升 v1.2，文档 / 类型 / 实现三处对齐 (#9)
a8cc920 chore: 补 CODEOWNERS 的 web 目录覆盖，前端代码不再掉进 BE-B 兜底 (#7)
f287c39 reviews: FE-A 二轮复核（按当前 main 重写，上报四处契约与实现不一致）(#5)
```

PR #5 合并事实（读回）：`merged_at=2026-11-06T09:44:48Z`（17:44 CST）、`merged_by=givehope488`、`merge_commit=f287c39`；reviews 1 条：PD **APPROVED**（09:44:36Z，合并前 12 秒）。与 §14.2 记录的上一单（13:45 被 owner 直接合、无 CI 前置）对比：这一单是**先批准后合并**，防线 7 的「1 人批准」实际生效，这是继 CODEOWNERS 自动请求评审之后的第二个平台级证据。

PR #6（FE-B 的 web PR）：state=open，17 commits、66 files、+9467/−0，标题「web: FE-B 组件库 + 回填/反馈/历史闭环」。PROGRESS.md 里写「三项检查已转绿，合并前还差 3 处契约对齐」，与读回一致。

### 15.2 契约与决议的实质变化（这轮的核心）

- **API.md 升 v1.2（PR #9）→ v1.2.1（PR #13）**，定性「一致性修正版，无字段结构变更」：示例 `vegan`→`nomeat`（F1 根治）；份量示例 `200g`→`1 份` + `portion_label` 明文禁克重（F2 根治）；补 `meal`/`status` 枚举（Y7）；新增**附录 D 忌口全表 9 项（含 `nogluten`）**与两条硬约束（`meat` 兜底标签；先改表再改实现，`contract.test.ts` CI 强制）。v1.2.1 钉死 `portion_grams` **一律不下发**（Y5/D4）。
- **`docs/PROGRESS.md` 落地（PR #10）**：§0~§4 只有 PD 能改（`check:progress` 指纹校验，CI 强制）；§5/§6 人人可追加（格式校验）。§4.1 四条决议直接终结我的 B1/B2/B3/Y4：A 换一批不加参数、前端重调一次；B 组合卡按 `category` 渲染、不加 `structure` 字段；C `combo.id` 过期视为自选餐 `adopted:false`；D 素食≠纯素，本项目不做纯素。
- **排期细化**：W0 收尾（11-06~11-08）/ W1（11-09~11-13）/ W2（11-16~11-20）/ W3（11-23~11-27）。我 W1 的交付三件：`client.ts`（解包唯一入口 + 4 个单测：200 直返 / 400 转 error / 非 JSON / 网络异常）、建档页 + 目标页、推荐页（换一批=重新请求、无解展示 notice）。**C2 随之结案：client.ts 主笔 = FE-A。**
- CODEOWNERS 补 web 覆盖（PR #7）：`/web/` 兜底 + `composables/utils/tests` 归双前端共担。CI 改为 web 独立安装（PR #12）。

### 15.3 逐条结案（本节只留编号与结论，细节在 API-REVIEW「二次复核增补」）

- **结案**：B1（§4.1-A）、B2（附录 D + 不做纯素）、B3（§4.1-B）、C2/G3（client.ts 主笔 FE-A + 4 单测）、Y5（D4 + v1.2.1）、Y6（v1.2 明文三类字段不出响应）、Y7（v1.2 补枚举）、F1（vegan→nomeat）、F2（份量示例订正）。
- **部分**：Y3（`nogluten` 已补、空态「放宽引导」归我页面设计；`relax_suggestions` 字段仍待 v1.3）、Y4（过期处置已定；预填交接仍未明文）、C4（web/Mock/VITE 已在 FE-B 分支；smoke/seed 进 BE-B W1；e2e 无人认领）、F3（smoke/seed 已列 W1；e2e 仍无）。
- **仍开**：Y1（`bmi_tag` 值域）、Y2（warnings 结构化）、G2（`totals.price_yuan`）、G4（采纳口径，随 W2）。
- **签字**：FE-A 对 API **v1.2.1** 签字。11-06 早上提出的签字条件（B1/B2/B3 + Y5 + C1）全部由可复现的文档与决议背书达成。

### 15.4 本地实测（Node 26 本机；22 侧以 CI 为准）

```
npm ci                 → exit 0
npm run lint           → exit 0
npm run typecheck      → exit 0
npm run test           → exit 0
npm run check:data     → exit 0
npm run check:progress → exit 0（新增：PROGRESS.md 指纹校验，「✓ docs/PROGRESS.md 体检通过」）
```

真实服务端（v1.2.1 代码，端口 8787）：`GET /api/v1/menu?meal=lunch` → 200，41 道、**9 条 avoid_options**（`nogluten`「不吃麸质（小麦制品）」在列，与附录 D 逐项一致）；`?meal=brunch` → 400 包络与 §14.4 相同；起服/收口流程同前（listener PID 52676，taskkill 后端口释放）。样本已更新进 CONTRACT-NOTES §5.1。

### 15.5 交付方式

- 分支 `feat/fe-a-review-v3`：从 `origin/main`（`b29deff`）切出，`reviews/fe-a/` 与 main 逐字节一致后开始改。
- 改动四份文档：API-REVIEW.md（v1.4 二次复核增补 + 签字条件更新）、CONTRACT-NOTES.md（契约基准改 v1.2.1，§3/§4/§5 重写，§5.1 重抓）、AGENT-PROMPT.md（铁律 3 目录、B1/B3 决议、附录 D、client.ts 4 单测）、WORKLOG.md（本节）。
- 新 PR 创建与回读校验、交接包刷新记录在后续续节。
