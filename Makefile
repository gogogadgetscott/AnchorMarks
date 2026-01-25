# AnchorMarks Makefile - Build, Test, Run & Debug Helper

.PHONY: help build build-backend build-frontend run run-dev run-backend run-frontend run-docker \
	test test-backend test-frontend test-backend-watch test-frontend-watch test-coverage test-all lint lint-check fmt clean clean-backend clean-frontend \
	e2e e2e-ui e2e-debug e2e-headed \
	docker-build docker-rebuild docker-up docker-down docker-restart docker-logs docker-shell \
	install dev dev-full dev-vite restart stop prod deploy-install demo-gif screenshots \
	backend-start backend-dev backend-lint frontend-build frontend-preview frontend-lint frontend-test

# Variables
BACKEND_DIR := apps/server
FRONTEND_DIR := apps/client
DOCKER_COMPOSE := tooling/docker/docker-compose.yml
DOCKER_CMD := docker compose --env-file ./.env -f $(DOCKER_COMPOSE)

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
	@echo "$(BLUE)║           AnchorMarks - Build, Test, Run & Debug Helper            ║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)BUILD TARGETS:$(NC)"
	@grep -E '^[A-Za-z0-9_.-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^build' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)RUN TARGETS:$(NC)"
	@grep -E '^[A-Za-z0-9_.-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^run|^dev|^prod|^start|^stop|^restart|^backend|^frontend' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)TEST TARGETS:$(NC)"
	@grep -E '^[A-Za-z0-9_.-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^test|^e2e' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)DOCKER TARGETS:$(NC)"
	@grep -E '^[A-Za-z0-9_.-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^docker' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)CLEANUP TARGETS:$(NC)"
	@grep -E '^[A-Za-z0-9_.-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^clean|^reinstall' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(GREEN)UTILITY TARGETS:$(NC)"
	@grep -E '^[A-Za-z0-9_.-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '^lint|^fmt|^install|^deploy|^demo|^screenshots' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-25s$(NC) %s\n", $$1, $$2}'
	@echo ""

# ============================================================================
# BUILD TARGETS
# ============================================================================
build: frontend-build ## Build frontend for production

build-frontend: frontend-build ## Build Vite frontend (alias)

# ============================================================================
# RUN TARGETS
# ============================================================================
run: run-dev ## Run in development mode (default)

run-dev: dev-full ## Run both backend and frontend in development

run-backend: dev ## Run backend server in development

run-frontend: dev-vite ## Run frontend dev server

run-docker: docker-up ## Run using Docker Compose

run-prod: prod ## Run in production mode

dev: ## Start backend server in development mode
	@echo "$(BLUE)Starting backend server...$(NC)"
	NODE_ENV=development node $(BACKEND_DIR)

dev-vite: ## Start Vite dev server for frontend
	@echo "$(BLUE)Starting Vite dev server...$(NC)"
	@cd $(FRONTEND_DIR) && npx vite

dev-full: ## Start both backend and frontend concurrently
	@echo "$(BLUE)Starting development environment...$(NC)"
	@npx concurrently "make dev" "make dev-vite"

frontend-build: ## Build frontend for production
	@echo "$(BLUE)Building frontend for production...$(NC)"
	@cd $(FRONTEND_DIR) && npx vite build && npx esbuild src/shared/folders-utils-browser.ts --bundle --platform=browser --format=iife --global-name=foldersUtils --outfile=../server/public/js/folders-utils.js --minify
	@echo "$(GREEN)✓ Frontend built successfully$(NC)"

frontend-preview: ## Preview production build
	@echo "$(BLUE)Previewing production build...$(NC)"
	@cd $(FRONTEND_DIR) && npx vite preview

frontend-lint: ## Lint frontend code
	@echo "$(BLUE)Linting frontend code...$(NC)"
	@cd $(FRONTEND_DIR) && npm run lint || true
	@echo "$(GREEN)✓ Frontend linting completed$(NC)"

frontend-test: ## Run frontend tests
	@echo "$(BLUE)Running frontend tests...$(NC)"
	@cd $(FRONTEND_DIR) && npx vitest run
	@echo "$(GREEN)✓ Frontend tests completed$(NC)"

prod: ## Start server in production mode
	@echo "$(BLUE)Starting production server...$(NC)"
	NODE_ENV=production node $(BACKEND_DIR)

backend-start: ## Start backend server (alias for dev)
	@echo "$(BLUE)Starting backend server...$(NC)"
	NODE_ENV=development node $(BACKEND_DIR)

backend-dev: dev ## Start backend in development mode

backend-lint: ## Lint backend code
	@echo "$(BLUE)Linting backend code...$(NC)"
	@cd $(BACKEND_DIR) && npx eslint . --fix
	@echo "$(GREEN)✓ Backend linting completed$(NC)"

stop: ## Stop running development processes
	@echo "$(BLUE)Stopping development processes...$(NC)"
	. ./.env 2>/dev/null || true; \
	PORT=$$(printf '%s' "$${PORT:-3000}" | tr -d '\r'); \
	VITE_PORT=$$(printf '%s' "$${VITE_PORT:-5173}" | tr -d '\r'); \
	BACKEND_PID=$$(lsof -ti:$$PORT 2>/dev/null); \
	VITE_PID=$$(lsof -ti:$$VITE_PORT 2>/dev/null); \
	[ -n "$$BACKEND_PID" ] && kill -9 $$BACKEND_PID && echo "$(GREEN)✓ Stopped backend process $$BACKEND_PID on port $$PORT$(NC)" || echo "$(YELLOW)⚠ No backend process found on port $$PORT$(NC)"; \
	[ -n "$$VITE_PID" ] && kill -9 $$VITE_PID && echo "$(GREEN)✓ Stopped Vite process $$VITE_PID on port $$VITE_PORT$(NC)" || echo "$(YELLOW)⚠ No Vite process found on port $$VITE_PORT$(NC)"

restart: stop start ## Restart development processes

# ============================================================================
# TEST TARGETS
# ============================================================================
test: test-all ## Run all tests

test-backend: ## Run backend tests
	@echo "$(BLUE)Running backend tests...$(NC)"
	@cd $(BACKEND_DIR) && npx vitest run
	@echo "$(GREEN)✓ Backend tests completed$(NC)"

test-backend-watch: ## Run backend tests in watch mode
	@echo "$(BLUE)Running backend tests in watch mode...$(NC)"
	@cd $(BACKEND_DIR) && npx vitest

test-frontend: ## Run frontend tests
	@echo "$(BLUE)Running frontend tests...$(NC)"
	@cd $(FRONTEND_DIR) && npx vitest run
	@echo "$(GREEN)✓ Frontend tests completed$(NC)"

test-frontend-watch: ## Run frontend tests in watch mode
	@echo "$(BLUE)Running frontend tests in watch mode...$(NC)"
	@cd $(FRONTEND_DIR) && npx vitest

test-coverage: ## Generate test coverage reports
	@echo "$(BLUE)Generating test coverage...$(NC)"
	@cd $(FRONTEND_DIR) && npx vitest run --coverage
	@echo "$(GREEN)✓ Coverage report generated$(NC)"

test-all: test-backend test-frontend ## Run all tests

# ============================================================================
# E2E TEST TARGETS
# ============================================================================
e2e: ## Run E2E tests with Playwright
	@echo "$(BLUE)Running E2E tests...$(NC)"
	@npx playwright test
	@echo "$(GREEN)✓ E2E tests completed$(NC)"

e2e-ui: ## Run E2E tests with Playwright UI mode
	@echo "$(BLUE)Running E2E tests in UI mode...$(NC)"
	@npx playwright test --ui

e2e-debug: ## Run E2E tests in debug mode
	@echo "$(BLUE)Running E2E tests in debug mode...$(NC)"
	@npx playwright test --debug

e2e-headed: ## Run E2E tests in headed mode (visible browser)
	@echo "$(BLUE)Running E2E tests in headed mode...$(NC)"
	@npx playwright test --headed

# ============================================================================
# LINT & FORMAT TARGETS
# ============================================================================
lint: ## Lint and format code
	@echo "$(BLUE)Linting and formatting code...$(NC)"
	npx eslint "**/*.js" --config tooling/eslint.config.cjs --fix && npx prettier . --write
	@echo "$(GREEN)✓ Code linted and formatted$(NC)"

lint-check: ## Check linting without fixing
	@echo "$(BLUE)Checking code linting...$(NC)"
	npx eslint "**/*.js" --config tooling/eslint.config.cjs && npx prettier . --check
	@echo "$(GREEN)✓ Linting check passed$(NC)"

# ============================================================================
# DOCKER TARGETS
# ============================================================================
docker-build: ## Build Docker containers
	@echo "$(BLUE)Building Docker containers...$(NC)"
	@$(DOCKER_CMD) build
	@echo "$(GREEN)✓ Docker containers built$(NC)"

docker-rebuild: ## Rebuild Docker containers from scratch
	@echo "$(BLUE)Rebuilding Docker containers...$(NC)"
	@$(DOCKER_CMD) down && $(DOCKER_CMD) build --no-cache && $(DOCKER_CMD) up -d
	@echo "$(GREEN)✓ Docker containers rebuilt$(NC)"

docker-up: ## Start Docker containers
	@echo "$(BLUE)Starting Docker containers...$(NC)"
	@$(DOCKER_CMD) pull && $(DOCKER_CMD) up -d && $(DOCKER_CMD) logs -f

docker-down: ## Stop Docker containers
	@echo "$(BLUE)Stopping Docker containers...$(NC)"
	@$(DOCKER_CMD) down
	@echo "$(GREEN)✓ Docker containers stopped$(NC)"

docker-restart: ## Restart Docker containers
	@echo "$(BLUE)Restarting Docker containers...$(NC)"
	@$(DOCKER_CMD) restart
	@echo "$(GREEN)✓ Docker containers restarted$(NC)"

docker-logs: ## Follow Docker container logs
	@echo "$(BLUE)Following Docker logs...$(NC)"
	@$(DOCKER_CMD) logs -f

docker-shell: ## Open shell in Docker container
	@$(DOCKER_CMD) exec -it anchormarks /bin/sh

# ============================================================================
# CLEANUP TARGETS
# ============================================================================
clean: clean-frontend ## Clean build artifacts

clean-frontend: ## Clean frontend build artifacts
	@echo "$(BLUE)Cleaning frontend...$(NC)"
	@cd $(FRONTEND_DIR) && rm -rf dist
	@echo "$(GREEN)✓ Frontend cleaned$(NC)"

reinstall: clean ## Clean and reinstall dependencies
	@echo "$(BLUE)Reinstalling dependencies...$(NC)"
	@rm -rf node_modules
	@npm install
	@echo "$(GREEN)✓ Dependencies reinstalled$(NC)"

# ============================================================================
# UTILITY TARGETS
# ============================================================================
install: ## Install all dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	@npm install
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

deploy-install: ## Install for deployment
	@echo "$(BLUE)Installing for deployment...$(NC)"
	@sudo bash tooling/deploy/install.sh
	@echo "$(GREEN)✓ Deployment installation completed$(NC)"

demo-gif: ## Create demo GIF
	@echo "$(BLUE)Creating demo GIF...$(NC)"
	@bash tooling/scripts/make-demo-gif.sh
	@echo "$(GREEN)✓ Demo GIF created$(NC)"

screenshots: ## Capture screenshots
	@echo "$(BLUE)Capturing screenshots...$(NC)"
	@node tooling/scripts/capture-screenshots.js
	@echo "$(GREEN)✓ Screenshots captured$(NC)"
	