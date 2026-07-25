package startup

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"io"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/startup/repository"
	"orion/platform-svc-go/internal/startup/service"
)

// ---------------------------------------------------------------------------
// mock IStartup
// ---------------------------------------------------------------------------

type testIStartup struct {
	name          string
	priority      int
	deps          []string
	initErr       error
	healthErr     error
	shutdownErr   error
	onShutdownFn  func()
	shutdownCount int32
}

func (m *testIStartup) Name() string { return m.name }
func (m *testIStartup) Priority() int { return m.priority }
func (m *testIStartup) DependsOn() []string { return m.deps }
func (m *testIStartup) Initialize(_ context.Context, _ map[string]string) error {
	return m.initErr
}
func (m *testIStartup) HealthCheck() error { return m.healthErr }
func (m *testIStartup) Shutdown() error {
	if m.shutdownErr != nil {
		return m.shutdownErr
	}
	atomic.AddInt32(&m.shutdownCount, 1)
	if m.onShutdownFn != nil {
		m.onShutdownFn()
	}
	return nil
}

// ---------------------------------------------------------------------------
// Mock driver.Conn — satisfies sqlx without CGO or external DB.
// ---------------------------------------------------------------------------

type mockModule struct {
	ID          string
	TenantID    string
	Name        string
	Type        string
	Priority    int
	Description string
	Config      string
	Status      string
	Error       string
	DurationMs  int64
	Initialized string
	CreatedAt   string
	UpdatedAt   string
}

type mockConn struct {
	mu    sync.RWMutex
	seed  map[string]*mockModule // keyed by name
	rows  int                   // how many insert rows accepted
}

type mockConnector struct {
	conn *mockConn
}

func (c *mockConnector) Connect(_ context.Context) (driver.Conn, error) { return c.conn, nil }
func (c *mockConnector) Driver() driver.Driver { return c }

type mockDriver struct {
	conn *mockconn
}
func (d *mockDriver) Open(string) (driver.Conn, error) { return d.conn, nil }
func (d *mockDriver) OpenConnector(string) (driver.Connector, error) {
	return &mockConnector{conn: d.conn}, nil
}

// --- driver.Conn ---

func (c *mockConn) Prepare(string) (driver.Stmt, error) { return nil, nil }
func (c *mockConn) PrepareContext(context.Context, string) (driver.Stmt, error) { return nil, nil }
func (c *mockConn) Close() error { return nil }
func (c *mockConn) Ping() error { return nil }
func (c *mockConn) ResetSession(context.Context) error { return nil }

type mockTx struct{ c *mockconn }
func (c *mockConn) Begin() (driver.Tx, error) { return &mockTx{c: c}, nil }
func (t *mockTx) Commit() error { return nil }
func (t *mockTx) Rollback() error { return nil }

// --- ExecContext / QueryContext ---

func (c *mockConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	values := make([]driver.Value, len(args))
	for i, a := range args {
		values[i] = a.Value
	}
	// "SELECT * ... $1,$2,...$13" = insert startup_modules
	if len(values) == 13 {
		c.mu.Lock()
		defer c.mu.Unlock()
		c.rows++
		return driver.RowsAffected(1), nil
	}
	return driver.RowsAffected(0), nil
}

func (c *mockConn) QueryContext(_ context.Context, _ string, args []driver.NamedValue) (driver.Rows, error) {
	values := make([]driver.Value, len(args))
	for i, a := range args {
		values[i] = a.Value
	}
	c.mu.RLock()
	defer c.mu.RUnlock()

	if len(values) < 2 {
		return &mockRowsNoRows{}, nil
	}
	arg0, _ := values[0].(string)
	arg1, _ := values[1].(string)

	for _, m := range c.seed {
		if m.Name == arg0 && m.TenantID == arg1 {
			return &mockRowsOne{mod: m}, nil
		}
		if m.ID == arg0 && m.TenantID == arg1 {
			return &mockRowsOne{mod: m}, nil
		}
	}
	return &mockRowsNoRows{}, nil
}

// --- Mock rows ---

type mockRowsOne struct {
	mod  *mockModule
	done bool
}

func (r *mockRowsOne) Columns() []string {
	return []string{
		"id", "tenant_id", "name", "type", "priority", "description",
		"config", "status", "error", "duration_ms", "initialized_at",
		"created_at", "updated_at",
	}
}
func (r *mockRowsOne) Close() error { return nil }
func (r *mockRowsOne) Next(dest []driver.Value) error {
	if r.done {
		return io.EOF
	}
	r.done = true
	if len(dest) < 13 {
		return fmt.Errorf("insufficient dest slots: %d", len(dest))
	}
	dest[0] = driver.Value(r.mod.ID)
	dest[1] = driver.Value(r.mod.TenantID)
	dest[2] = driver.Value(r.mod.Name)
	dest[3] = driver.Value(r.mod.Type)
	dest[4] = driver.Value(r.mod.Priority)
	dest[5] = driver.Value(r.mod.Description)
	dest[6] = driver.Value(r.mod.Config)
	dest[7] = driver.Value(r.mod.Status)
	dest[8] = driver.Value(r.mod.Error)
	dest[9] = driver.Value(r.mod.DurationMs)
	dest[10] = driver.Value(r.mod.Initialized)
	dest[11] = driver.Value(r.mod.CreatedAt)
	dest[12] = driver.Value(r.mod.UpdatedAt)
	return nil
}

type mockRowsNoRows struct{}
func (r *mockRowsNoRows) Columns() []string {
	return []string{
		"id", "tenant_id", "name", "type", "priority", "description",
		"config", "status", "error", "duration_ms", "initialized_at",
		"created_at", "updated_at",
	}
}
func (r *mockRowsNoRows) Close() error { return nil }
func (r *mockRowsNoRows) Next([]driver.Value) error { return io.EOF }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func newMockRepo(seedModules map[string]*mockModule) *repository.Repository {
	conn := &mockConn{seed: seedModules}
	db := sqlx.NewDb(&mockConnector{conn: conn}, "mock")
	db.SetMaxOpenConns(1)
	return repository.NewRepository(db)
}

func seedModule(name string) *mockModule {
	return &mockModule{
		ID:       "id-" + name,
		TenantID: "default",
		Name:     name,
		Type:     "auto",
		Status:   "pending",
		CreatedAt: "2026-01-01",
		UpdatedAt: "2026-01-01",
	}
}

func repoFor(name string) *repository.Repository {
	return newMockRepo(map[string]*mockModule{name: seedModule(name)})
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestPhaseStartupManagerWiresModule(t *testing.T) {
	mod := &testIStartup{name: "wired-mod", priority: 10}
	sm := service.NewStartupManager(repoFor("wired-mod"), nopLogger())
	psm := NewPhaseStartupManager(nopLogger(), sm)
	psm.Register(mod)

	if err := psm.Start(context.Background()); err != nil {
		t.Fatalf("Start failed: %v", err)
	}
	if sm.GetModuleStatus("wired-mod") != "active" {
		t.Fatalf("status = %s, want active", sm.GetModuleStatus("wired-mod"))
	}
	psm.Stop(context.Background())
}

func TestBridgeRegistersModule(t *testing.T) {
	mod := &testIStartup{name: "bridge-mod", priority: 5}
	pm := NewPhaseManager(nopLogger())
	sm := service.NewStartupManager(repoFor("bridge-mod"), nopLogger())
	NewBridge(pm, sm).Register(mod)

	if err := pm.Start(context.Background()); err != nil {
		t.Fatalf("Start failed: %v", err)
	}
	if sm.GetModuleStatus("bridge-mod") != "active" {
		t.Fatalf("status = %s, want active", sm.GetModuleStatus("bridge-mod"))
	}
	pm.Stop(context.Background())
}

func TestShutdownCalledOnPhaseStop(t *testing.T) {
	mod := &testIStartup{name: "shut-test"}
	psm := NewPhaseStartupManager(nopLogger(),
		service.NewStartupManager(repoFor("shut-test"), nopLogger()))
	psm.Register(mod)

	psm.Start(context.Background())
	psm.Stop(context.Background())

	if mod.shutdownCount != 1 {
		t.Fatalf("expected Shutdown called once, got %d", mod.shutdownCount)
	}
}

func TestBridgeShutdownCalled(t *testing.T) {
	mod := &testIStartup{name: "bridge-shut"}
	pm := NewPhaseManager(nopLogger())
	sm := service.NewStartupManager(repoFor("bridge-shut"), nopLogger())
	NewBridge(pm, sm).Register(mod)

	pm.Start(context.Background())
	pm.Stop(context.Background())

	if mod.shutdownCount != 1 {
		t.Fatalf("expected Shutdown called once, got %d", mod.shutdownCount)
	}
}

func TestInitErrorAborts(t *testing.T) {
	psm := NewPhaseStartupManager(nopLogger(),
		service.NewStartupManager(repoFor("bad-init"), nopLogger()))
	psm.Register(&testIStartup{name: "bad-init", priority: 1, initErr: errors.New("init fail")})

	if err := psm.Start(context.Background()); err == nil {
		t.Fatal("expected Start to fail")
	}
}

func TestBridgeDependencyOrdering(t *testing.T) {
	seed := map[string]*mockModule{
		"dep-first": seedModule("dep-first"),
		"dep-second": seedModule("dep-second"),
	}
	first := &testIStartup{name: "dep-first", priority: 10}
	second := &testIStartup{name: "dep-second", priority: 5, deps: []string{"dep-first"}}
	sm := service.NewStartupManager(newMockRepo(seed), nopLogger())
	psm := NewPhaseStartupManager(nopLogger(), sm)

	psm.Register(first)
	psm.Register(second)

	if err := psm.Start(context.Background()); err != nil {
		t.Fatalf("Start failed: %v", err)
	}
	for _, name := range []string{"dep-first", "dep-second"} {
		if sm.GetModuleStatus(name) != "active" {
			t.Errorf("%s status = %s, want active", name, sm.GetModuleStatus(name))
		}
	}
	psm.Stop(context.Background())
}

func TestPrebuiltHandlersPhaseOrder(t *testing.T) {
	pm := NewPhaseManager(nopLogger())
	var order []string

	pm.RegisterHandler(NewConfigPhaseHandler("cfg",
		func(context.Context) error { order = append(order, "cfg"); return nil }))
	pm.RegisterHandler(NewDatabasePhaseHandler("db",
		func(context.Context) error { order = append(order, "db-connect"); return nil },
		func(context.Context) error { order = append(order, "db-migrate"); return nil },
		func(context.Context) error { order = append(order, "db-close"); return nil },
	))
	pm.RegisterHandler(NewCachePhaseHandler("cache",
		func(context.Context) error { order = append(order, "cache-connect"); return nil },
		func(context.Context) error { order = append(order, "cache-ping"); return nil },
		func(context.Context) error { order = append(order, "cache-close"); return nil },
	))
	pm.RegisterHandler(NewMiddlewarePhaseHandler("mw",
		func(context.Context) error { order = append(order, "mw"); return nil }))
	pm.RegisterHandler(NewReadyPhaseHandler("ready",
		func(context.Context) error { order = append(order, "ready"); return nil }))

	if err := pm.Start(context.Background()); err != nil {
		t.Fatalf("Start failed: %v", err)
	}

	want := []string{"cfg", "db-connect", "db-migrate", "cache-connect", "cache-ping", "mw", "ready"}
	if len(order) != len(want) {
		t.Fatalf("order = %v, want %v", order, want)
	}
	for i, w := range want {
		if order[i] != w {
			t.Errorf("order[%d] = %q, want %q", i, order[i], w)
		}
	}
	pm.Stop(context.Background())
}

func TestPhaseStartupManagerFields(t *testing.T) {
	psm := NewPhaseStartupManager(nopLogger(), service.NewStartupManager(repoFor("x"), nopLogger()))
	if psm.PhaseManager == nil {
		t.Fatal("PhaseManager should not be nil")
	}
	if psm.StartupManager == nil {
		t.Fatal("StartupManager should not be nil")
	}
}
