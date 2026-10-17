import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;
const DIST_DIR = path.join(__dirname, 'dist');
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || 'https://evnexus-api-gateway-prod-gne4dzcag2b6dsdx.centralindia-01.azurewebsites.net';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json'
};

const server = http.createServer((req, res) => {
  // 1. Transparent Reverse Proxy for /api/* to eliminate browser CORS
  if (req.url?.startsWith('/api/')) {
    try {
      const targetUrl = new URL(req.url, API_GATEWAY_URL);
      const isHttps = targetUrl.protocol === 'https:';
      const transport = isHttps ? https : http;

      const proxyHeaders = { ...req.headers, host: targetUrl.host };
      delete proxyHeaders['origin'];
      delete proxyHeaders['referer'];

      const proxyReq = transport.request(targetUrl, {
        method: req.method,
        headers: proxyHeaders,
        timeout: 60000
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy(new Error('Gateway request timed out'));
      });

      proxyReq.on('error', (err) => {
        console.error('API Gateway proxy error:', err.message);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'API Gateway unreachable', error: err.message }));
        }
      });

      req.pipe(proxyReq);
      return;
    } catch (err) {
      console.error('Failed to proxy API request:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Internal Proxy Error' }));
      }
      return;
    }
  }

  // 2. Only handle GET and HEAD requests for static files
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Method Not Allowed');
    return;
  }

  // 3. Static asset serving and SPA fallback
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let safePath = path.normalize(decodeURIComponent(parsedUrl.pathname)).replace(/^(\.\.[/\\])+/, '');

  let filePath = path.join(DIST_DIR, safePath);

  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    let targetPath = filePath;

    if (!err && stats.isDirectory()) {
      targetPath = path.join(filePath, 'index.html');
    }

    fs.stat(targetPath, (err2, stats2) => {
      if (err2 || !stats2.isFile()) {
        targetPath = path.join(DIST_DIR, 'index.html');
      }

      const ext = path.extname(targetPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      const isHtml = ext === '.html';
      const cacheControl = isHtml
        ? 'no-cache, no-store, must-revalidate'
        : 'public, max-age=31536000, immutable';

      fs.readFile(targetPath, (readErr, content) => {
        if (readErr) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Internal Server Error');
          return;
        }

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': content.length,
          'Cache-Control': cacheControl,
          'X-Content-Type-Options': 'nosniff'
        });

        if (req.method === 'HEAD') {
          res.end();
        } else {
          res.end(content);
        }
      });
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`EVNexus Frontend production server listening on port ${PORT}`);
  console.log(`Proxying /api/* requests to: ${API_GATEWAY_URL}`);
});
