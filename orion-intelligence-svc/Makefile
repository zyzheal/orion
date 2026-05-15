.PHONY: help install dev test lint docker-up docker-down db-migrate db-upgrade db-downgrade

help:
	@echo "Orion Intelligence Service"
	@echo ""
	@echo "Commands:"
	@echo "  install        Install dependencies with uv"
	@echo "  dev            Start development server with auto-reload"
	@echo "  test           Run test suite"
	@echo "  test-cov       Run tests with coverage report"
	@echo "  lint           Run ruff and mypy"
	@echo "  docker-up      Start full stack with docker compose"
	@echo "  docker-down    Stop docker compose stack"
	@echo "  db-migrate     Create a new database migration"
	@echo "  db-upgrade     Run database migrations"
	@echo "  db-downgrade   Rollback last database migration"

install:
	uv sync

dev:
	uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8004

test:
	uv run pytest -v

test-cov:
	uv run pytest --cov=src --cov-report=html --cov-report=term-missing

lint:
	uv run ruff check src/ tests/
	uv run ruff format --check src/ tests/
	uv run mypy src/

docker-up:
	docker compose up -d

docker-down:
	docker compose down

# Database migration commands
db-migrate:
	uv run alembic revision --autogenerate -m "$(MESSAGE)"

db-upgrade:
	uv run alembic upgrade head

db-downgrade:
	uv run alembic downgrade -1
