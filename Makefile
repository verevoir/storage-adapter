.PHONY: build test lint run

build: ## Compile TypeScript
	npx tsup

test: ## Run test suite
	npx vitest run

lint: ## Lint and check formatting
	npx eslint .
	npx prettier --check .

run: ## No-op (library)
	@echo "@verevoir/storage is a library, not a service."
