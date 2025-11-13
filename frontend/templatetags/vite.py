from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, Any, List

from django import template
from django.conf import settings
from django.templatetags.static import static
from django.utils.safestring import mark_safe

register = template.Library()


@lru_cache(maxsize=1)
def _load_vite_manifest() -> Dict[str, Any]:
    """Load and cache Vite's manifest.json from the built frontend."""
    # Build dir is already in STATICFILES_DIRS; manifest lives next to assets
    build_dir = Path(settings.BASE_DIR) / "frontend" / "dist"
    manifest_path = build_dir / "manifest.json"
    if not manifest_path.exists():
        return {}
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _render_css_links(css_files: List[str]) -> str:
    links = []
    for href in css_files:
        links.append(f'<link rel="stylesheet" href="{static(href)}">')
    return "\n".join(links)


def _render_preload_links(imports: List[str], manifest: Dict[str, Any]) -> str:
    tags: List[str] = []
    for imp in imports:
        entry = manifest.get(imp)
        if not entry:
            continue
        file = entry.get("file")
        if file:
            tags.append(
                f'<link rel="modulepreload" crossorigin href="{static(file)}">'
            )
    return "\n".join(tags)


@register.simple_tag
def vite_assets(entry: str = "src/main.tsx") -> str:
    """
    Render <script> and <link> tags for the given Vite entry using manifest.json.

    Usage in template:
        {% load vite %}
        {% vite_assets 'src/main.tsx' %}
    """
    manifest = _load_vite_manifest()
    if not manifest:
        # Fallback: nothing to render (avoid hardcoding hashed files)
        return ""

    data = manifest.get(entry)
    if not data:
        return ""

    parts: List[str] = []

    # Preload imported chunks (optional but good for performance)
    imports = data.get("imports") or []
    if imports:
        parts.append(_render_preload_links(imports, manifest))

    # CSS for the entry
    css_files = data.get("css") or []
    if css_files:
        parts.append(_render_css_links(css_files))

    # Main module script
    file = data.get("file")
    if file:
        parts.append(
            f'<script type="module" crossorigin src="{static(file)}"></script>'
        )

    return mark_safe("\n".join([p for p in parts if p]))


