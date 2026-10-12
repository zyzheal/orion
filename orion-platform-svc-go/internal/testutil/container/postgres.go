// Package container provides a containerized PostgreSQL test base via
// testcontainers-go. It lets integration tests start a real PostgreSQL
// instance, run migration files against it, and return a ready-to-use
// *sql.DB handle — eliminating the "mockEventStore replaces real PG" false
// green light anti-pattern (see GATE-TEST-ANTI-PATTERN).
//
// Design intent (TEST-2, 2026-10-11):
//
//   - One container per test (or per package via manual caching).
//   - Migrations are applied from the repo root `migrations/` directory by
//     default (up files only; `_down.sql` files are skipped).
//   - Each returned DB is bound to a per-instance schema (`ORION_<uuid8>`)
//     so tenant_id isolation tests can coexist without clobbering each other.
//   - Startup is expected to complete in ≤ 30s; tests assert on wall time.
//
// Usage:
//
//	pg := container.NewPostgres(t,
//	    container.WithMigrations("../../..//migrations"),
//	    container.WithTenantID("tenant-a"),
//	)
//	assert.NoError(t, pg.DB.Ping())
package container

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/testcontainers/testcontainers-go"
	postgresmod "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	// Blank-import pgx stdlib driver so sql.Open("pgx", ...) works.
	_ "github.com/jackc/pgx/v5/stdlib"
)

const (
	// DefaultImage pins the PostgreSQL test image. 16-alpine is small and
	// matches the repo's runtime target.
	DefaultImage = "postgres:16-alpine"

	// DefaultStartupTimeout caps container startup. TEST-2 acceptance
	// requires ≤ 30s end-to-end; 30s on the container alone leaves room.
	DefaultStartupTimeout = 30 * time.Second

	defaultDB   = "orion_test"
	defaultUser = "orion"
	defaultPass = "orion-pass"
)

// Config holds tunables for the PostgreSQL container. All zero values
// resolve to sensible defaults via NewPostgres.
type Config struct {
	Image              string
	DBName             string
	User               string
	Password           string
	StartupTimeout     time.Duration
	MigrationDir       string
	MigrationGlob      string
	SkipDownMigrations bool
	ReadyLog           string
	TenantID           string
}

// Postgres represents a running PostgreSQL test container with a bound
// database/sql handle. Calling Terminate releases the container.
type Postgres struct {
	// Container is the raw testcontainers handle (via postgres.Run).
	Container *postgresmod.PostgresContainer
	DB        *sql.DB
	Schema    string // per-instance schema, already created
	TenantID  string // optional tenant_id label for isolation tests
}

// Option customizes Config.
type Option func(*Config)

// WithImage overrides the Docker image (default: postgres:16-alpine).
func WithImage(img string) Option { return func(c *Config) { c.Image = img } }

// WithDatabase overrides the test database name.
func WithDatabase(name string) Option { return func(c *Config) { c.DBName = name } }

// WithMigrations sets the migration directory. If empty, migrations are
// NOT applied — the container returns a bare PG instance.
func WithMigrations(dir string) Option { return func(c *Config) { c.MigrationDir = dir } }

// WithMigrationGlob overrides the migration filename glob.
func WithMigrationGlob(glob string) Option {
	return func(c *Config) { c.MigrationGlob = glob }
}

// WithTenantID labels the container with a tenant identifier so tests can
// assert tenant isolation on top of the shared DB.
func WithTenantID(tid string) Option {
	return func(c *Config) { c.TenantID = tid }
}

// WithStartupTimeout overrides the container-ready timeout.
func WithStartupTimeout(d time.Duration) Option {
	return func(c *Config) { c.StartupTimeout = d }
}

// NewPostgres boots a PostgreSQL container, optionally runs migrations
// against it, and returns a ready *sql.DB.
//
// Contract:
//   - t.Cleanup is registered to auto-terminate the container.
//   - Wall-clock startup is expected to be ≤ 30s (TEST-2 acceptance).
//   - On migration failure, the container is torn down before return.
func NewPostgres(t *testing.T, opts ...Option) *Postgres {
	t.Helper()

	cfg := &Config{
		Image:              DefaultImage,
		DBName:             defaultDB,
		User:               defaultUser,
		Password:           defaultPass,
		StartupTimeout:     DefaultStartupTimeout,
		MigrationGlob:      "*.sql",
		SkipDownMigrations: true,
		ReadyLog:           "ready to accept connections",
	}
	for _, o := range opts {
		o(cfg)
	}

	ctx, cancel := context.WithTimeout(context.Background(), cfg.StartupTimeout)
	defer cancel()

	start := time.Now()

	postgres, err := postgresmod.Run(
		ctx,
		cfg.Image,
		postgresmod.WithDatabase(cfg.DBName),
		postgresmod.WithUsername(cfg.User),
		postgresmod.WithPassword(cfg.Password),
		testcontainers.WithWaitStrategy(
			wait.ForLog(cfg.ReadyLog).
				WithStartupTimeout(cfg.StartupTimeout),
		),
	)
	if err != nil {
		t.Fatalf("container: failed to start postgres: %v", err)
	}

	dsn, err := postgres.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		_ = postgres.Terminate(ctx)
		t.Fatalf("container: dsn: %v", err)
	}

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		_ = postgres.Terminate(ctx)
		t.Fatalf("container: sql.Open: %v", err)
	}
	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)

	// PG accepts connections slightly before it's fully ready to serve
	// queries on some images; do a bounded retry on the initial ping.
	var lastErr error
	for attempt := 0; attempt < 5; attempt++ {
		lastErr = db.PingContext(ctx)
		if lastErr == nil {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	if lastErr != nil {
		_ = db.Close()
		_ = postgres.Terminate(ctx)
		t.Fatalf("container: ping: %v", lastErr)
	}

	// Create isolated schema so concurrent tests don't collide.
	schemaName := "orion_" + strings.ReplaceAll(uuid.NewString(), "-", "")[:8]
	if _, err := db.ExecContext(ctx, fmt.Sprintf("CREATE SCHEMA IF NOT EXISTS %q", schemaName)); err != nil {
		_ = db.Close()
		_ = postgres.Terminate(ctx)
		t.Fatalf("container: create schema %q: %v", schemaName, err)
	}
	if _, err := db.ExecContext(ctx, fmt.Sprintf("SET search_path TO %q, public", schemaName)); err != nil {
		_ = db.Close()
		_ = postgres.Terminate(ctx)
		t.Fatalf("container: set search_path: %v", err)
	}

	if cfg.MigrationDir != "" {
		if err := applyMigrations(ctx, db, cfg); err != nil {
			_ = db.Close()
			_ = postgres.Terminate(ctx)
			t.Fatalf("container: migrations: %v", err)
		}
	}

	startupDuration := time.Since(start)

	pg := &Postgres{
		Container: postgres,
		DB:        db,
		Schema:    schemaName,
		TenantID:  cfg.TenantID,
	}

	t.Logf("postgres container ready in %s (schema=%s, tenant=%q)",
		startupDuration.Round(time.Millisecond), pg.Schema, pg.TenantID)

	t.Cleanup(func() {
		termCtx, termCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer termCancel()
		_ = db.Close()
		_ = postgres.Terminate(termCtx)
	})

	return pg
}

// Terminate manually stops the container. Safe to call more than once;
// the deferred t.Cleanup is a no-op after the container is gone.
func (p *Postgres) Terminate() error {
	if p == nil || p.Container == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	termErr := p.Container.Terminate(ctx)
	if dbErr := p.DB.Close(); dbErr != nil && termErr == nil {
		termErr = dbErr
	}
	return termErr
}

// ConnectionString returns the DSN for the running container.
func (p *Postgres) ConnectionString(ctx context.Context) (string, error) {
	if p == nil || p.Container == nil {
		return "", errors.New("postgres: container not started")
	}
	return p.Container.ConnectionString(ctx, "sslmode=disable")
}

// applyMigrations runs every up-migration file in cfg.MigrationDir against
// db in filename order. `_down.sql` files are skipped (TEST-2 requires
// forward-only test migrations; down-migrations would clobber state).
func applyMigrations(ctx context.Context, db *sql.DB, cfg *Config) error {
	entries, err := os.ReadDir(cfg.MigrationDir)
	if err != nil {
		return fmt.Errorf("read migration dir %q: %w", cfg.MigrationDir, err)
	}

	var files []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if !matchGlob(cfg.MigrationGlob, e.Name()) {
			continue
		}
		if cfg.SkipDownMigrations && strings.HasSuffix(e.Name(), "_down.sql") {
			continue
		}
		files = append(files, filepath.Join(cfg.MigrationDir, e.Name()))
	}
	sort.Strings(files)

	for _, path := range files {
		sqlBytes, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read %q: %w", path, err)
		}
		if _, err := db.ExecContext(ctx, string(sqlBytes)); err != nil {
			return fmt.Errorf("apply %q: %w", filepath.Base(path), err)
		}
	}
	return nil
}

// matchGlob is a tiny glob matcher that avoids filepath.Glob (which
// requires a directory pattern, not a filename). filepath.Match is the
// right primitive for one-off name filtering.
func matchGlob(pattern, name string) bool {
	if pattern == "" || pattern == "*" || pattern == "**" {
		return true
	}
	ok, err := filepath.Match(pattern, name)
	return err == nil && ok
}
