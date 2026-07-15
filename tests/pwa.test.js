// The build must emit a complete installable PWA in dist/:
// index.html + manifest + service worker + icons, while keeping the
// single-file fantatomorrowland.html for phone transfer.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dist = (f) => path.join(__dirname, '..', 'docs', f);

test('dist contains both the PWA index.html and the single-file build', () => {
  assert.ok(fs.existsSync(dist('index.html')), 'dist/index.html missing');
  assert.ok(fs.existsSync(dist('fantatomorrowland.html')), 'dist/fantatomorrowland.html missing');
});

test('index.html links the manifest and registers the service worker safely', () => {
  const html = fs.readFileSync(dist('index.html'), 'utf8');
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(html, /'serviceWorker' in navigator/, 'registration must be feature-guarded');
  assert.match(html, /catch/, 'registration failure must be swallowed (file://, artifacts)');
});

test('single-file build has no manifest link (nothing to 404 on)', () => {
  const html = fs.readFileSync(dist('fantatomorrowland.html'), 'utf8');
  assert.doesNotMatch(html, /rel="manifest"/);
});

test('manifest is valid and installable', () => {
  const m = JSON.parse(fs.readFileSync(dist('manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.ok(m.name && m.start_url && m.theme_color);
  const sizes = m.icons.map((i) => i.sizes).sort();
  assert.deepEqual(sizes, ['192x192', '512x512']);
  for (const i of m.icons) assert.ok(fs.existsSync(dist(i.src)), `${i.src} missing`);
});

test('icons are real PNGs', () => {
  for (const f of ['icon-192.png', 'icon-512.png']) {
    const buf = fs.readFileSync(dist(f));
    assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${f} is not a PNG`);
  }
});

test('service worker precaches the app and is version-stamped by the build', () => {
  const sw = fs.readFileSync(dist('sw.js'), 'utf8');
  assert.match(sw, /fanta-[0-9a-f]{8,}/, 'cache name must embed a content hash so updates roll out');
  for (const asset of ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png']) {
    assert.ok(sw.includes(asset), `sw.js must precache ${asset}`);
  }
});
