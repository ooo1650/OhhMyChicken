/* After `vite build`: turns dist/index.html into real pages for static hosting
   (index.html, menu/index.html, one per category), so link previews and crawlers
   see the content. The Node server keeps the untouched template and renders the
   same pages with live data instead. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { categoryPath, headHtml, pageMeta, resolveRoute } from '../src/shared/seo.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const { render } = await import(path.join(ROOT, 'dist-ssr', 'entry-server.js'));
const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'prerender-data.json'), 'utf8'));

const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
fs.writeFileSync(path.join(ROOT, 'dist-ssr', 'template.html'), template);

// Links in social cards need the site's address: PUBLIC_URL, or the one Vercel provides.
const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const origin = String(process.env.PUBLIC_URL || (host ? 'https://' + host : '')).replace(/\/+$/, '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
// Noon in Nepal: static pages can't know the time, and the app corrects it when it starts.
const AT = new Date('2026-01-01T06:15:00Z');

const cats = boot.defaults.CATEGORIES.filter((c) => boot.menu.some((m) => m.category === c.id));
for (const url of ['/', '/menu'].concat(cats.map(categoryPath))) {
  const route = resolveRoute(url, boot.defaults.CATEGORIES);
  const meta = pageMeta(route, boot);
  const head = origin ? headHtml(route, boot, origin)
    : '<title>' + esc(meta.title) + '</title>\n  <meta name="description" content="' + esc(meta.description) + '">';
  const html = template
    .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, () => head)
    .replace(/<!--app:start-->[\s\S]*?<!--app:end-->/, () => render(url, boot, AT));
  const file = path.join(DIST, url.slice(1), 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}
console.log('Prerendered ' + (2 + cats.length) + ' pages' + (origin ? ' for ' + origin : ''));
