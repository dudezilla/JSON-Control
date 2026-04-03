"""
serve.py — Python HTTP server for the JSON-Control demo site.

Mirror of serve.js: serves the same static files and REST endpoints so
the JS and Python servers are interchangeable (mirror universe).

The control registry is built entirely client-side by build_registry.js —
this server only needs to:
  1. Serve dist/ and src/ as static files with correct MIME types.
  2. Expose GET /api/source/controls/ so build_registry.js can discover files.
  3. Expose GET /api/logs and POST /api/logs for the SQLite log store.

REST API (mirrors serve.js)
───────────────────────────
  GET  /api/source/controls/          List all .js files in src/controls/ (JSON)
  GET  /api/source/controls/:file     Serve src/controls/<file> as text/plain
  GET  /api/source/                   List all .js files in src/ top-level (JSON)
  GET  /api/source/:file              Serve src/<file>.js as text/plain
  GET  /api/logs                      Query log entries (?control= &level= &limit=)
  POST /api/logs                      Insert a log entry { level, context, message, detail? }

Static routes
─────────────
  /              → dist/index.html
  /src/...       → src/... (application/javascript — CRITICAL for native ESM)
  anything else  → dist/<path>

Usage:
  python python/serve.py
  PORT=7777 python python/serve.py
"""

import json
import mimetypes
import os
import sys
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

# ── Paths ──────────────────────────────────────────────────────────────────────

_HERE        = Path(__file__).parent
_ROOT        = _HERE.parent
_DIST_DIR    = _ROOT / 'dist'
_SRC_DIR     = _ROOT / 'src'
_CONTROLS_DIR = _SRC_DIR / 'controls'

PORT = int(os.environ.get('PORT', 7777))

# ── MIME types ─────────────────────────────────────────────────────────────────

_MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.mjs':  'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.png':  'image/png',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
}

_CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control':                'no-cache',
}

# ── DB import (optional — logs degrade gracefully if unavailable) ──────────────

try:
    sys.path.insert(0, str(_HERE))
    import db as _db
    _db.set_instance_id(str(uuid.uuid4()))
    _DB_AVAILABLE = True
except Exception as _e:
    print(f'[serve.py] db.py not available: {_e}')
    _DB_AVAILABLE = False


# ── Handler ────────────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        print(f'  {self.address_string()} {fmt % args}')

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _cors_headers(self, extra=None):
        h = dict(_CORS)
        if extra:
            h.update(extra)
        return h

    def _json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        for k, v in self._cors_headers({'Content-Type': 'application/json; charset=utf-8'}).items():
            self.send_header(k, v)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _serve_file(self, file_path: Path):
        if not file_path.is_file():
            self._json(404, {'error': 'Not found', 'path': str(file_path)})
            return
        ext  = file_path.suffix.lower()
        mime = _MIME.get(ext, 'application/octet-stream')
        data = file_path.read_bytes()
        self.send_response(200)
        for k, v in self._cors_headers({'Content-Type': mime}).items():
            self.send_header(k, v)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _serve_source_text(self, file_path: Path, base_dir: Path):
        """Serve a source file as text/plain (for /api/source/... endpoints)."""
        try:
            resolved = file_path.resolve()
            base_res = base_dir.resolve()
            if not str(resolved).startswith(str(base_res)):
                self._json(403, {'error': 'Forbidden'})
                return
        except Exception:
            self._json(403, {'error': 'Forbidden'})
            return
        if not file_path.is_file():
            self._json(404, {'error': 'Not found'})
            return
        data = file_path.read_bytes()
        self.send_response(200)
        for k, v in self._cors_headers({'Content-Type': 'text/plain; charset=utf-8'}).items():
            self.send_header(k, v)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return self.rfile.read(length) if length > 0 else b''

    # ── Routing ───────────────────────────────────────────────────────────────

    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in _CORS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        parsed   = urlparse(self.path)
        url_path = parsed.path
        qs       = parse_qs(parsed.query)

        # ── GET /api/source/controls/ ─────────────────────────────────────────
        if url_path in ('/api/source/controls/', '/api/source/controls'):
            try:
                files = sorted(f for f in os.listdir(_CONTROLS_DIR) if f.endswith('.js'))
                self._json(200, files)
            except Exception as e:
                self._json(500, {'error': str(e)})
            return

        # ── GET /api/source/controls/:file ────────────────────────────────────
        if url_path.startswith('/api/source/controls/'):
            fname = url_path[len('/api/source/controls/'):]
            if '/' in fname or not fname.endswith('.js'):
                self._json(400, {'error': 'Filename must be a single .js file'})
                return
            self._serve_source_text(_CONTROLS_DIR / fname, _CONTROLS_DIR)
            return

        # ── GET /api/source/ ──────────────────────────────────────────────────
        if url_path in ('/api/source/', '/api/source'):
            try:
                files = sorted(
                    f for f in os.listdir(_SRC_DIR)
                    if f.endswith('.js') and (_SRC_DIR / f).is_file()
                )
                self._json(200, files)
            except Exception as e:
                self._json(500, {'error': str(e)})
            return

        # ── GET /api/source/:file ─────────────────────────────────────────────
        if url_path.startswith('/api/source/'):
            fname = url_path[len('/api/source/'):]
            if '/' in fname or not fname.endswith('.js'):
                self._json(400, {'error': 'Filename must be a single .js file with no path separators'})
                return
            self._serve_source_text(_SRC_DIR / fname, _SRC_DIR)
            return

        # ── GET /api/logs ─────────────────────────────────────────────────────
        if url_path == '/api/logs':
            context = (qs.get('control') or qs.get('context') or [None])[0]
            level   = (qs.get('level') or [None])[0]
            limit   = min(int((qs.get('limit') or ['200'])[0]), 1000)
            rows    = _db.query_logs(context, level, limit) if _DB_AVAILABLE else []
            self._json(200, rows)
            return

        # ── GET /src/... — serve ES modules ──────────────────────────────────
        if url_path.startswith('/src/'):
            rel       = url_path[len('/src/'):]
            file_path = (_SRC_DIR / rel).resolve()
            if not str(file_path).startswith(str(_SRC_DIR.resolve())):
                self._json(403, {'error': 'Forbidden'})
                return
            self._serve_file(file_path)
            return

        # ── / or /index.html ──────────────────────────────────────────────────
        if url_path in ('/', '/index.html'):
            self._serve_file(_DIST_DIR / 'index.html')
            return

        # ── Everything else → dist/ ───────────────────────────────────────────
        rel       = url_path.lstrip('/')  or 'index.html'
        file_path = (_DIST_DIR / rel).resolve()
        if not str(file_path).startswith(str(_DIST_DIR.resolve())):
            self._json(403, {'error': 'Forbidden'})
            return
        self._serve_file(file_path)

    def do_POST(self):
        parsed   = urlparse(self.path)
        url_path = parsed.path

        # ── POST /api/logs ────────────────────────────────────────────────────
        if url_path == '/api/logs':
            raw = self._read_body()
            if not raw:
                self._json(400, {'error': 'Empty body'})
                return
            try:
                body = json.loads(raw)
            except Exception:
                self._json(400, {'error': 'Invalid JSON'})
                return

            level   = (body.get('level')   or 'message').lower()
            context = (body.get('context') or 'unknown').strip()
            message = (body.get('message') or '').strip()
            if not message:
                self._json(400, {'error': 'message is required'})
                return

            if level not in _db.VALID_LEVELS if _DB_AVAILABLE else True:
                level = 'message'

            if _DB_AVAILABLE:
                _db.insert_log(
                    level,
                    context,
                    message,
                    detail=body.get('detail'),
                    instance_id=body.get('instance_id'),
                )
                self._json(201, {'ok': True})
            else:
                self._json(503, {'error': 'Logger unavailable (db.py not loaded)'})
            return

        self._json(404, {'error': 'Not found'})


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    server = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print()
    print('JSON-Control Python server running (mirror universe)')
    print()
    print(f'  Index:  http://localhost:{PORT}/')
    print()
    print('  API:')
    print('    GET  /api/source/controls/  list all control files')
    print('    GET  /api/source/controls/:file')
    print('    GET  /api/source/           list top-level src/ files')
    print('    GET  /api/source/:file')
    print('    GET  /api/logs[?control=&level=&limit=]')
    print('    POST /api/logs  { level, context, message, detail? }')
    print()
    print('Press Ctrl-C to stop.')
    print()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
