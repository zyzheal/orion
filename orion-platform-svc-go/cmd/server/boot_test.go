package main

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	"orion/go-common/pkg/database"
	ff_config "orion/platform-svc-go/internal/feature-flag/config"
)

// stubDB is a driver whose every statement fails. Wiring is mostly pure
// construction, but exactly one path (prompt-security AutoMigrate) touches the
// DB at wiring time; the failing driver turns that into a logged warning
// instead of a nil-pointer dereference, without needing a live database.
type stubDriver struct{}

func (stubDriver) Open(string) (driver.Conn, error) { return stubConn{}, nil }

type stubConn struct{}

func (stubConn) Close() error                        { return nil }
func (stubConn) Prepare(string) (driver.Stmt, error) { return stubStmt{}, nil }
func (stubConn) Begin() (driver.Tx, error)           { return stubTx{}, nil }
func (stubConn) ExecContext(context.Context, string, []driver.Value) (driver.Result, error) {
	return nil, errors.New("stub db: exec disabled")
}
func (stubConn) QueryContext(context.Context, string, []driver.Value) (driver.Rows, error) {
	return nil, errors.New("stub db: query disabled")
}

type stubStmt struct{}

func (stubStmt) Close() error  { return nil }
func (stubStmt) NumInput() int { return -1 }
func (stubStmt) Exec([]driver.Value) (driver.Result, error) {
	return nil, errors.New("stub db: exec disabled")
}
func (stubStmt) Query([]driver.Value) (driver.Rows, error) {
	return nil, errors.New("stub db: query disabled")
}

type stubTx struct{}

func (stubTx) Commit() error   { return nil }
func (stubTx) Rollback() error { return nil }

type stubConnector struct{}

func (stubConnector) Connect(context.Context) (driver.Conn, error) { return stubConn{}, nil }
func (stubConnector) Driver() driver.Driver                        { return stubDriver{} }

// mustOpenStubDB returns a *sql.DB bound to the failing stub driver via
// sql.OpenDB, which never dials, so no network I/O happens here.
func mustOpenStubDB() *sql.DB {
	return sql.OpenDB(stubConnector{})
}

// stubInfrastructure returns the wiring inputs needed to populate every
// package-global handler var without any live dependency.
func stubInfrastructure(logger *zap.Logger) *infrastructure {
	return &infrastructure{
		ffCfg:  ff_config.Load(),
		db:     &database.DB{DB: sqlx.NewDb(mustOpenStubDB(), "stub")},
		logger: logger,
	}
}

// TestSetupRouterFullRegistration drives the real initWiring + setupRouter path
// with a stub *database.DB so that every package-global handler var is
// populated. RegisterRoutes methods are pure route registration (no service
// calls at registration time), so no real DB is needed.
//
// Gin's per-method radix trees panic on duplicate (method, path) pairs and on
// static-vs-wildcard trie conflicts. Both are impossible to catch with
// `go build` or `go vet` — they surface only when the router is actually
// assembled. This test is the regression guard for both classes.
func TestSetupRouterFullRegistration(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// ff_config.Load() calls log.Fatal without these; they are only needed for
	// config parsing, not for the registration paths under test.
	t.Setenv("JWT_SECRET", "test-secret")
	t.Setenv("REDIS_ADDR", "localhost:6379")
	t.Setenv("DB_USER", "postgres")
	t.Setenv("DB_PASSWORD", "postgres")

	logger := zap.NewNop()
	infra := stubInfrastructure(logger)

	initWiring(infra, logger)

	r := setupRouter(infra, logger)
	if r == nil {
		t.Fatal("setupRouter returned nil engine")
	}

	// Count registered routes per method so a future regression that drops a
	// RegisterRoutes call (or silently narrows a group) is visible.
	routes := r.Routes()
	if len(routes) < 1000 {
		t.Fatalf("route count collapsed: got %d routes, want >= 1000 (regression in handler wiring)", len(routes))
	}
	t.Logf("setupRouter assembled %d routes without panic", len(routes))
}
