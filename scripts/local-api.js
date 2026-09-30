// Local stand-in for Vercel's function runtime so `npm run dev` works without
// the Vercel CLI. Serves ./api/*.js on :3001; Vite proxies /api to it.
// Reads keys from .env.local (same names as Vercel env vars).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const envFile = path.join(root, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = Number(process.env.API_PORT || 3001);

http
  .createServer(async (req, res) => {
    const name = new URL(req.url, 'http://x').pathname.replace(/^\/api\//, '').replace(/\/$/, '');
    const file = path.join(root, 'api', `${name}.js`);
    if (!/^[a-z-]+$/.test(name) || !fs.existsSync(file)) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: 'Not found' }));
    }
    res.status = (c) => ((res.statusCode = c), res);
    try {
      const mod = await import(`${pathToFileURL(file).href}?t=${fs.statSync(file).mtimeMs}`);
      await mod.default(req, res);
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e.message }));
    }
  })
  .listen(PORT, () => console.log(`API functions on http://localhost:${PORT}/api/*`));
