# ============================================================================
# AnchorMarks Makefile - Build, Test, Start & Debug Helper
# ============================================================================
# FILE ORGANIZATION NOTE
# ============================================================================
# Targets in this Makefile are ordered to match the categories shown by
# `make help` for easy discoverability: BUILD, RUN, TEST, LINT, CLEANUP,
# UTILITY, DOCKER, OTHER.
#
# Run `make help` to list available targets and their descriptions.

.PHONY: help \
	build-frontend build-docker build-test-docker \
	start start-backend start-frontend start-all start-docker start-prod stop stop-all restart-all \
	test-backend test-backend-local test-frontend test-frontend-local test-all test-coverage \
	test-backend-watch test-frontend-watch \
	test-docker test-docker-backend test-docker-frontend \
	test-e2e test-e2e-ui test-e2e-debug test-e2e-headed \
	lint-code lint-check lint-backend lint-frontend \
	clean clean-frontend clean-all reinstall-deps \
	install install-deps install-deploy \
	stop-docker restart-docker logs shell logs-docker shell-docker rebuild-docker \
	create-demo-gif capture-screenshots

# Variables
ROOT_DIR := $(CURDIR)
APP_DIR := $(ROOT_DIR)/apps
BACKEND_DIR := $(APP_DIR)/server
FRONTEND_DIR := $(APP_DIR)/client
# Docker: compose, Dockerfile, and entrypoint live in tooling/docker. Database in container: /apps/database.
DOCKER_COMPOSE := tooling/docker/docker-compose.yml
ENV_FILE := $(CURDIR)/.env
DOCKER_CMD := docker compose --env-file $(ENV_FILE) -f $(DOCKER_COMPOSE)
DOCKER_DB_DIR := $(APP_DIR)/database

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# Default target
.DEFAULT_GOAL := help

# ============================================================================
# HELP
# ============================================================================
help: ## Display this help screen
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║         AnchorMarks - Build, Test, Start & Debug Helper            ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)BUILD TARGETS:$(NC)"
	@grep -E '^[A-Za-z0-9_.-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^build|^rebuild' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-30s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)RUN TARGETS:$(NC)"
	@grep -E '^[A-Za-z0-9_.-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^start|^stop|^restart' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-30s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)TEST TARGETS:$(NC)"
	@grep -E '^[A-Za-z0-9_.-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^test' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-30s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)LINT TARGETS:$(NC)"
	@grep -E '^[A-Za-z0-9_.-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^lint' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-30s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)INSTALLATION & CLEANUP TARGETS:$(NC)"
	@grep -E '^[A-Za-z0-9_.-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^install|^clean|^reinstall' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-30s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)OTHER TARGETS:$(NC)"
	@grep -E '^[A-Za-z0-9_.-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -vE '^(build|run|start|stop|restart|test|docker|rebuild|lint|clean|reinstall|install)' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-30s$(NC) %s\n", $$1, $$2}'
	@echo ""

# ============================================================================
# BUILD/REBUILD TARGETS
# ============================================================================
build-frontend: ## Build frontend for production
	@echo "$(BLUE)Building frontend for production...$(NC)"
	@cd $(FRONTEND_DIR) && npx vite build && npx esbuild src/shared/folders-utils-browser.ts --bundle --platform=browser --format=iife --outfile=../server/public/js/folders-utils.js --minify
	@echo "$(GREEN)✓ Frontend built successfully$(NC)"

build-docker: ## Build Docker containers (anchormarks image; entrypoint ensures /apps/database is writable)
	@echo "$(BLUE)Building Docker containers...$(NC)"
	@$(DOCKER_CMD) build anchormarks
	@echo "$(GREEN)✓ Docker containers built$(NC)"

build-test-docker: ## Build test Docker container (used by test-docker-* targets)
	@echo "$(BLUE)Building test Docker container...$(NC)"
	@$(DOCKER_CMD) --profile test build test
	@echo "$(GREEN)✓ Test Docker container built$(NC)"

rebuild-docker: ## Rebuild Docker containers from scratch (ensures database dir exists for volume mount)
	@echo "$(BLUE)Rebuilding Docker containers...$(NC)"
	@mkdir -p $(DOCKER_DB_DIR)
	@$(DOCKER_CMD) down && $(DOCKER_CMD) build --no-cache anchormarks && $(DOCKER_CMD) up -d
	@echo "$(GREEN)✓ Docker containers rebuilt$(NC)"

# ============================================================================
# START/STOP TARGETS
# ============================================================================
start: start-all ## Alias for start-all (start backend and frontend)

start-backend: ## Start backend server in development mode
	@echo "$(BLUE)Starting backend server...$(NC)"
	NODE_ENV=development node $(BACKEND_DIR)

start-frontend: ## Start frontend dev server with Vite
	@echo "$(BLUE)Starting Vite dev server...$(NC)"
	@cd $(FRONTEND_DIR) && npx vite

start-all: ## Start both backend and frontend concurrently
	@echo "$(BLUE)Starting development environment...$(NC)"
	@npx concurrently "make start-backend" "make start-frontend"

start-docker: ## Start Docker containers in background (no log follow); ensures apps/database exists
	@echo "$(BLUE)Starting Docker containers in background...$(NC)"
	@mkdir -p $(DOCKER_DB_DIR)
	@$(DOCKER_CMD) up -d --build
	@echo "$(GREEN)✓ Containers started. Use 'make logs-docker' to follow logs.$(NC)"

start-prod: ## Start server in production mode (on host)
	@echo "$(BLUE)Starting production server...$(NC)"
	NODE_ENV=production node $(BACKEND_DIR)

stop: stop-all ## Alias for stop-all (stop dev processes)

stop-all: ## Stop all running development processes
	@$(MAKE) stop-docker
	@echo "$(BLUE)Stopping development processes...$(NC)"
	. $(ENV_FILE) 2>/dev/null || true; \
	PORT=$$(printf '%s' "$${PORT:-3000}" | tr -d '\r'); \
	VITE_PORT=$$(printf '%s' "$${VITE_PORT:-5173}" | tr -d '\r'); \
	BACKEND_PID=$$(lsof -ti:$$PORT 2>/dev/null); \
	VITE_PID=$$(lsof -ti:$$VITE_PORT 2>/dev/null); \
	[ -n "$$BACKEND_PID" ] && kill -9 $$BACKEND_PID && echo "$(GREEN)✓ Stopped backend process $$BACKEND_PID on port $$PORT$(NC)" || echo "$(YELLOW)⚠ No backend process found on port $$PORT$(NC)"; \
	[ -n "$$VITE_PID" ] && kill -9 $$VITE_PID && echo "$(GREEN)✓ Stopped Vite process $$VITE_PID on port $$VITE_PORT$(NC)" || echo "$(YELLOW)⚠ No Vite process found on port $$VITE_PORT$(NC)"

stop-docker: ## Stop Docker containers
	@echo "$(BLUE)Stopping Docker containers...$(NC)"
	@$(DOCKER_CMD) down
	@echo "$(GREEN)✓ Docker containers stopped$(NC)"

restart-docker: stop-docker start-docker ## Restart Docker containers

restart-all: stop-all start-all ## Restart all development processes

# ============================================================================
# TEST TARGETS (default: run in Docker to avoid native addon/libc issues)
# ============================================================================
test: test-all ## Run all tests (alias for test-all)

test-backend-local: ## Run backend tests on host (requires compatible better-sqlite3 build)
	@echo "$(BLUE)Running backend tests on host...$(NC)"
	@cd $(BACKEND_DIR) && npm run test
	@echo "$(GREEN)✓ Backend tests completed$(NC)"

test-backend-watch: ## Run backend tests in watch mode
	@echo "$(BLUE)Running backend tests in watch mode...$(NC)"
	@cd $(BACKEND_DIR) && npm run test:watch

test-frontend: test-docker-frontend ## Run frontend tests (in Docker)

test-frontend-local: ## Run frontend tests on host
	@echo "$(BLUE)Running frontend tests on host...$(NC)"
	@cd $(FRONTEND_DIR) && npm run test
	@echo "$(GREEN)✓ Frontend tests completed$(NC)"

test-frontend-watch: ## Run frontend tests in watch mode
	@echo "$(BLUE)Running frontend tests in watch mode...$(NC)"
	@cd $(FRONTEND_DIR) && npm run test:watch

test-all: test-docker ## Run all tests (backend + frontend in Docker)

test-coverage: ## Generate test coverage reports
	@echo "$(BLUE)Generating test coverage...$(NC)"
	@cd $(FRONTEND_DIR) && npm run test:coverage
	@echo "$(GREEN)✓ Coverage report generated$(NC)"

test-docker: build-test-docker ## Run all tests in Docker container
	@echo "$(BLUE)Running tests in Docker container...$(NC)"
	@docker run --rm docker-test:latest sh -c "cd /apps/server && npm run test && cd /apps/client && npm run test"
	@echo "$(GREEN)✓ Docker tests completed$(NC)"

test-docker-backend: build-test-docker ## Run backend tests in Docker container
	@echo "$(BLUE)Running backend tests in Docker container...$(NC)"
	@docker run --rm docker-test:latest sh -c "cd /apps/server && npm run test"
	@echo "$(GREEN)✓ Backend tests completed$(NC)"

test-docker-frontend: build-test-docker ## Run frontend tests in Docker container
	@echo "$(BLUE)Running frontend tests in Docker container...$(NC)"
	@docker run --rm docker-test:latest sh -c "cd /apps/client && npm run test"
	@echo "$(GREEN)✓ Frontend tests completed$(NC)"

test-e2e: ## Run E2E tests with Playwright
	@echo "$(BLUE)Running E2E tests with Docker Compose...$(NC)"
	@echo "$(BLUE)Starting services...$(NC)"
	@NODE_ENV=development $(DOCKER_CMD) up -d
	@echo "$(BLUE)Waiting for services to be ready...$(NC)"
	@timeout 30 sh -c 'until curl -s http://localhost:3000/api/health > /dev/null 2>&1; do sleep 1; done' || (echo "$(RED)Service failed to start. Container logs:$(NC)"; $(DOCKER_CMD) logs anchormarks; $(DOCKER_CMD) down; exit 1)
	@echo "$(BLUE)Installing Playwright browsers...$(NC)"
	@npx playwright install --with-deps || true
	@echo "$(BLUE)Running tests...$(NC)"
	@USE_DOCKER=1 npx playwright test --config=tooling/e2e/playwright.config.ts || (echo "$(RED)Tests failed$(NC)"; $(DOCKER_CMD) down; exit 1)
	@echo "$(BLUE)Stopping services...$(NC)"
	@$(DOCKER_CMD) down
	@echo "$(GREEN)✓ E2E tests completed$(NC)"

test-e2e-ui: ## Run E2E tests with Playwright UI mode
	@echo "$(BLUE)Running E2E tests in UI mode with Docker Compose...$(NC)"
	@echo "$(BLUE)Starting services...$(NC)"
	@NODE_ENV=development $(DOCKER_CMD) up -d
	@echo "$(BLUE)Waiting for services to be ready...$(NC)"
	@timeout 30 sh -c 'until curl -s http://localhost:3000/api/health > /dev/null 2>&1; do sleep 1; done' || (echo "$(RED)Service failed to start$(NC)"; $(DOCKER_CMD) down; exit 1)
	@echo "$(BLUE)Installing Playwright browsers...$(NC)"
	@npx playwright install --with-deps || true
	@echo "$(BLUE)Opening Playwright UI...$(NC)"
	@USE_DOCKER=1 npx playwright test --config=tooling/e2e/playwright.config.ts --ui || (echo "$(RED)Tests failed$(NC)"; $(DOCKER_CMD) down; exit 1)
	@echo "$(BLUE)Stopping services...$(NC)"
	@$(DOCKER_CMD) down
	@echo "$(GREEN)✓ E2E tests completed$(NC)"

test-e2e-debug: ## Run E2E tests in debug mode
	@echo "$(BLUE)Running E2E tests in debug mode with Docker Compose...$(NC)"
	@echo "$(BLUE)Starting services...$(NC)"
	@NODE_ENV=development $(DOCKER_CMD) up -d
	@echo "$(BLUE)Waiting for services to be ready...$(NC)"
	@timeout 30 sh -c 'until curl -s http://localhost:3000/api/health > /dev/null 2>&1; do sleep 1; done' || (echo "$(RED)Service failed to start$(NC)"; $(DOCKER_CMD) down; exit 1)
	@echo "$(BLUE)Installing Playwright browsers...$(NC)"
	@npx playwright install --with-deps || true
	@echo "$(BLUE)Running tests in debug mode...$(NC)"
	@USE_DOCKER=1 npx playwright test --config=tooling/e2e/playwright.config.ts --debug || (echo "$(RED)Tests failed$(NC)"; $(DOCKER_CMD) down; exit 1)
	@echo "$(BLUE)Stopping services...$(NC)"
	@$(DOCKER_CMD) down
	@echo "$(GREEN)✓ E2E tests completed$(NC)"

test-e2e-headed: ## Run E2E tests in headed mode (visible browser)
	@echo "$(BLUE)Running E2E tests in headed mode with Docker Compose...$(NC)"
	@echo "$(BLUE)Starting services...$(NC)"
	@NODE_ENV=development $(DOCKER_CMD) up -d
	@echo "$(BLUE)Waiting for services to be ready...$(NC)"
	@timeout 30 sh -c 'until curl -s http://localhost:3000/api/health > /dev/null 2>&1; do sleep 1; done' || (echo "$(RED)Service failed to start$(NC)"; $(DOCKER_CMD) down; exit 1)
	@echo "$(BLUE)Installing Playwright browsers...$(NC)"
	@npx playwright install --with-deps || true
	@echo "$(BLUE)Running tests in headed mode...$(NC)"
	@USE_DOCKER=1 npx playwright test --config=tooling/e2e/playwright.config.ts --headed || (echo "$(RED)Tests failed$(NC)"; $(DOCKER_CMD) down; exit 1)
	@echo "$(BLUE)Stopping services...$(NC)"
	@$(DOCKER_CMD) down
	@echo "$(GREEN)✓ E2E tests completed$(NC)"

# ============================================================================
# LINT & FORMAT TARGETS
# ============================================================================
lint: lint-code ## Alias for lint-code (lint and format code)

lint-code: ## Lint and format code
	@echo "$(BLUE)Linting and formatting code...$(NC)"
	npx eslint "**/*.js" --config tooling/eslint.config.cjs --fix && npx prettier . --write
	@echo "$(GREEN)✓ Code linted and formatted$(NC)"


lint-check: ## Check linting without fixing
	@echo "$(BLUE)Checking code linting...$(NC)"
	npx eslint "**/*.js" --config tooling/eslint.config.cjs && npx prettier . --check
	@echo "$(GREEN)✓ Linting check passed$(NC)"

lint-backend: ## Lint backend code only
	@echo "$(BLUE)Linting backend code...$(NC)"
	npx eslint $(BACKEND_DIR) --config tooling/eslint.config.cjs --fix
	@echo "$(GREEN)✓ Backend linting completed$(NC)"

lint-frontend: ## Lint frontend code only
	@echo "$(BLUE)Linting frontend code...$(NC)"
	npx eslint $(FRONTEND_DIR) --config tooling/eslint.config.cjs --fix
	@echo "$(GREEN)✓ Frontend linting completed$(NC)"


# ============================================================================
# CLEANUP TARGETS
# ============================================================================
clean: clean-all ## Alias for clean-all (clean all artifacts)

clean-frontend: ## Clean frontend build artifacts
	@echo "$(BLUE)Cleaning frontend...$(NC)"
	@cd $(BACKEND_DIR) && rm -rf node_modules
	@cd $(FRONTEND_DIR) && rm -rf dist
	@echo "$(GREEN)✓ Frontend cleaned$(NC)"

clean-all: clean-frontend ## Clean all build artifacts
	@echo "$(BLUE)Cleaning all build artifacts...$(NC)"
	@cd $(BACKEND_DIR) && rm -rf dist
	@cd $(FRONTEND_DIR) && rm -rf node_modules
	@cd $(ROOT_DIR) && rm -rf node_modules
	@echo "$(GREEN)✓ All artifacts cleaned$(NC)"

reinstall-deps: clean-all ## Clean and reinstall dependencies
	@echo "$(BLUE)Reinstalling dependencies...$(NC)"
	@rm -rf node_modules
	@npm install
	@echo "$(GREEN)✓ Dependencies reinstalled$(NC)"

# ============================================================================
# UTILITY TARGETS
# ============================================================================
install: install-deps ## Alias for install-deps (install dependencies)

install-deps: ## Install all dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	@npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

install-deploy: ## Install for deployment
	@echo "$(BLUE)Installing for deployment...$(NC)"
	@sudo bash tooling/deploy/install.sh
	@echo "$(GREEN)✓ Deployment installation completed$(NC)"

create-demo-gif: ## Create demo GIF
	@echo "$(BLUE)Creating demo GIF...$(NC)"
	@bash tooling/scripts/make-demo-gif.sh
	@echo "$(GREEN)✓ Demo GIF created$(NC)"

capture-screenshots: ## Capture screenshots
	@echo "$(BLUE)Capturing screenshots...$(NC)"
	@node tooling/scripts/capture-screenshots.js
	@echo "$(GREEN)✓ Screenshots captured$(NC)"

logs: logs-docker ## Alias for logs-docker (follow Docker logs)

logs-docker: ## Follow Docker container logs
	@echo "$(BLUE)Following Docker logs...$(NC)"
	@$(DOCKER_CMD) logs -f

shell: shell-docker ## Alias for shell-docker (shell in Docker container)

shell-docker: ## Open shell in Docker container
	@$(DOCKER_CMD) exec -it anchormarks /bin/sh

