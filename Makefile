# Local development — run everything with one command: `make` or `make local`
# Requires: Node.js 20+, npm, and a Supabase project (.env.local).

.PHONY: default local install setup-env dev quick build lint clean help

default: local

help:
	@echo "Targets:"
	@echo "  make | make local   Install deps, ensure .env.local, start Next dev server"
	@echo "  make install        npm install only"
	@echo "  make setup-env      Create .env.local from .env.example if missing"
	@echo "  make dev            npm run dev (no install)"
	@echo "  make quick          Alias for dev"
	@echo "  make build          npm run build"
	@echo "  make lint           npm run lint"
	@echo "  make clean          rm -rf .next node_modules"

local: install setup-env dev

install:
	npm install

setup-env:
	@if [ ! -f .env.local ]; then \
		cp .env.example .env.local; \
		echo ""; \
		echo ">>> Created .env.local from .env.example — edit it with your Supabase URL and anon key."; \
		echo ""; \
	fi

dev:
	npm run dev

quick: dev

build:
	npm run build

lint:
	npm run lint

clean:
	rm -rf .next node_modules
