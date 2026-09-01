/**
 * Assemble the unified deployment output for Vercel.
 *
 * Mirrors the layout server/dev-server.js serves locally, so production and
 * development see the same paths:
 *
 *   dist/            <- public/            (Workspace landing page at /)
 *   dist/grids/      <- grids/             (Grids app at /grids/)
 *   dist/dox/        <- dox-src/dist/      (Dox vite build, base '/dox/')
 *
 * The api/ directory is NOT copied — Vercel picks it up from the repo root
 * on its own and builds it as serverless functions.
 */

import { cpSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

cpSync(path.join(ROOT, 'public'), DIST, { recursive: true });
cpSync(path.join(ROOT, 'grids'), path.join(DIST, 'grids'), { recursive: true });
cpSync(path.join(ROOT, 'dox-src', 'dist'), path.join(DIST, 'dox'), { recursive: true });

console.log('[build-dist] Assembled dist/ (public -> /, grids -> /grids/, dox -> /dox/)');
