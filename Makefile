# AnchorMarks Development Shortcuts
# Usage: make <target>

.PHONY: install run dev start stop test test-watch test-coverage lint clean docker-build docker-run docker-up docker-down help

# Default target
.DEFAULT_GOAL := help

#-----------------------------------
# Installation
#-----------------------------------

install: ## Install dependencies
	npm install

# Load environment variables from .env if it exists
-include .env
export

# Default port if not set
PORT ?= 3000

#-----------------------------------
# Running the Application
#-----------------------------------

run: ## Start the server (alias for start)
	npm start

start: ## Start the server
	npm start

dev: ## Start in development mode
	npm run dev

prod: ## Start in production mode
	npm run prod

stop: ## Stop server running on configured PORT
	@echo "Stopping any process on port $(PORT)..."
	-@lsof -ti:$(PORT) | xargs -r kill -9 2>/dev/null || true
	@echo "Done."

restart: stop start ## Restart the server

#-----------------------------------
# Testing
#-----------------------------------

test: ## Run tests
	npm test

test-watch: ## Run tests in watch mode
	npm run test:watch

test-coverage: ## Run tests with coverage report
	npm run test:coverage

#-----------------------------------
# Docker
#-----------------------------------

docker-build: ## Build Docker image
	npm run docker:build

docker-run: ## Run Docker container
	npm run docker:run

docker-up: ## Start with Docker Compose
	docker-compose up -d

docker-down: ## Stop Docker Compose
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f

#-----------------------------------
# Maintenance
#-----------------------------------

clean: ## Clean node_modules and build artifacts
	rm -rf node_modules
	rm -rf coverage

reinstall: clean install ## Clean and reinstall dependencies

#-----------------------------------
# Help
#-----------------------------------

help: ## Show this help message
	@echo "AnchorMarks Development Commands"
	@echo "=============================="
	@grep -hE '^[a-zA-Z0-9_.-]+:.*##' $(MAKEFILE_LIST) | sort | \
	  awk 'BEGIN {FS=":.*##"} {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
