# 数据库备份与恢复（W2-D5）

> 面向：PB（运维）/ PD（数据维护）。
> 运行时库是 SQLite 单文件（`server/data/runtime/app.db`），**不入库**（`.gitignore` 已忽略 `*.db`）。

## 1. 备份

```bash
npm run backup                          # 默认写到 server/data/backups/
BACKUP_DIR=D:/backups npm run backup    # 自定义目录（推荐放另一块盘）
BACKUP_KEEP=3 npm run backup            # 只保留最近 3 份（默认 7）
```

输出示例：

```
[backup] ✅ server/data/backups/app-2026-11-21T13-05-02-817Z.db
[backup] 耗时 12 ms，大小 116 KB，dishes=384 profiles=1 meal_logs=1 revisions=0
[backup] 当前保留 1 份（上限 7）
```

### 为什么用 `VACUUM INTO` 而不是 `cp app.db`

直接拷文件时，如果恰好有写事务在跑（或有 `-wal` 未 checkpoint），拷到的是**半写状态**的库，
恢复后可能打不开或数据自相矛盾。`VACUUM INTO` 由 SQLite 自己导出一致性快照，代价是多一次写盘。

备份完成后脚本会**自检**：重新打开备份、`PRAGMA integrity_check`、四张表行数与源库逐项比对——
任一项不一致就以非 0 退出，不会留下「看起来成功、其实坏了」的备份。

### 建议的定时任务

| 环境 | 做法 |
|---|---|
| Linux 服务器 | `crontab -e` 加 `0 3 * * * cd /srv/canteen && BACKUP_DIR=/srv/backups npm run backup` |
| Windows | 任务计划程序，触发器每天 03:00，操作 `npm run backup`，起始目录为项目根 |
| 保留 | 默认 7 份（一周）；有异地需求就把 `BACKUP_DIR` 指向挂载的网络盘或对象存储同步目录 |

## 2. 恢复

```bash
npm run restore -- server/data/backups/app-2026-11-21T13-05-02-817Z.db
npm run restore -- <备份文件> <目标库路径>      # 恢复到别处做比对
```

安全默认（都写进脚本了）：

1. **先校验备份**：打不开 / `integrity_check` 不是 `ok` / 表缺失 → 直接拒绝，不覆盖生产库
2. **覆盖前先备份现库**：`app.db.pre-restore-<时间戳>.db`，恢复错了还能退
3. **恢复后复核**：重新打开目标库做完整性校验与行数比对，与备份不一致则非 0 退出

> 恢复是**停机操作**：先停服务再恢复，否则运行中的进程还握着旧连接。

## 3. 真实恢复演练记录（2026-11-21）

> W2-D5 要求「一次真实恢复演练并记录耗时」。以下是实测数据，全部在本机（Windows / Node 24 / SQLite 3.50.4）跑出。

| 步骤 | 命令 | 结果 |
|---|---|---|
| 建库 | `npm run seed` | 384 道菜写入 |
| 造业务数据 | `npx tsx server/scripts/e2e-flow.ts` | 1 份档案 + 1 条回填记录（`logged_meals=1 adoption_rate=1`） |
| 备份 | `npm run backup` | **12 ms**，116 KB，`dishes=384 profiles=1 meal_logs=1 revisions=0` |
| 模拟事故 | `DELETE FROM meal_logs; DELETE FROM profiles; UPDATE dishes SET kcal = 0` | 业务数据清零、384 道菜营养值全被破坏 |
| 恢复 | `npm run restore -- <备份>` | **5 ms**，恢复后 `dishes=384 profiles=1 meal_logs=1`、`零热量菜=0`、`integrity=ok` |
| 退路 | 自动生成 | `app.db.pre-restore-2026-11-21T13-05-11-029Z.db` |

**结论**：备份 12 ms、恢复 5 ms，数据量与行数完全一致，损坏的营养值被正确回滚；
在 384 道菜 / 百 KB 量级下，停机窗口可以忽略（即使数据量涨到 100 倍，按线性估算也在秒级）。

## 4. 与部署的关系

`docker-compose.yml`（W3-C1）把运行时库挂成 volume：

```yaml
volumes:
  - ./server/data/runtime:/app/server/data/runtime
  - ./backups:/app/backups
```

备份在宿主机上执行（容器内没有 cron），命令不变：

```bash
BACKUP_DIR=./backups npm run backup
```

恢复时先 `docker compose stop server`，恢复完再 `docker compose start server`。
