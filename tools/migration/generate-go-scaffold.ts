#!/usr/bin/env npx tsx
/**
 * generate-go-scaffold.ts
 *
 * Reads an OpenAPI 3.0 YAML spec and generates a complete Go service project.
 *
 * Usage:
 *   npx tsx tools/migration/generate-go-scaffold.ts <openapi-spec> --output <service-dir>
 *
 * Example:
 *   npx tsx tools/migration/generate-go-scaffold.ts api-contracts/auth-openapi.yaml --output orion-auth-svc/
 */

import * as fs from 'fs';
import * as path from 'path';

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  parameters?: Parameter[];
}

interface Operation {
  operationId?: string;
  summary?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: { content: { 'application/json'?: { schema: Schema } } };
  responses?: Record<string, { description: string; content?: { 'application/json'?: { schema: Schema } } }>;
  security?: Record<string, string[]>[];
}

interface Parameter {
  name: string;
  in: string;
  required?: boolean;
  schema?: Schema;
}

interface Schema {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  $ref?: string;
}

interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, PathItem>;
  components?: { schemas?: Record<string, Schema> };
}

function parseOpenAPI(content: string): OpenAPISpec {
  // Simple YAML parser (for production, use js-yaml)
  // For now, expect JSON or a simple YAML subset
  try {
    return JSON.parse(content) as OpenAPISpec;
  } catch {
    // Try basic YAML to JSON conversion
    throw new Error('YAML parsing not yet implemented. Please provide JSON OpenAPI spec.');
  }
}

function serviceNameFromSpec(spec: OpenAPISpec): string {
  // Extract service name from title: "Auth API" -> "auth"
  const title = spec.info.title.toLowerCase().replace(/\s+api$/i, '').replace(/\s+/g, '-');
  return title || 'service';
}

// ============================================================
// Go code generation templates
// ============================================================

function generateGoMod(serviceName: string): string {
  return `module orion/${serviceName}

go 1.22

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/jmoiron/sqlx v1.4.0
	github.com/lib/pq v1.10.9
	go.uber.org/zap v1.27.0
	github.com/golang-jwt/jwt/v5 v5.2.1
	github.com/redis/go-redis/v9 v9.5.1
	github.com/spf13/viper v1.19.0
	github.com/prometheus/client_golang v1.18.0
	go.opentelemetry.io/otel v1.24.0
	go.opentelemetry.io/otel/sdk v1.24.0
	go.opentelemetry.io/otel/trace v1.24.0
	go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin v0.49.0
)
`;
}

function generateMainGo(serviceName: string, operations: { method: string; path: string; id: string }[]): string {
  const imports = operations.map(o => {
    const handlerName = handlerFuncName(o.id);
    return `\t"${serviceName}/internal/handler"`;
  }).filter((v, i, a) => a.indexOf(v) === i).join('\n');

  const routeRegistrations = operations.map(o => {
    const methodLower = o.method.toLowerCase();
    const handlerName = handlerFuncName(o.id);
    return `\t\tv1.${methodLower}("${o.path}", h.${handlerName})`;
  }).join('\n');

  return `package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"${serviceName}/internal/config"
	"${serviceName}/internal/handler"
	"${serviceName}/internal/middleware"
	"${serviceName}/internal/otel"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"go.uber.org/zap"
)

func main() {
	// Initialize logger
	logger, _ := zap.NewProduction()
	defer logger.Sync()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	// Initialize OpenTelemetry
	shutdown, err := otel.Init(cfg.ServiceName, cfg.OTelEndpoint)
	if err != nil {
		logger.Warn("failed to init OTel", zap.Error(err))
	}
	defer shutdown(context.Background())

	// Initialize database
	db, err := sqlx.Connect("postgres", cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer db.Close()
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Initialize Redis
	rdb := middleware.NewRedisClient(cfg.RedisURL)

	// Set Gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create router
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.StructuredLogger(logger))
	r.Use(middleware.CORS())

	// Metrics endpoint
	r.GET("/metrics", middleware.MetricsHandler())

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"service":   cfg.ServiceName,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	// API routes
	v1 := r.Group("/api/v1")
	v1.Use(middleware.TenantID())
	v1.Use(middleware.Auth(rdb, cfg.JWTSecret))

	h := handler.New(db, rdb, logger)
	// Register routes
	// TODO: Wire up routes from OpenAPI spec
	_ = v1 // v1 routes go here

	logger.Info("server starting",
		zap.String("service", cfg.ServiceName),
		zap.String("addr", cfg.HTTPAddr),
	)

	srv := &http.Server{
		Addr:    cfg.HTTPAddr,
		Handler: r,
	}

	// Graceful shutdown
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server failed", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}
	logger.Info("server stopped")
}
`;
}

function handlerFuncName(operationId: string): string {
  // "get_user_list" -> "GetUserList"
  return operationId
    .split('_')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function generateHandlerGo(serviceName: string, operations: { method: string; path: string; id: string; params: Parameter[] }[]): string {
  return `package handler

import (
	"net/http"
	"strconv"

	"${serviceName}/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type Handler struct {
	db    *sqlx.DB
	rdb   *redis.Client
	logger *zap.Logger
}

func New(db *sqlx.DB, rdb *redis.Client, logger *zap.Logger) *Handler {
	return &Handler{db: db, rdb: rdb, logger: logger}
}

// Response is the standard API response envelope.
type Response struct {
	Code    int         ` + "`json:\"code\"`" + `
	Message string      ` + "`json:\"message\"`" + `
	Data    interface{} ` + "`json:\"data,omitempty\"`" + `
}

func (h *Handler) success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{Code: 0, Message: "success", Data: data})
}

func (h *Handler) error(c *gin.Context, code int, message string) {
	c.JSON(code, Response{Code: code, Message: message})
}

// === Auto-generated handlers from OpenAPI spec ===
// Each handler follows the pattern:
// 1. Extract path/query params
// 2. Validate input
// 3. Call service layer
// 4. Return response with proper error handling

${operations.map(op => {
  const funcName = handlerFuncName(op.id);
  const pathParams = op.params.filter(p => p.in === 'path');
  const queryParams = op.params.filter(p => p.in === 'query');
  return `// ${funcName} handles ${op.method.toUpperCase()} ${op.path}
func (h *Handler) ${funcName}(c *gin.Context) {
	// Extract tenant ID from context (set by middleware)
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		h.error(c, http.StatusBadRequest, "missing tenant_id")
		return
	}

	// Extract path parameters
${pathParams.map(p => `\t${p.name} := c.Param("${p.name}")`).join('\n')}
${pathParams.length === 0 ? '\t// No path parameters' : ''}

	// Extract query parameters
${queryParams.map(p => `\t${p.name} := c.Query("${p.name}")`).join('\n')}
${queryParams.length === 0 ? '\t// No query parameters' : ''}

	// TODO: Call service layer
	// result, err := h.service.${funcName}(ctx, tenantID, ${pathParams.map(p => p.name).join(', ')})
	// if err != nil {
	// 	h.logger.Error("${op.id} failed", zap.Error(err), zap.String("tenant_id", tenantID))
	// 	h.error(c, http.StatusInternalServerError, "internal error")
	// 	return
	// }
	// h.success(c, result)

	h.success(c, gin.H{"message": "endpoint ${op.id} - implementation pending"})
}
`;
}).join('\n')}
`;
}

function generateConfigGo(): string {
  return `package config

import (
	"fmt"
	"os"

	"github.com/spf13/viper"
)

type Config struct {
	ServiceName  string
	Environment  string
	HTTPAddr     string
	DatabaseURL  string
	RedisURL     string
	JWTSecret    string
	OTelEndpoint string
}

func Load() (*Config, error) {
	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("./config")
	v.AddConfigPath("/etc/orion")

	// Defaults
	v.SetDefault("service_name", "orion-service")
	v.SetDefault("environment", "development")
	v.SetDefault("http_addr", ":8080")
	v.SetDefault("database_url", "postgres://orion:orion@localhost:5432/orion?sslmode=disable")
	v.SetDefault("redis_url", "redis://localhost:6379/0")
	v.SetDefault("jwt_secret", "")
	v.SetDefault("otel_endpoint", "")

	// Environment variables override
	v.AutomaticEnv()

	// Read config file (optional)
	_ = v.ReadInConfig()

	cfg := &Config{
		ServiceName:  getEnvOrConfig("SERVICE_NAME", v.GetString("service_name")),
		Environment:  getEnvOrConfig("ENVIRONMENT", v.GetString("environment")),
		HTTPAddr:     getEnvOrConfig("HTTP_ADDR", v.GetString("http_addr")),
		DatabaseURL:  getEnvOrConfig("DATABASE_URL", v.GetString("database_url")),
		RedisURL:     getEnvOrConfig("REDIS_URL", v.GetString("redis_url")),
		JWTSecret:    getEnvOrConfig("JWT_SECRET", v.GetString("jwt_secret")),
		OTelEndpoint: getEnvOrConfig("OTEL_ENDPOINT", v.GetString("otel_endpoint")),
	}

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

func getEnvOrConfig(envKey string, fallback string) string {
	if val := os.Getenv(envKey); val != "" {
		return val
	}
	return fallback
}
`;
}

function generateMiddlewareGo(): string {
  return `package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.uber.org/zap"
)

// RequestID adds a unique request ID to the context and response header.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := generateID()
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// StructuredLogger logs each request with zap.
func StructuredLogger(logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		latency := time.Since(start)
		statusCode := c.Writer.Status()

		logger.Info("request completed",
			zap.String("method", c.Request.Method),
			zap.String("path", path),
			zap.Int("status", statusCode),
			zap.Duration("latency", latency),
			zap.String("request_id", c.GetString("request_id")),
		)
	}
}

// CORS adds CORS headers.
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Tenant-ID, X-Request-ID")
		c.Header("Access-Control-Expose-Headers", "X-Request-ID")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// TenantID extracts X-Tenant-ID from the request header.
func TenantID() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID := c.GetHeader("X-Tenant-ID")
		if tenantID == "" {
			// Allow missing tenant in development
			tenantID = "default"
		}
		c.Set("tenant_id", tenantID)
		c.Next()
	}
}

// Auth validates JWT tokens.
func Auth(rdb *redis.Client, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "missing authorization header"})
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "invalid authorization format"})
			return
		}

		// Check token blacklist
		// blocked, err := rdb.Exists(c.Request.Context(), "token:blacklist:"+tokenString).Result()
		// if err == nil && blocked > 0 {
		// 	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "token revoked"})
		// 	return
		// }

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "invalid or expired token"})
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("user_id", claims["sub"])
			c.Set("tenant_id", claims["tenant_id"])
		}

		c.Next()
	}
}

// MetricsHandler returns the Prometheus metrics endpoint handler.
func MetricsHandler() gin.HandlerFunc {
	h := promhttp.Handler()
	return func(c *gin.Context) {
		h.ServeHTTP(c.Writer, c.Request)
	}
}

// NewRedisClient creates a Redis client from URL.
func NewRedisClient(redisURL string) *redis.Client {
	opts, _ := redis.ParseURL(redisURL)
	return redis.NewClient(opts)
}

func generateID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
`;
}

function generateModelsGo(): string {
  return `package models

import "time"

// Base contains common fields for all models.
type Base struct {
	ID        string    ` + "`db:\"id\" json:\"id\"`" + `
	TenantID  string    ` + "`db:\"tenant_id\" json:\"tenant_id\"`" + `
	CreatedAt time.Time ` + "`db:\"created_at\" json:\"created_at\"`" + `
	UpdatedAt time.Time ` + "`db:\"updated_at\" json:\"updated_at\"`" + `
}

// PaginatedRequest represents a paginated list request.
type PaginatedRequest struct {
	Page     int ` + "`form:\"page\"`" + `
	PageSize int ` + "`form:\"page_size\"`" + `
}

func (p *PaginatedRequest) Offset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

func (p *PaginatedRequest) Limit() int {
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	if p.PageSize > 100 {
		p.PageSize = 100
	}
	return p.PageSize
}

// PaginatedResponse represents a paginated list response.
type PaginatedResponse struct {
	Data     interface{} ` + "`json:\"data\"`" + `
	Total    int64       ` + "`json:\"total\"`" + `
	Page     int         ` + "`json:\"page\"`" + `
	PageSize int         ` + "`json:\"page_size\"`" + `
}
`;
}

function generateOTelGo(): string {
  return `package otel

import (
	"context"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
)

func Init(serviceName string, endpoint string) (func(context.Context) error, error) {
	if endpoint == "" {
		// No OTel endpoint configured, skip tracing
		return func(context.Context) error { return nil }, nil
	}

	ctx := context.Background()

	exporter, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpoint(endpoint),
		otlptracehttp.WithInsecure(),
	)
	if err != nil {
		return nil, err
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
		),
	)
	if err != nil {
		return nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)

	otel.SetTracerProvider(tp)

	return tp.Shutdown, nil
}
`;
}

function generateDockerfile(serviceName: string): string {
  return `# Build stage
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git make

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /build/${serviceName} ./cmd/server/

# Runtime stage
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

RUN addgroup -g 1000 app && adduser -u 1000 -G app -s /bin/sh -D app

WORKDIR /app
COPY --from=builder /build/${serviceName} .
COPY config/config.example.yaml ./config/

USER app

EXPOSE 8080

ENV GIN_MODE=release
ENV SERVICE_NAME=${serviceName}

ENTRYPOINT ["/app/${serviceName}"]
`;
}

function generateDockerCompose(serviceName: string): string {
  return `version: "3.8"

services:
  ${serviceName}:
    build: .
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgres://orion:orion@postgres:5432/${serviceName}?sslmode=disable
      - REDIS_URL=redis://redis:6379/0
      - JWT_SECRET=change-me-in-production
      - SERVICE_NAME=${serviceName}
      - ENVIRONMENT=development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - orion

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=orion
      - POSTGRES_PASSWORD=orion
      - POSTGRES_DB=${serviceName}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orion"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - orion

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - orion

volumes:
  pgdata:

networks:
  orion:
    driver: bridge
`;
}

function generateMakefile(serviceName: string): string {
  return `.PHONY: build test lint docker-build run migrate-up migrate-down clean

BIN := ${serviceName}
PKG := orion/${serviceName}

build:
\t@echo "Building ${serviceName}..."
\tCGO_ENABLED=0 go build -ldflags="-s -w" -o $(BIN) ./cmd/server/

test:
\tgo test -race -coverprofile=coverage.out ./...
\tgo tool cover -func=coverage.out | grep total

lint:
\tgolangci-lint run ./...

docker-build:
\tdocker build -t orion/${serviceName}:latest .

run: build
\t./$(BIN)

migrate-up:
\t@for f in $$(ls migrations/*.sql | sort); do \
\t\techo "Applying $$f..."; \
\t\tpsql "$$DATABASE_URL" -f $$f; \
\tdone

migrate-down:
\t@echo "Rollback not yet implemented"

clean:
\trm -f $(BIN) coverage.out
`;
}

function generateMigration001(serviceName: string): string {
  return `-- Migration 001: Create base tables for ${serviceName}
-- Generated by migration scaffolding tool

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Base table (adjust columns based on your domain model)
CREATE TABLE IF NOT EXISTS entities (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    status      VARCHAR(30) NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenant isolation index
CREATE INDEX idx_entities_tenant ON entities(tenant_id);

-- Enable row-level security
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY tenant_isolation_entities ON entities
    USING (tenant_id::text = current_setting('app.current_tenant_id'));

-- Common query indexes
CREATE INDEX idx_entities_status ON entities(status);
CREATE INDEX idx_entities_created_at ON entities(created_at DESC);
`;
}

// ============================================================
// Main
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  let specFile = '';
  let outputDir = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && i + 1 < args.length) {
      outputDir = args[++i];
    } else if (!specFile) {
      specFile = args[i];
    }
  }

  if (!specFile || !outputDir) {
    console.error('Usage: npx tsx generate-go-scaffold.ts <openapi-spec.json> --output <service-dir>');
    process.exit(1);
  }

  if (!fs.existsSync(specFile)) {
    console.error(`Spec file not found: ${specFile}`);
    process.exit(1);
  }

  const specContent = fs.readFileSync(specFile, 'utf-8');
  const spec = parseOpenAPI(specContent);
  const serviceName = serviceNameFromSpec(spec);

  console.log(`Service name: ${serviceName}`);
  console.log(`Output directory: ${outputDir}`);

  // Collect all operations
  const operations: { method: string; path: string; id: string; params: Parameter[] }[] = [];
  for (const [urlPath, pathItem] of Object.entries(spec.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const op = (pathItem as PathItem)[method as keyof PathItem] as Operation | undefined;
      if (op && op.operationId) {
        const params = [...(pathItem.parameters || []), ...(op.parameters || [])];
        operations.push({ method, path: urlPath, id: op.operationId, params });
      }
    }
  }

  console.log(`Found ${operations.length} operations`);

  // Create directory structure
  const dirs = [
    `${outputDir}/cmd/server`,
    `${outputDir}/internal/handler`,
    `${outputDir}/internal/service`,
    `${outputDir}/internal/repository`,
    `${outputDir}/internal/middleware`,
    `${outputDir}/internal/config`,
    `${outputDir}/internal/models`,
    `${outputDir}/internal/otel`,
    `${outputDir}/migrations`,
    `${outputDir}/api`,
    `${outputDir}/config`,
    `${outputDir}/tests`,
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write files
  const files: Record<string, string> = {
    'go.mod': generateGoMod(serviceName),
    'cmd/server/main.go': generateMainGo(serviceName, operations),
    'internal/handler/handler.go': generateHandlerGo(serviceName, operations),
    'internal/config/config.go': generateConfigGo(),
    'internal/middleware/middleware.go': generateMiddlewareGo(),
    'internal/models/models.go': generateModelsGo(),
    'internal/otel/otel.go': generateOTelGo(),
    'migrations/001_create_entities.sql': generateMigration001(serviceName),
    'api/openapi.yaml': specContent,
    'config/config.example.yaml': `service_name: ${serviceName}\nenvironment: development\nhttp_addr: ":8080"\ndatabase_url: "postgres://orion:orion@localhost:5432/${serviceName}?sslmode=disable"\nredis_url: "redis://localhost:6379/0"\njwt_secret: "change-me"\notel_endpoint: ""\n`,
    'Dockerfile': generateDockerfile(serviceName),
    'docker-compose.yml': generateDockerCompose(serviceName),
    'Makefile': generateMakefile(serviceName),
    'README.md': `# ${serviceName}\n\nAuto-generated Go service from OpenAPI spec.\n\n## Quick Start\n\n\`\`\`bash\nmake build\nmake run\n\`\`\`\n\n## Docker\n\n\`\`\`bash\nmake docker-build\ndocker-compose up -d\n\`\`\`\n\n## Migrations\n\n\`\`\`bash\nexport DATABASE_URL=postgres://...\nmake migrate-up\n\`\`\`\n`,
  };

  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(outputDir, relPath);
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`  Created: ${relPath}`);
  }

  // Create service interface stub
  fs.writeFileSync(
    `${outputDir}/internal/service/service.go`,
    `package service

import (
	"context"

	"${serviceName}/internal/models"

	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

type Service struct {
	repo   *Repository
	logger *zap.Logger
}

func New(db *sqlx.DB, logger *zap.Logger) *Service {
	return &Service{
		repo:   NewRepository(db),
		logger: logger,
	}
}

// TODO: Add business logic methods
`,
    'utf-8',
  );

  // Create repository stub
  fs.writeFileSync(
    `${outputDir}/internal/repository/repository.go`,
    `package repository

import (
	"context"

	"${serviceName}/internal/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// TODO: Add data access methods
`,
    'utf-8',
  );

  console.log(`\nGo service scaffold generated: ${outputDir}`);
  console.log(`Total files: ${Object.keys(files).length + 2}`);
  console.log(`\nNext steps:`);
  console.log(`  1. cd ${outputDir}`);
  console.log(`  2. go mod tidy`);
  console.log(`  3. Fill in handler logic in internal/handler/handler.go`);
  console.log(`  4. Fill in service logic in internal/service/service.go`);
  console.log(`  5. Fill in repository methods in internal/repository/repository.go`);
  console.log(`  6. Update migration in migrations/001_create_entities.sql`);
}

main().catch(console.error);
