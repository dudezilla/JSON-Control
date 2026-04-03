#!/usr/bin/env python3
"""
review.py — JSON-Control local design iteration review
Run from the repo root while the dev server is up on port 3000.
  python3 review.py
"""

import json
import subprocess
import textwrap
import urllib.request
from datetime import datetime

SERVER = "http://localhost:3000"
REPO   = "lib/json-control"

# ── 1. Project goals ──────────────────────────────────────────────────────────

GOALS = """
╔══════════════════════════════════════════════════════════════════════════╗
║              JSON-Control — Design Iteration Review                      ║
╠══════════════════════════════════════════════════════════════════════════╣
║  What it is                                                              ║
║                                                                          ║
║  A vanilla-JS UI framework where the entire application is described in  ║
║  a JSON config array, processed by ControlFactory. To change the layout  ║
║  or composition of a page, you edit JSON. The JS source files never      ║
║  need to change. No bundler. Native ES modules only. Port 3000.          ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║  Goal 1 — index.html is a permanent boilerplate.                         ║
║                                                                          ║
║  It accepts one argument: a ?config= query parameter pointing to a JSON  ║
║  config file. The file is static and generic. If you find yourself       ║
║  editing index.html to change a page, something has leaked into the      ║
║  wrong layer.                                                            ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║  Goal 2 — Every layout piece is a registered control_type.               ║
║                                                                          ║
║  Sidebars, columns, tracks, pages — none of them are static HTML. Every  ║
║  structural element must be its own registered control_type,             ║
║  instantiable from a JSON config entry via ControlFactory. The config    ║
║  is the only thing that changes between layouts.                         ║
║                                                                          ║
║  PageControl                                                             ║
║    └── LayoutControl          (control_type: "two_column")               ║
║          ├── LayoutPartAControl   (sidebar)                              ║
║          │     └── ConfigDownloadControl                                 ║
║          │     └── ConfigUploadControl                                   ║
║          └── LayoutPartBControl   (main area)                            ║
║                └── TrackViewControl                                      ║
║                └── PageViewControl                                       ║
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║  Goal 3 — No layout or wiring logic belongs in JS.                       ║
║                                                                          ║
║  Hardcoding zone names, imperatively creating child controls in a        ║
║  constructor, manually wiring events between siblings — all of that      ║
║  belongs in config, not code. WorkspaceControl.js currently violates     ║
║  all three goals and should be refactored into a JSON config + thin      ║
║  registered shell.                                                       ║
╚══════════════════════════════════════════════════════════════════════════╝
"""

# ── 2. Helpers ────────────────────────────────────────────────────────────────

def fetch_json(path):
    with urllib.request.urlopen(SERVER + path, timeout=5) as r:
        return json.loads(r.read())

def git_log(n=6):
    result = subprocess.run(
        ["git", "log", "--oneline", f"-{n}"],
        cwd=REPO, capture_output=True, text=True
    )
    return result.stdout.strip()

def run_tests():
    result = subprocess.run(
        ["pnpm", "run", "test:browser", "--silent"],
        cwd=REPO, capture_output=True, text=True
    )
    for line in (result.stdout + result.stderr).splitlines():
        if "run complete" in line or "Tests:" in line:
            print(" ", line.strip())

def section(title):
    print(f"\n{'─' * 70}")
    print(f"  {title}")
    print(f"{'─' * 70}")

# ── 3. Control registry summary ───────────────────────────────────────────────

def print_registry(registry):
    section("Registered control types")
    by_cat = {}
    for ct, meta in registry.items():
        cat = meta.get("category", "other")
        by_cat.setdefault(cat, []).append(ct)

    for cat, types in sorted(by_cat.items()):
        print(f"\n  [{cat}]")
        for ct in sorted(types):
            desc = registry[ct].get("description", "")[:60]
            n_tests = len(registry[ct].get("tests", []))
            print(f"    {ct:<28}  {n_tests:>2} tests   {desc}")

# ── 4. Spotlight: controls changed in the last 3 commits ─────────────────────

SPOTLIGHT = ["viewport", "track", "page", "workspace"]

def print_spotlight(registry):
    section("Design spotlight — recently changed controls")
    for ct in SPOTLIGHT:
        meta = registry.get(ct)
        if not meta:
            print(f"\n  {ct}: not registered")
            continue
        print(f"\n  ┌─ {ct} ({meta.get('category', '?')})")
        print(f"  │  {meta.get('description', '')}")
        cfg = meta.get("defaultConfig", {})
        print(f"  │  defaultConfig keys: {list(cfg.keys())}")
        tests = meta.get("tests", [])
        print(f"  │  {len(tests)} inline meta tests:")
        for t in tests[:4]:
            print(f"  │    • {t['name']}")
        if len(tests) > 4:
            print(f"  │    ... and {len(tests) - 4} more")
        print(f"  └{'─' * 60}")

# ── 5. default.json ───────────────────────────────────────────────────────────

def print_default_json():
    section("default.json — bootstrap config")
    try:
        with open("lib/json-control/dist/default.json") as f:
            data = json.load(f)
        print(json.dumps(data, indent=2))
    except Exception as e:
        print(f"  Could not read default.json: {e}")

# ── 6. Git history ────────────────────────────────────────────────────────────

def print_git_log():
    section("Recent commits")
    for line in git_log().splitlines():
        print(f"  {line}")

# ── 7. Test run ───────────────────────────────────────────────────────────────

def print_tests():
    section("Test suite")
    run_tests()

# ── 8. Open questions / iteration prompts ─────────────────────────────────────

OPEN_QUESTIONS = [
    "TrackViewControl and PageViewControl were not renamed yet — still named "
    "'track_view' / 'page_view'. Should they become 'track_collection' / "
    "'page_collection' to match the aspirational default.json structure?",

    "WorkspaceControl.DEFAULT_CHILDREN still has 'zone' fields — they are "
    "silently ignored now that zone layout is gone. Remove them?",

    "TrackControl fires onComplete when the user advances past the last page. "
    "Should the workspace wire that up to persist the track somewhere?",

    "ViewportControl is not exposed in default.json — it only exists inside "
    "TrackControl. Should it be usable standalone in config too?",

    "No tests yet for TrackViewControl, PageViewControl, or WorkspaceControl. "
    "Which would give the most value first?",
]

def print_open_questions():
    section("Open design questions for next iteration")
    for i, q in enumerate(OPEN_QUESTIONS, 1):
        wrapped = textwrap.fill(q, width=66, subsequent_indent="     ")
        print(f"\n  {i}. {wrapped}")

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(GOALS)
    print(f"  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")

    try:
        registry = fetch_json("/api/control_registry")
    except Exception as e:
        print(f"\n  WARNING: Could not reach dev server at {SERVER}: {e}")
        print("     Start it with: pnpm --filter @workspace/json-control run dev\n")
        registry = {}

    print_registry(registry)
    print_spotlight(registry)
    print_default_json()
    print_git_log()
    print_tests()
    print_open_questions()

    print(f"\n{'═' * 70}\n")

if __name__ == "__main__":
    main()
