#!/usr/bin/env python3
"""Build Fantatomorrowland into dist/.

Outputs (in docs/, which GitHub Pages serves from the main branch):
  docs/fantatomorrowland.html  single self-contained file (transfer to the
                               phone, open anywhere; no server, no internet)
  docs/index.html + manifest.webmanifest + sw.js + icons
                               the same app as an installable PWA. Open the
                               Pages URL once on the phone, "Add to Home
                               Screen", and it works fully offline after.

Usage: python3 build.py
"""
import base64
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).parent
DIST = ROOT / "docs"  # named docs so GitHub Pages can serve it straight from main
SRC_TAG = '<script src="fanta.js"></script>'

MANIFEST = {
    "name": "Fantatomorrowland",
    "short_name": "FantaTML",
    "description": "Fantasy league for Tomorrowland: sex, disgust, idiocy, drama, pain.",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "background_color": "#0b0812",
    "theme_color": "#0b0812",
    "icons": [
        {"src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable"},
        {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"},
    ],
}

SW_TEMPLATE = """'use strict';
// Cache-first service worker. The cache name embeds a build hash, so a new
// deploy invalidates the old cache on the next online visit.
const CACHE = 'fanta-{build_hash}';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {{
  // fetch with cache:'no-cache' so a stale HTTP cache (GitHub Pages sends
  // max-age=600) can never be precached as the "new" version
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(ASSETS.map((u) =>
        fetch(u, {{ cache: 'no-cache' }}).then((r) => {{
          if (!r.ok) throw new Error('precache failed: ' + u);
          return c.put(u, r);
        }})
      ))
    ).then(() => self.skipWaiting())
  );
}});

self.addEventListener('activate', (e) => {{
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
}});

self.addEventListener('fetch', (e) => {{
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, {{ ignoreSearch: true }}).then((hit) =>
      hit ||
      fetch(e.request).catch(() => (e.request.mode === 'navigate' ? caches.match('./') : undefined))
    )
  );
}});
"""

REGISTER_SNIPPET = """
<script>
// PWA offline support. Guarded so the same file keeps working where service
// workers are unavailable (file://, sandboxed iframes).
// Self-updating: on launch we check for a new version; when the new service
// worker takes control (skipWaiting + claim), reload once so the user sees it
// immediately instead of on the next launch. Never reloads on first install.
if ('serviceWorker' in navigator) {
  try {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js')
      .then((reg) => reg.update())
      .catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
  } catch (e) {}
}
</script>
"""


def bundle() -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    logic = (ROOT / "fanta.js").read_text(encoding="utf-8")
    if SRC_TAG not in html:
        raise SystemExit(f"expected {SRC_TAG!r} in index.html, not found")
    return html.replace(SRC_TAG, f"<script>\n{logic}\n</script>")


LOGO = ROOT / "assets" / "logo.jpg"


def make_icon(size: int) -> Image.Image:
    """App icon: the user-provided logo (assets/logo.jpg), square full-bleed."""
    return Image.open(LOGO).convert("RGB").resize((size, size), Image.LANCZOS)


def logo_data_uri(size: int = 112, quality: int = 82) -> str:
    """Small inlined copy of the logo for the in-app header."""
    img = Image.open(LOGO).convert("RGB").resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def build() -> None:
    DIST.mkdir(exist_ok=True)
    single = bundle()

    single = single.replace("__LOGO__", logo_data_uri())

    # one stamp identifies this build everywhere: visible in the app's
    # Friends tab, and embedded in the service-worker cache name
    stamp = hashlib.sha256(single.encode()).hexdigest()[:8]
    single = single.replace("__BUILD__", stamp)

    # 1) single self-contained file (no manifest link: nothing to 404 on)
    (DIST / "fantatomorrowland.html").write_text(single, encoding="utf-8")

    # 2) PWA variant: manifest link + guarded service-worker registration
    head_links = (
        "</title>\n"
        '<link rel="manifest" href="manifest.webmanifest">\n'
        '<link rel="icon" href="icon-192.png">\n'
        '<link rel="apple-touch-icon" href="icon-192.png">'
    )
    pwa = single.replace("</title>", head_links, 1) + REGISTER_SNIPPET
    (DIST / "index.html").write_text(pwa, encoding="utf-8")

    (DIST / "manifest.webmanifest").write_text(json.dumps(MANIFEST, indent=2), encoding="utf-8")

    (DIST / "sw.js").write_text(SW_TEMPLATE.format(build_hash=stamp), encoding="utf-8")

    for size in (192, 512):
        make_icon(size).save(DIST / f"icon-{size}.png")

    for f in sorted(DIST.iterdir()):
        print(f"  {f.name:24} {f.stat().st_size / 1024:7.1f} KiB")
    print(f"build stamp: {stamp}")


if __name__ == "__main__":
    build()
