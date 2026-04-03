JSON-Control Testing Library
=============================

Automated test harness, demo generator, and observability layer for the
dudezilla/JSON-Control JS library.

Quick start
-----------

  cp .env.example .env          # fill in Supabase credentials
  make js                 # Node.js server at http://localhost:7777
  make python                  # Python mirror server at http://localhost:7777
  make sync                     # push test results to Supabase

Mirror Universe — Two interchangeable servers
----------------------------------------------

The Node.js and Python servers expose identical APIs and serve the same
client-side assets. Either can be swapped in without changing the browser code.

  make js    # Node.js  — node serve-watch.js   (auto-reloads on git pull)
  make python     # Python   — python python/serve.py

Both servers:
  * Serve dist/ (index.html, style.css) as the root
  * Serve src/ at /src/... with correct MIME types (application/javascript for ESM)
  * Expose GET  /api/source/controls/   → JSON list of control source filenames
  * Expose GET  /api/control_registry   → JSON control registry map
  * Expose GET  /api/logs               → JSON log entries
  * Expose POST /api/logs               → append log entries
  * Guard against path-traversal on all /src/ requests

Make targets
------------

  make               Display this README (help)
  make js      Start the Node.js dev server (PORT 7777, auto-reload)
  make python       Start the Python mirror server (PORT 7777)
  make sync          Push unsynced SQLite results to Supabase

Running tests
-------------

  # jsdom unit tests — results written to test-results.db automatically
  pnpm test:browser

  # Disable DB recording for a single run
  JCTEST_DB=0 pnpm test:browser

  # Ad-hoc SQLite query
  pnpm db:query "SELECT control_name, AVG(duration_ms) FROM test_results GROUP BY control_name"

Environment variables
---------------------

  SUPABASE_URL              Your Supabase project URL
                            e.g. https://xxxx.supabase.co

  SUPABASE_SERVICE_ROLE_KEY Service-role API key (Settings → API in Supabase)
                            Bypasses RLS — keep this secret.

  PORT                      Dev server port (default: 7777)

  JCTEST_DB                 Set to 0 to disable the Jest DB reporter

  Copy .env.example to .env — Make loads it automatically.

Project layout
--------------

  src/                  Control source files (one per control)
    styles/               CSS theme files
      variables.css         High-contrast "Mirror Universe" CSS custom properties
    build_registry.js     Client-side registry builder (native ESM, no bundler)
    shell.js              Entry point — bootstraps build_registry then renders
    page.js               Per-control demo page renderer
    controls/             Individual control implementations
  dist/                 Static shell (index.html + style.css — git-tracked)
  tests/browser/        jsdom test suite (demo-pages.test.cjs)
  db/                   Database layer (all .cjs, no bundler)
    schema.sql            SQLite schema
    supabase-schema.sql   PostgreSQL schema (paste into Supabase SQL Editor once)
    db.cjs                SQLite client (better-sqlite3)
    git.cjs               Git provenance helpers
    reporter.cjs          Jest custom reporter
    sync.cjs              Supabase sync script
  python/               Python mirror server
    serve.py              Zero-dependency WSGI/http.server mirror of serve.js
    db.py                 Python DB helpers
  serve.js              Node.js production server entry
  serve-watch.js        Node.js dev server with git-pull auto-reload
  trash/                Dead code graveyard — do not import from here

First-time Supabase setup
--------------------------

  1. Open your Supabase project → SQL Editor → New query
  2. Paste db/supabase-schema.sql and run it
  3. Copy your Project URL and service_role key into .env
  4. Run: make sync

Git provenance
--------------

  Every test result row stores the git blob hash of the source file and test
  file at the time the tests ran. To retrieve a file at any recorded version:

    git cat-file blob <source_blob>

CSS theme
---------

  All colours are defined as CSS custom properties in src/styles/variables.css
  and loaded before style.css by dist/index.html. The high-contrast "Mirror
  Universe" palette uses a black background with neon green / electric blue
  accents. Component classes (.lv-*, .th-*) use only var(--...) references —
  no hardcoded colour values appear in any .js file.
