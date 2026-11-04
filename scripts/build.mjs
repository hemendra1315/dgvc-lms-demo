#!/usr/bin/env node
/**
 * Build script for the DGVC LMS demo.
 *
 *   node scripts/build.mjs            production build into dist/
 *   node scripts/build.mjs --serve    build, then serve dist/ on http://localhost:5173
 *   node scripts/build.mjs --watch --serve   rebuild on change (dev)
 *
 * Uses esbuild (bundling TS/TSX) and the Tailwind CSS v4 compiler API directly,
 * so the app can be built without network access or extra CLIs.
 */
import { build, context } from 'esbuild';
import { compile } from 'tailwindcss';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const args = new Set(process.argv.slice(2));
const PORT = Number(process.env.PORT || 5173);

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

async function buildCss() {
  const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
  const input = fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8');
  const compiler = await compile(input, {
    base: path.join(ROOT, 'src'),
    loadStylesheet: async (id, base) => {
      let file;
      if (id === 'tailwindcss') file = path.join(twDir, 'index.css');
      else if (id.startsWith('tailwindcss/')) file = path.join(twDir, id.slice('tailwindcss/'.length));
      else file = path.resolve(base, id);
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  // Candidate extraction: every class-like token in the sources. Tailwind ignores invalid ones.
  const candidates = new Set();
  for (const f of [...walk(path.join(ROOT, 'src')), path.join(ROOT, 'index.html')]) {
    for (const tok of fs.readFileSync(f, 'utf8').split(/[\s"'`{}()<>,;=]+/)) if (tok) candidates.add(tok);
  }
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'assets/app.css'), compiler.build([...candidates]));
}

function copyStatic() {
  copyDir(path.join(ROOT, 'public'), DIST);
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(DIST, 'index.html'));
  const pdfjs = path.dirname(require.resolve('pdfjs-dist/package.json'));
  fs.copyFileSync(path.join(pdfjs, 'build/pdf.worker.min.mjs'), path.join(DIST, 'assets/pdf.worker.min.mjs'));
}

const esbuildOptions = {
  entryPoints: [path.join(ROOT, 'src/main.tsx')],
  outdir: path.join(DIST, 'assets'),
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  bundle: true,
  splitting: true,
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  minify: !args.has('--watch'),
  sourcemap: true,
  define: { 'process.env.NODE_ENV': JSON.stringify(args.has('--watch') ? 'development' : 'production') },
  logLevel: 'info',
};

async function full() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
  copyStatic();
  await buildCss();
}

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
    '.pdf': 'application/pdf', '.svg': 'image/svg+xml', '.json': 'application/json', '.map': 'application/json',
    '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
  http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(DIST, url);
    if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
    const exists = fs.existsSync(file) && fs.statSync(file).isFile();
    if (!exists) {
      // Unknown asset paths are real 404s (so missing PDFs are detectable); app routes fall back to index.html.
      if (/^\/(assets|demo-pdfs)\//.test(url) || path.extname(url)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
      file = path.join(DIST, 'index.html');
    }
    const body = fs.readFileSync(file);
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'content-length': body.length, 'cache-control': 'no-cache' });
    req.method === 'HEAD' ? res.end() : res.end(body);
  }).listen(PORT, () => console.log(`\n  DGVC LMS demo → http://localhost:${PORT}\n`));
}

await full();
if (args.has('--watch')) {
  const ctx = await context({ ...esbuildOptions, plugins: [{ name: 'css', setup(b) { b.onEnd(() => buildCss().catch(console.error)); } }] });
  await ctx.watch();
} else {
  await build(esbuildOptions);
}
if (args.has('--serve')) serve();
