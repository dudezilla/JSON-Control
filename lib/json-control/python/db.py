"""
db.py — Python SQLite layer for JSON-Control.

Mirrors db/logger.cjs: log writes with instance_id, WAL mode, auto-migration.
Also provides query_logs() for GET /api/logs reads.

All writes go through a single module-level connection protected by a lock.
Reads open a fresh read-only connection per request.
"""

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────

_DB_PATH = Path(__file__).parent.parent / 'test-results.db'

# ── Constants ──────────────────────────────────────────────────────────────────

VALID_LEVELS = {'debug', 'message', 'warning', 'critical'}

_LABELS = {
    'debug':    'DEBUG',
    'message':  'MESSAGE',
    'warning':  'WARNING',
    'critical': 'CRITICAL',
}

# ── Module state ───────────────────────────────────────────────────────────────

_instance_id  = None
_write_conn   = None
_write_lock   = threading.Lock()


def set_instance_id(iid: str):
    """Set the instance ID written to every subsequent log row."""
    global _instance_id
    _instance_id = iid or None


# ── Schema / migration ─────────────────────────────────────────────────────────

def _ensure_schema(conn: sqlite3.Connection):
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS logs (
            id          TEXT    PRIMARY KEY,
            logged_at   TEXT    NOT NULL,
            level       TEXT    NOT NULL CHECK (level IN ('DEBUG','MESSAGE','WARNING','CRITICAL')),
            context     TEXT    NOT NULL,
            message     TEXT    NOT NULL,
            detail      TEXT,
            instance_id TEXT,
            synced      INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_logs_level   ON logs (level);
        CREATE INDEX IF NOT EXISTS idx_logs_context ON logs (context);
    ''')
    # Migrate pre-existing DBs that don't have instance_id yet
    cols = {row[1] for row in conn.execute('PRAGMA table_info(logs)').fetchall()}
    if 'instance_id' not in cols:
        conn.execute('ALTER TABLE logs ADD COLUMN instance_id TEXT')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_logs_instance_id ON logs (instance_id)')
    conn.commit()


def _get_write_conn() -> sqlite3.Connection:
    global _write_conn
    if _write_conn is None:
        _write_conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
        _write_conn.execute('PRAGMA journal_mode=WAL')
        _ensure_schema(_write_conn)
    return _write_conn


# ── Write ──────────────────────────────────────────────────────────────────────

def insert_log(level: str, context: str, message: str,
               detail=None, instance_id: str = None):
    """
    Insert one log row.  level must be in VALID_LEVELS; defaults to 'message'.
    detail may be any JSON-serialisable value or None.
    instance_id overrides the module-level _instance_id when supplied.
    """
    if level not in VALID_LEVELS:
        level = 'message'

    now        = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.') + \
                 f'{datetime.now(timezone.utc).microsecond // 1000:03d}Z'
    detail_str = json.dumps(detail) if detail is not None else None
    iid        = instance_id if instance_id is not None else _instance_id
    row_id     = str(uuid.uuid4())

    with _write_lock:
        conn = _get_write_conn()
        conn.execute(
            '''INSERT INTO logs
               (id, logged_at, level, context, message, detail, instance_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (row_id, now, _LABELS[level], context, message, detail_str, iid),
        )
        conn.commit()


# ── Read ───────────────────────────────────────────────────────────────────────

def query_logs(context: str = None, level: str = None, limit: int = 200):
    """
    Return log rows as a list of dicts, newest first.
    Matches the queryLogs() behaviour in serve.js.
    """
    if not _DB_PATH.exists():
        return []
    try:
        conn = sqlite3.connect(f'file:{_DB_PATH}?mode=ro', uri=True)
        conn.row_factory = sqlite3.Row

        sql  = ('SELECT id, logged_at, level, context, message, detail, instance_id '
                'FROM logs WHERE 1=1')
        args = []
        if context:
            sql  += ' AND context = ?'
            args.append(context)
        if level:
            sql  += ' AND level = ?'
            args.append(level.upper())
        sql  += ' ORDER BY logged_at DESC LIMIT ?'
        args.append(min(limit, 1000))

        rows   = conn.execute(sql, args).fetchall()
        conn.close()

        result = []
        for r in rows:
            detail = r['detail']
            if detail:
                try:
                    detail = json.loads(detail)
                except Exception:
                    pass
            result.append({
                'id':          r['id'],
                'logged_at':   r['logged_at'],
                'level':       r['level'],
                'context':     r['context'],
                'message':     r['message'],
                'detail':      detail,
                'instance_id': r['instance_id'],
            })
        return result
    except Exception:
        return []
