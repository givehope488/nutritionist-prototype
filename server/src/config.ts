import type { TextEngine } from '@canteen/shared';

const textEngine: TextEngine = process.env.TEXT_ENGINE === 'llm' ? 'llm' : 'template';

export const config = {
  port: Number(process.env.PORT ?? 8787),
  /**
   * 3 周计划内固定 template（TEAM.md §3.4：LLM 层整体后移）。
   * 切换只改环境变量，代码不改（ARCHITECTURE.md §4.3）。
   */
  textEngine,
  /** 管理端 X-Admin-Token，未配置时管理端接口一律 401 */
  adminToken: process.env.ADMIN_TOKEN ?? '',
} as const;
