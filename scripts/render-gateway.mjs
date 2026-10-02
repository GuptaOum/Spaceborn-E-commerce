#!/usr/bin/env node
/**
 * Spaceborn Unified Gateway Runner (Render Free Tier 100% Free Forever)
 *
 * Runs all 4 Spaceborn services (API, Storefront, Vendor Hub, Admin Panel)
 * inside a single Render Web Service container, consuming exactly 1 free instance
 * (720 hrs/month <= 750 free hrs).
 *
 * Routing:
 *  - /v1/*         -> API (port 4000)
 *  - /health       -> API Health (/v1/health on port 4000)
 *  - Subdomain     -> admin.* (port 3002), vendor.* (port 3001), store/default (port 3000)
 *  - Cookie/Query  -> ?app=admin (port 3002), ?app=vendor (port 3001), ?app=store (port 3000)
 *  - Direct switch -> /__switch?app=admin|vendor|store
 *  - Portal page   -> /__portal or /_hub
 */

import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const GATEWAY_PORT = parseInt(process.env.PORT || '10000', 10);
const API_PORT = parseInt(process.env.API_PORT || '4000', 10);
const STORE_PORT = parseInt(process.env.STORE_PORT || '3000', 10);
const VENDOR_PORT = parseInt(process.env.VENDOR_PORT || '3001', 10);
const ADMIN_PORT = parseInt(process.env.ADMIN_PORT || '3002', 10);

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';
const nodeCmd = isWindows ? 'node.exe' : 'node';

const children = [];

function log(prefix, msg) {
  const ts = new Date().toISOString().substring(11, 19);
  console.log(`[${ts}] [${prefix}] ${msg}`);
}

function getMemoryLimit(name) {
  switch (name) {
    case 'api': return '64';
    case 'storefront': return '96';
    case 'vendor': return '72';
    case 'admin': return '72';
    case 'worker': return '48';
    default: return '80';
  }
}

function spawnService(name, command, args, envVars = {}) {
  const defaultMemory = getMemoryLimit(name);
  const nodeOptions = envVars.NODE_OPTIONS || process.env.NODE_OPTIONS || `--max-old-space-size=${defaultMemory}`;
  const childEnv = {
    ...process.env,
    PORT: envVars.PORT,
    HOSTNAME: '0.0.0.0',
    NODE_ENV: process.env.NODE_ENV || 'production',
    PAYMENTS_ALLOW_MOCK: process.env.PAYMENTS_ALLOW_MOCK || 'true',
    UPLOADS_ALLOW_LOCAL: process.env.UPLOADS_ALLOW_LOCAL || 'true',
    DB_POOL_MAX: process.env.DB_POOL_MAX || '5',
    NODE_OPTIONS: nodeOptions,
    API_ORIGIN: `http://127.0.0.1:${API_PORT}`,
    NEXT_PUBLIC_API_URL: `http://127.0.0.1:${API_PORT}`,
    ...envVars,
  };

  log('supervisor', `Starting ${name} on port ${envVars.PORT || 'inherited'}...`);
  const child = spawn(command, args, {
    cwd: ROOT_DIR,
    env: childEnv,
    shell: isWindows,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const serviceObj = {
    name,
    command,
    args,
    envVars,
    process: child,
    status: 'running',
    startedAt: new Date().toISOString(),
    logs: [],
  };

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        log(name, line);
        serviceObj.logs.push(`[${new Date().toISOString().substring(11, 19)}] ${line}`);
        if (serviceObj.logs.length > 50) serviceObj.logs.shift();
      }
    }
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        log(name, `ERR: ${line}`);
        serviceObj.logs.push(`[${new Date().toISOString().substring(11, 19)}] ERR: ${line}`);
        if (serviceObj.logs.length > 50) serviceObj.logs.shift();
      }
    }
  });

  child.on('exit', (code, signal) => {
    serviceObj.status = `exited (${code})`;
    log('supervisor', `${name} exited with code ${code} signal ${signal}`);
  });

  children.push(serviceObj);
  return child;
}

// 1. Run migrations if database credentials exist
async function runMigrationsIfPossible() {
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    log('migrate', 'No DATABASE_URL or DB_HOST found in environment. Skipping auto-migrate.');
    return;
  }

  log('migrate', 'Running database migrations before service start...');
  await new Promise((resolve) => {
    const mig = spawn(nodeCmd, ['services/api/dist/db/migrate.js'], {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production',
        DB_SSL: process.env.DB_SSL || 'require',
      },
      shell: isWindows,
      stdio: 'inherit',
    });

    mig.on('exit', (code) => {
      if (code === 0) {
        log('migrate', 'Database migrations applied successfully.');
      } else {
        log('migrate', `Migration process completed with status code ${code} (proceeding to launch services)`);
      }
      resolve();
    });

    mig.on('error', (err) => {
      log('migrate', `Migration error: ${err.message}`);
      resolve();
    });
  });
}

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

// 2. Gateway HTTP Server
function startGateway() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const host = (req.headers.host || '').toLowerCase();
    const cookies = parseCookies(req.headers.cookie);

    // App switch handler: /__switch?app=admin|vendor|store
    if (url.pathname === '/__switch') {
      const targetApp = url.searchParams.get('app') || 'store';
      res.writeHead(302, {
        'Set-Cookie': `spaceborn_app=${encodeURIComponent(targetApp)}; Path=/; SameSite=Lax`,
        Location: url.searchParams.get('redirect') || '/',
      });
      res.end();
      return;
    }

    // Portal landing page: /__portal or /_hub
    if (url.pathname === '/__portal' || url.pathname === '/_hub') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderPortalHtml(host));
      return;
    }

    // Diagnostics endpoint: /__status
    if (url.pathname === '/__status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        gateway: 'Spaceborn Unified Supervisor',
        version: 'v1.0.5-standalone',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        services: children.map(c => ({
          name: c.name,
          port: c.envVars.PORT,
          status: c.status,
          pid: c.process?.pid,
          recentLogs: c.logs.slice(-10),
        })),
      }, null, 2));
      return;
    }

    // Static asset discovery diagnostic: /__find_static
    if (url.pathname === '/__find_static') {
      const file = url.searchParams.get('file') || '064vepiurk-uz.css';
      const found = [];
      function search(dir, depth = 0) {
        if (depth > 6) return;
        try {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.git')) {
              search(full, depth + 1);
            } else if (entry.name.includes(file) || entry.name.endsWith('.css')) {
              found.push(full);
            }
          }
        } catch {}
      }
      search(ROOT_DIR);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ searchedFor: file, found, rootDir: ROOT_DIR }, null, 2));
      return;
    }

    // Health check endpoint (for Render Blueprint zero-downtime deploy checks)
    if (url.pathname === '/health' || url.pathname === '/v1/health') {
      proxyRequest(req, res, API_PORT);
      return;
    }

    // API Routes: /v1/* always routes to API service
    if (url.pathname.startsWith('/v1/')) {
      proxyRequest(req, res, API_PORT);
      return;
    }

    // Direct Static Assets Serving: /_next/static/*
    if (url.pathname.startsWith('/_next/static/')) {
      const subPath = url.pathname.replace(/^\/_next\/static\//, '');
      const apps = ['customer-storefront', 'vendor-hub', 'admin-panel'];
      for (const a of apps) {
        const fullPath = path.join(ROOT_DIR, 'apps', a, '.next', 'static', subPath);
        if (fs.existsSync(fullPath)) {
          const ext = path.extname(fullPath).toLowerCase();
          const mimeTypes = {
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.webp': 'image/webp',
            '.woff2': 'font/woff2',
            '.woff': 'font/woff',
            '.ttf': 'font/ttf',
          };
          res.writeHead(200, {
            'Content-Type': mimeTypes[ext] || 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000, immutable',
          });
          fs.createReadStream(fullPath).pipe(res);
          return;
        }
      }
    }

    // Referer hint for subresources without explicit query param or cookie
    const referer = req.headers['referer'] || '';
    let refererApp = null;
    if (referer.includes('app=admin') || referer.includes('/admin')) refererApp = 'admin';
    else if (referer.includes('app=vendor') || referer.includes('/vendor')) refererApp = 'vendor';
    else if (referer.includes('app=store')) refererApp = 'store';

    // Query param override: ?app=admin | ?app=vendor | ?app=store
    let appParam = url.searchParams.get('app');
    if (appParam) {
      res.setHeader('Set-Cookie', `spaceborn_app=${encodeURIComponent(appParam)}; Path=/; SameSite=Lax`);
    }

    // Target service resolution:
    // Priority: Query param -> Subdomain -> Path prefix alias -> Cookie -> Referer -> Default (Storefront)
    let targetPort = STORE_PORT;
    const cookieApp = appParam || cookies.spaceborn_app || refererApp;

    if (host.startsWith('admin.') || cookieApp === 'admin') {
      targetPort = ADMIN_PORT;
    } else if (host.startsWith('vendor.') || cookieApp === 'vendor') {
      targetPort = VENDOR_PORT;
    } else if (host.startsWith('api.')) {
      targetPort = API_PORT;
    } else if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
      // Path shortcut: switch to admin
      res.writeHead(302, {
        'Set-Cookie': 'spaceborn_app=admin; Path=/; SameSite=Lax',
        Location: '/',
      });
      res.end();
      return;
    } else if (url.pathname === '/vendor' || url.pathname.startsWith('/vendor/')) {
      // Path shortcut: switch to vendor
      res.writeHead(302, {
        'Set-Cookie': 'spaceborn_app=vendor; Path=/; SameSite=Lax',
        Location: '/',
      });
      res.end();
      return;
    }

    proxyRequest(req, res, targetPort);
  });

  // Support WebSockets (Next.js HMR or persistent connections)
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const host = (req.headers.host || '').toLowerCase();
    const cookies = parseCookies(req.headers.cookie);

    let targetPort = STORE_PORT;
    if (url.pathname.startsWith('/v1/')) {
      targetPort = API_PORT;
    } else if (host.startsWith('admin.') || cookies.spaceborn_app === 'admin') {
      targetPort = ADMIN_PORT;
    } else if (host.startsWith('vendor.') || cookies.spaceborn_app === 'vendor') {
      targetPort = VENDOR_PORT;
    }

    const proxySocket = net.connect(targetPort, '127.0.0.1', () => {
      proxySocket.write(
        `${req.method} ${req.url} HTTP/1.1\r\n` +
          Object.keys(req.headers)
            .map((k) => `${k}: ${req.headers[k]}`)
            .join('\r\n') +
          '\r\n\r\n',
      );
      proxySocket.write(head);
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
    });

    proxySocket.on('error', () => {
      socket.destroy();
    });
  });

  server.listen(GATEWAY_PORT, () => {
    log('gateway', `🚀 Spaceborn Unified Gateway listening on port ${GATEWAY_PORT}`);
    log('gateway', `-> Storefront on :${STORE_PORT} (Default)`);
    log('gateway', `-> Vendor Hub on :${VENDOR_PORT} (Cookie/Switch/Subdomain)`);
    log('gateway', `-> Admin Panel on :${ADMIN_PORT} (Cookie/Switch/Subdomain)`);
    log('gateway', `-> API on :${API_PORT} (/v1/*)`);
    log('gateway', `-> Outbox worker (no port; polls the database)`);
    log('gateway', `-> Hub & Navigation at /__portal`);
  });
}

function proxyRequest(req, res, targetPort) {
  const reqHeaders = { ...req.headers };
  // Disable internal gzip compression so HTML banner injection does not corrupt zlib stream
  delete reqHeaders['accept-encoding'];

  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: {
      ...reqHeaders,
      host: `127.0.0.1:${targetPort}`,
      'x-forwarded-for': req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'http',
      'x-forwarded-host': req.headers.host || '',
    },
  };

  const proxy = http.request(options, (targetRes) => {
    const isHtml = (targetRes.headers['content-type'] || '').includes('text/html');
    const showBanner = process.env.SHOW_DEMO_BANNER !== 'false' && isHtml && targetRes.statusCode === 200;

    // Direct streaming if not HTML or banner disabled
    if (!showBanner) {
      res.writeHead(targetRes.statusCode, targetRes.headers);
      targetRes.pipe(res);
      return;
    }

    // Floating Demo Switcher Banner injection
    const chunks = [];
    targetRes.on('data', (chunk) => chunks.push(chunk));
    targetRes.on('end', () => {
      let body = Buffer.concat(chunks).toString('utf8');
      const bannerHtml = getBannerHtml();

      if (body.includes('</body>')) {
        body = body.replace('</body>', `${bannerHtml}</body>`);
      } else {
        body += bannerHtml;
      }

      const headers = { ...targetRes.headers };
      delete headers['content-length'];
      delete headers['content-encoding'];
      headers['content-length'] = Buffer.byteLength(body);

      res.writeHead(targetRes.statusCode, headers);
      res.end(body);
    });
  });

  proxy.on('error', (err) => {
    if (!res.headersSent) {
      const targetService = children.find((c) => String(c.envVars?.PORT) === String(targetPort));
      const logLines = targetService?.logs?.slice(-6)?.join('\n') || 'Service process has not written any output yet.';
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="3">
  <title>Spaceborn Service Initializing...</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; max-width: 600px; width: 100%; padding: 32px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
    .spinner { width: 44px; height: 44px; border: 3px solid rgba(226,67,75,0.2); border-top-color: #e2434b; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-size: 20px; margin: 0 0 10px; color: #fff; font-weight: 700; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0 0 16px; }
    .badge { display: inline-block; background: rgba(5,150,105,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); border-radius: 9999px; padding: 4px 12px; font-size: 12px; font-weight: 600; margin-bottom: 20px; }
    .btn { display: inline-block; padding: 10px 24px; background: #e2434b; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
    pre { text-align: left; background: #0b0f19; color: #38bdf8; padding: 12px; border-radius: 8px; font-size: 11px; max-height: 140px; overflow: auto; border: 1px solid #1e293b; margin: 20px 0; white-space: pre-wrap; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <span class="badge">Auto-reconnecting in 3s...</span>
    <h2>⚡ Spaceborn Service Initializing</h2>
    <p>Service on port <b>${targetPort}</b> (${targetService?.name || 'app'}) is warming up. Render free instances sleep after inactivity and wake up within 5–10 seconds.</p>
    <pre>${logLines}</pre>
    <div>
      <a href="${req.url}" class="btn">Refresh Now</a>
    </div>
    <div style="margin-top: 16px;">
      <a href="/__portal" style="color: #64748b; font-size: 12px; text-decoration: underline; margin-right: 12px;">App Portal</a>
      <a href="/__status" style="color: #64748b; font-size: 12px; text-decoration: underline;">Live Diagnostics</a>
    </div>
  </div>
</body>
</html>`);
    }
  });

  req.pipe(proxy);
}

function getBannerHtml() {
  // On phones the pill collapses to a small "Hub" toggle on the bottom-left, lifted above
  // the storefront's bottom cart dock so it never covers View Cart or checkout buttons.
  // It is also hidden automatically whenever a modal or cart drawer is open.
  return `
<style>
  #spaceborn-demo-banner {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 35;
    background: rgba(15,23,42,0.92);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 12px;
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
    padding: 10px 14px;
    color: #fff;
    font-family: system-ui,-apple-system,sans-serif;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  @media (max-width: 640px) {
    #spaceborn-demo-banner {
      bottom: calc(88px + env(safe-area-inset-bottom, 0px)) !important;
      left: 12px !important;
      right: auto !important;
      padding: 5px 10px !important;
      gap: 6px !important;
      font-size: 11px !important;
      border-radius: 999px !important;
      z-index: 35 !important;
    }
    #spaceborn-demo-banner > span:first-child { display: none !important; }
    #spaceborn-demo-banner:not(.open) > a { display: none !important; }
    #spaceborn-demo-banner.open {
      flex-wrap: wrap !important;
      justify-content: flex-start !important;
      max-width: calc(100vw - 24px) !important;
      border-radius: 14px !important;
      left: 12px !important;
      right: auto !important;
    }
    #spaceborn-demo-banner-toggle { display: inline-block !important; }
  }
  #spaceborn-demo-banner-toggle { display: none; background: none; border: none; color: #38bdf8; font-weight: 700; cursor: pointer; font-size: 11px; padding: 0 2px; }
  /* Automatically hide floating demo banner when any modal or cart drawer is open */
  body:has([role="dialog"]) #spaceborn-demo-banner,
  body.modal-open #spaceborn-demo-banner {
    display: none !important;
  }
</style>
<div id="spaceborn-demo-banner">
  <span style="font-weight:700;letter-spacing:0.5px;color:#38bdf8;display:flex;align-items:center;gap:4px">
    <span>🚀</span> Spaceborn Hub:
  </span>
  <a href="/__switch?app=store" style="color:#f8fafc;text-decoration:none;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,0.1);font-weight:500;" onmouseover="this.style.background='#3b82f6'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">🛍️ Storefront</a>
  <a href="/__switch?app=vendor" style="color:#f8fafc;text-decoration:none;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,0.1);font-weight:500;" onmouseover="this.style.background='#10b981'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">🏪 Vendor Hub</a>
  <a href="/__switch?app=admin" style="color:#f8fafc;text-decoration:none;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,0.1);font-weight:500;" onmouseover="this.style.background='#8b5cf6'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">🛡️ Admin Panel</a>
  <a href="/__portal" style="color:#94a3b8;text-decoration:none;padding:4px 6px;" title="Full System Hub">📑 Portal</a>
  <button id="spaceborn-demo-banner-toggle" type="button" onclick="document.getElementById('spaceborn-demo-banner').classList.toggle('open')" title="Switch app">🚀 Hub</button>
  <button onclick="document.getElementById('spaceborn-demo-banner').style.display='none'" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;padding:0 4px;" title="Dismiss">&times;</button>
</div>
`;
}

function renderPortalHtml(host) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spaceborn Demo Hub ($0 Free Tier Model)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #090d16; color: #f1f5f9; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
    .card-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; max-width: 1000px; width: 100%; margin-top: 32px; }
    .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 14px; padding: 24px; transition: transform 0.2s, border-color 0.2s; display: flex; flex-direction: column; justify-content: space-between; }
    .card:hover { transform: translateY(-3px); border-color: #3b82f6; }
    .badge { display: inline-block; padding: 3px 8px; font-size: 11px; font-weight: 700; border-radius: 6px; text-transform: uppercase; margin-bottom: 12px; }
    .badge-store { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
    .badge-vendor { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .badge-admin { background: rgba(139, 92, 246, 0.2); color: #a78bfa; }
    .badge-api { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
    h1 { font-size: 32px; font-weight: 800; background: linear-gradient(to right, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    h2 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 16px; }
    .btn { display: inline-block; text-align: center; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; transition: background 0.15s; }
    .btn-blue { background: #2563eb; color: #fff; }
    .btn-blue:hover { background: #1d4ed8; }
    .btn-green { background: #059669; color: #fff; }
    .btn-green:hover { background: #047857; }
    .btn-purple { background: #7c3aed; color: #fff; }
    .btn-purple:hover { background: #6d28d9; }
    .btn-amber { background: #d97706; color: #fff; }
    .btn-amber:hover { background: #b45309; }
    .meta-box { margin-top: 36px; padding: 18px 24px; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; max-width: 1000px; width: 100%; font-size: 13px; color: #94a3b8; }
    .meta-box b { color: #f1f5f9; }
    code { background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #38bdf8; font-size: 12px; }
  </style>
</head>
<body>
  <div style="text-align: center; max-width: 640px;">
    <h1>Spaceborn Demo Hub</h1>
    <p style="margin-top: 8px; font-size: 15px;">Zero-Dollar Unified Architecture hosted on Render Free Tier. All 4 microservices running cooperatively behind 1 gateway container.</p>
  </div>

  <div class="card-container">
    <div class="card">
      <div>
        <span class="badge badge-store">Customer Portal</span>
        <h2>🛍️ Storefront</h2>
        <p>Browse electronics catalog, 10-minute quick delivery geolocation, cart & checkout, 3D printing & CNC fabrication ordering.</p>
      </div>
      <a href="/__switch?app=store" class="btn btn-blue">Launch Storefront</a>
    </div>

    <div class="card">
      <div>
        <span class="badge badge-vendor">Vendor Portal</span>
        <h2>🏪 Vendor Hub</h2>
        <p>Merchant onboarding, real-time inventory management, order dispatch with audio alerts, fabrication quoting & production queue.</p>
      </div>
      <a href="/__switch?app=vendor" class="btn btn-green">Launch Vendor Hub</a>
    </div>

    <div class="card">
      <div>
        <span class="badge badge-admin">Operations Pillar</span>
        <h2>🛡️ Admin Panel</h2>
        <p>Store approval workflows, premises verification, catalog management, fabrication listings gating, and audit logging.</p>
      </div>
      <a href="/__switch?app=admin" class="btn btn-purple">Launch Admin Panel</a>
    </div>

    <div class="card">
      <div>
        <span class="badge badge-api">Backend Core</span>
        <h2>⚡ Express API</h2>
        <p>Node.js REST API with RBAC authorization, Supabase PostgreSQL, Firebase Token verification, and outbox event processor.</p>
      </div>
      <a href="/v1/health" class="btn btn-amber" target="_blank">Inspect API Health</a>
    </div>
  </div>

  <div class="meta-box">
    <b>Quick Tips:</b>
    <ul style="margin-left: 20px; margin-top: 8px; line-height: 1.6;">
      <li>You can jump between apps anytime using the floating pill in the bottom right corner or via <code>?app=store</code>, <code>?app=vendor</code>, and <code>?app=admin</code>.</li>
      <li>To test RBAC roles, sign in via Firebase Auth in each app. Founding administrator email is seeded in PostgreSQL.</li>
      <li>Database is powered by free Supabase PostgreSQL with pooled connections on port 6543.</li>
    </ul>
  </div>
</body>
</html>`;
}

// 3. Graceful Shutdown
function shutdown() {
  log('supervisor', 'Received termination signal. Gracefully stopping all child processes...');
  for (const { name, process: p } of children) {
    try {
      p.kill('SIGTERM');
    } catch {}
  }
  setTimeout(() => process.exit(0), 2000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function syncStandaloneAssets() {
  const apps = ['customer-storefront', 'vendor-hub', 'admin-panel'];
  for (const app of apps) {
    const srcStatic = path.join(ROOT_DIR, 'apps', app, '.next', 'static');
    const destStatic = path.join(ROOT_DIR, 'apps', app, '.next', 'standalone', 'apps', app, '.next', 'static');
    const srcPublic = path.join(ROOT_DIR, 'apps', app, 'public');
    const destPublic = path.join(ROOT_DIR, 'apps', app, '.next', 'standalone', 'apps', app, 'public');

    try {
      if (fs.existsSync(srcStatic)) {
        fs.mkdirSync(path.dirname(destStatic), { recursive: true });
        fs.cpSync(srcStatic, destStatic, { recursive: true, force: true });
        log('supervisor', `Synced static assets for ${app}`);
      }
      if (fs.existsSync(srcPublic)) {
        fs.mkdirSync(path.dirname(destPublic), { recursive: true });
        fs.cpSync(srcPublic, destPublic, { recursive: true, force: true });
      }
    } catch (e) {
      log('supervisor', `Asset sync notice for ${app}: ${e.message}`);
    }
  }
}

// 4. Main Bootstrap Sequence
async function main() {
  log('supervisor', '================================================');
  log('supervisor', '  SPACEBORN UNIFIED GATEWAY ($0 ZERO COST MODEL) ');
  log('supervisor', '================================================');

  // Step A: Run migrations
  await runMigrationsIfPossible();

  // Step B: Prepare static assets for Next.js standalone servers
  syncStandaloneAssets();

  // Step C: Spawn backend API
  spawnService('api', nodeCmd, ['services/api/dist/server.js'], {
    PORT: String(API_PORT),
  });

  // Step C2: Spawn the outbox worker (refunds, order emails, stock release for unpaid orders).
  // Without it the outbox table fills up and nothing downstream of a payment ever happens.
  // Same database, a tiny pool; it polls, so it needs no port.
  spawnService('worker', nodeCmd, ['services/api/dist/worker.js'], {
    DB_POOL_MAX: process.env.WORKER_DB_POOL_MAX || '2',
  });

  // Wait 1.5s for API to bind
  await new Promise((r) => setTimeout(r, 1500));

  // Helper to resolve standalone server.js or fallback to next start
  function getAppSpawnConfig(appName, port) {
    const standaloneAppPath = path.join(ROOT_DIR, 'apps', appName, '.next', 'standalone', 'apps', appName, 'server.js');
    const standaloneDirectPath = path.join(ROOT_DIR, 'apps', appName, '.next', 'standalone', 'server.js');
    const rootStandaloneAppPath = path.join(ROOT_DIR, '.next', 'standalone', 'apps', appName, 'server.js');
    const rootStandalonePath = path.join(ROOT_DIR, '.next', 'standalone', 'server.js');

    let targetScript = null;
    if (fs.existsSync(standaloneAppPath)) targetScript = standaloneAppPath;
    else if (fs.existsSync(standaloneDirectPath)) targetScript = standaloneDirectPath;
    else if (fs.existsSync(rootStandaloneAppPath)) targetScript = rootStandaloneAppPath;
    else if (fs.existsSync(rootStandalonePath)) targetScript = rootStandalonePath;

    if (targetScript) {
      log('supervisor', `Using Next.js standalone server for ${appName}: ${targetScript}`);
      return { cmd: nodeCmd, args: [targetScript] };
    }
    log('supervisor', `Using standard next start for ${appName}`);
    return { cmd: npxCmd, args: ['next', 'start', `apps/${appName}`, '-p', String(port)] };
  }

  // Step C: Spawn 3 Next.js applications
  const sf = getAppSpawnConfig('customer-storefront', STORE_PORT);
  spawnService('storefront', sf.cmd, sf.args, { PORT: String(STORE_PORT) });

  const vd = getAppSpawnConfig('vendor-hub', VENDOR_PORT);
  spawnService('vendor', vd.cmd, vd.args, { PORT: String(VENDOR_PORT) });

  const ad = getAppSpawnConfig('admin-panel', ADMIN_PORT);
  spawnService('admin', ad.cmd, ad.args, { PORT: String(ADMIN_PORT) });

  // Step D: Start Reverse Proxy Gateway
  startGateway();
}

main().catch((err) => {
  console.error('Fatal gateway error:', err);
  process.exit(1);
});
