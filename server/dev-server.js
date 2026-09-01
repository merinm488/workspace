/**
 * ================================================
 * WORKSPACE - Development Server
 * ================================================
 *
 * One Express server that mirrors the production (Vercel) layout on a single
 * origin:
 *
 *   /              -> public/index.html   (Workspace landing page)
 *   /js, /css      -> public assets
 *   /grids/*       -> grids app (static)
 *   /dox/*         -> dox build (static, vite base '/dox/')
 *   /api/workspace -> api/workspace.js   (workspace API)
 *   /api/notes     -> api/notes.js       (dox API, fetch-style handler)
 *   /api/users     -> api/users.js       (grids API)
 *
 * Storage: local JSON files under db/users/ (NODE_ENV=development).
 * Run with:  npm run dev   (port 4000)
 */

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Load .env manually (keeps dependencies minimal)
const envPath = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2] || '';
    }
  }
}

// Force development mode for local storage (the .env value must not override
// the intent of this server; it is 'development' by default anyway).
process.env.NODE_ENV = 'development';

const { default: workspaceHandler } = await import('../api/workspace.js');
const notesModule = await import('../api/notes.js');
const { default: usersHandler } = await import('../api/users.js');

const app = express();
const PORT = 4000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ---------- fetch-style -> express adapter for api/notes.js ----------
function createMockRequest(req) {
  return {
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v])),
    url: req.originalUrl,
    async json() {
      return req.body;
    }
  };
}

function createMockResponse(res) {
  const make = (payload) => ({
    json: (body) => {
      res.status(payload.status).json(body);
      return make(payload);
    }
  });
  return {
    json(body) {
      res.status(200).json(body);
    }
  };
}

// api/notes.js uses the Web Fetch API style (Request/Response). Adapt it:
async function adaptNotesHandler(req, res, method) {
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const hasBody = method !== 'GET' && method !== 'DELETE';
  const request = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: hasBody ? JSON.stringify(req.body || {}) : undefined
  });

  const response = await notesModule[method](request);
  const text = await response.text();
  res.status(response.status);
  res.set('Content-Type', response.headers.get('content-type') || 'application/json');
  res.send(text);
}

// ---------- API routes ----------
app.all('/api/workspace', (req, res) => workspaceHandler(req, res));
app.all('/api/notes', (req, res) => adaptNotesHandler(req, res, req.method.toUpperCase()));
app.all('/api/users', (req, res) => usersHandler(req, res));

// ---------- Static apps ----------
// Workspace landing page + assets
app.use(express.static(path.join(ROOT_DIR, 'public'), { index: 'index.html' }));

// Dox (vite build with base '/dox/')
app.use('/dox', express.static(path.join(ROOT_DIR, 'dox'), { index: 'index.html' }));
app.get('/dox/*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'dox', 'index.html'));
});

// Grids (plain static)
app.use('/grids', express.static(path.join(ROOT_DIR, 'grids'), { index: 'index.html' }));

// Root redirect to the workspace landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'public', 'index.html'));
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log('\n🚀 Workspace Development Server');
  console.log(`📱 Workspace:  http://localhost:${PORT}`);
  console.log(`📝 Dox:        http://localhost:${PORT}/dox/`);
  console.log(`📊 Grids:      http://localhost:${PORT}/grids/`);
  console.log(`🔌 APIs:       /api/workspace, /api/notes, /api/users`);
  console.log(`📁 Local DB:   ${path.join(ROOT_DIR, 'db')}`);
  console.log('\nPress Ctrl+C to stop\n');
});
