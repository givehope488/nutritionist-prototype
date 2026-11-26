/**
 * 无 Docker 兜底：单进程 Node 静态站 + /api 反向代理。
 *
 * 行为与 `deploy/nginx.conf` 对齐（W3-C1）：
 *   - `web/dist` 静态资源 + SPA 回落
 *   - `/api/*` 与 `/healthz` 反代到本机后端（默认 127.0.0.1:8787）
 *   - 同源部署，不需要 CORS
 *
 * 用途：没有 Docker / 云主机时，在能跑 Node 22+ 的机器上直接把内测版发给同学。
 * 生产优先仍用 docker compose；本脚本是等价的单机最小实现。
 *
 * 用法：
 *   npm run build -w web          # 产物进 web/dist
 *   npm run seed                  # 首次/重建数据
 *   npm start                     # 后端 :8787
 *   npm run serve:prod            # 前端 + 反代 :8080
 *
 * 环境变量：WEB_PORT（默认 8080）、HOST（默认 0.0.0.0）、API_ORIGIN（默认 http://127.0.0.1:8787）。
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST_ROOT = resolve(fileURLToPath(new URL('../web/dist/', import.meta.url)));
const PORT = Number(process.env.WEB_PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const API_ORIGIN = new URL(process.env.API_ORIGIN ?? 'http://127.0.0.1:8787');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  });
  res.end(payload);
}

function proxy(req, res) {
  const upstream = httpRequest(
    {
      protocol: API_ORIGIN.protocol,
      hostname: API_ORIGIN.hostname,
      port: API_ORIGIN.port || 80,
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        host: API_ORIGIN.host,
        'x-forwarded-for': req.socket.remoteAddress ?? '',
        'x-forwarded-proto': 'http',
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );

  upstream.on('error', (error) => {
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    sendJson(res, 502, {
      error: { code: 'INTERNAL', message: `后端暂不可用：${error.message}` },
    });
  });

  req.pipe(upstream);
}

function resolveStatic(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = normalize(decoded).replace(/^([/\\])+/, '');
  const target = resolve(join(DIST_ROOT, relative));
  if (target !== DIST_ROOT && !target.startsWith(DIST_ROOT + sep)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  // 带扩展名却找不到 → 真 404；否则交给 SPA 回落
  if (extname(decoded) !== '') return null;
  return join(DIST_ROOT, 'index.html');
}

const server = createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

  if (pathname === '/healthz' || pathname.startsWith('/api/')) {
    proxy(req, res);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: { code: 'VALIDATION_ERROR', message: '只支持 GET / HEAD' } });
    return;
  }

  const file = resolveStatic(pathname);
  if (file === null || !existsSync(file)) {
    sendJson(res, 404, { error: { code: 'NOT_FOUND', message: '页面不存在' } });
    return;
  }

  const isAsset = pathname.startsWith('/assets/');
  res.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`[serve-prod] http://${HOST}:${PORT}  (api → ${API_ORIGIN.origin})`);
});