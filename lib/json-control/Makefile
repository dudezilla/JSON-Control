SHELL := /bin/bash

# ── Environment ──────────────────────────
# Load .env automatically if it exists (copy .env.example to get started).
# Variables already in the shell environment take precedence.
-include .env
export

# ── Default target ──────────────────────────
.DEFAULT_GOAL := help

.PHONY: help js python sync check-env

help: ## Display this README
	@cat README.md

# ── Dev server (Mirror Universe) ──────────────────
js: ## Start the Node.js dev server with auto-reload (port $${PORT:-7777})
	node serve-watch.js

python: ## Start the Python mirror server -- identical API (port $${PORT:-7777})
	python3 python/serve.py

# ── Database sync ─────────────────────────────────────────
sync: check-env ## Push unsynced local test results to Supabase
	node db/sync.cjs

check-env:
ifndef SUPABASE_URL
	$(error SUPABASE_URL is not set. Copy .env.example -> .env and fill in your credentials)
endif
ifndef SUPABASE_SERVICE_ROLE_KEY
	$(error SUPABASE_SERVICE_ROLE_KEY is not set. Copy .env.example -> .env and fill in your credentials)
endif
