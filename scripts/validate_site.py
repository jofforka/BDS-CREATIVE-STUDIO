#!/usr/bin/env python3
"""Static release checks for the public BDS Pages artifact."""
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index.html", "booking.html", "photography.html", "film.html", "sound.html", "portfolio-admin.html"]
ALLOWED_DEPARTMENTS = {"photography": {"image"}, "film": {"image", "video"}, "sound": {"image", "video", "audio"}}
ALLOWED_MEDIA = re.compile(r"^assets/portfolio/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp|mp4|mp3|ogg)$|^https://[^\s]+$", re.I)
errors = []

class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.assets = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "script" and a.get("src"): self.assets.append(a["src"])
        if tag == "link" and a.get("rel") == "stylesheet" and a.get("href"): self.assets.append(a["href"])
        if tag == "img" and a.get("src"): self.assets.append(a["src"])

for page in PAGES:
    parser = Assets()
    parser.feed((ROOT / page).read_text(encoding="utf-8"))
    for asset in parser.assets:
        if not asset.startswith(("http://", "https://", "data:")) and not (ROOT / asset.split("?")[0]).is_file():
            errors.append(f"{page}: missing asset {asset}")

data = json.loads((ROOT / "content/portfolio.json").read_text(encoding="utf-8"))
ids = set()
for i, p in enumerate(data.get("projects", [])):
    ident = p.get("id")
    if not isinstance(ident, str) or not ident or ident in ids: errors.append(f"project {i}: missing/duplicate ID")
    ids.add(ident)
    department = p.get("department")
    if p.get("type") not in ALLOWED_DEPARTMENTS.get(department, set()): errors.append(f"{ident}: unsupported department/type")
    if not isinstance(p.get("title"), str) or not p["title"].strip(): errors.append(f"{ident}: missing title")
    if not isinstance(p.get("media"), str) or not ALLOWED_MEDIA.fullmatch(p["media"]): errors.append(f"{ident}: invalid media URL/path")
    if not isinstance(p.get("published"), bool): errors.append(f"{ident}: missing published boolean")
    if not isinstance(p.get("demo"), bool): errors.append(f"{ident}: missing demo boolean")
    if p.get("poster") and not ALLOWED_MEDIA.fullmatch(p["poster"]): errors.append(f"{ident}: invalid poster")

if errors:
    print("\n".join(errors), file=sys.stderr)
    sys.exit(1)
print(f"Validated {len(PAGES)} pages and {len(ids)} portfolio entries.")
