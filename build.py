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
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw

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
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
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
if ('serviceWorker' in navigator) {
  try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
}
</script>
"""


def bundle() -> str:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    logic = (ROOT / "fanta.js").read_text(encoding="utf-8")
    if SRC_TAG not in html:
        raise SystemExit(f"expected {SRC_TAG!r} in index.html, not found")
    return html.replace(SRC_TAG, f"<script>\n{logic}\n</script>")


def _mix(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def make_icon(size: int) -> Image.Image:
    """Original festival emblem (NOT the trademarked Tomorrowland logo):
    a symmetric main-stage gate with mirrored wings under a rising sun,
    on a purple radial glow. Full-bleed so it works as a maskable icon."""
    bg, glow = (11, 8, 18), (64, 34, 96)
    pink, purple, acid, dark = "#ff3ea5", "#b26bff", "#d8ff3e", "#0b0812"
    img = Image.new("RGB", (size, size), bg)
    d = ImageDraw.Draw(img)
    s = size

    # radial glow, drawn as concentric blended circles
    cx, cy = s * 0.5, s * 0.44
    steps = 48
    for i in range(steps):
        t = i / steps
        r = s * 0.62 * (1 - t)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=_mix(bg, glow, t))

    # rising sun behind the gate
    d.ellipse([s * 0.36, s * 0.10, s * 0.64, s * 0.38], fill=pink)

    # mirrored side wings
    d.polygon([(s * 0.04, s * 0.80), (s * 0.28, s * 0.34), (s * 0.44, s * 0.80)], fill=purple)
    d.polygon([(s * 0.56, s * 0.80), (s * 0.72, s * 0.34), (s * 0.96, s * 0.80)], fill=purple)

    # central stage pyramid with a dark doorway
    d.polygon([(s * 0.24, s * 0.80), (s * 0.50, s * 0.18), (s * 0.76, s * 0.80)], fill=acid)
    d.polygon([(s * 0.41, s * 0.80), (s * 0.50, s * 0.50), (s * 0.59, s * 0.80)], fill=dark)

    # ground line
    d.rectangle([s * 0.04, s * 0.80, s * 0.96, s * 0.835], fill=acid)
    return img


def build() -> None:
    DIST.mkdir(exist_ok=True)
    single = bundle()

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

    build_hash = hashlib.sha256(pwa.encode()).hexdigest()[:12]
    (DIST / "sw.js").write_text(SW_TEMPLATE.format(build_hash=build_hash), encoding="utf-8")

    for size in (192, 512):
        make_icon(size).save(DIST / f"icon-{size}.png")

    for f in sorted(DIST.iterdir()):
        print(f"  {f.name:24} {f.stat().st_size / 1024:7.1f} KiB")
    print(f"build hash: {build_hash}")


if __name__ == "__main__":
    build()
