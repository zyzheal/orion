package service

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/startup/models"
	"orion/platform-svc-go/internal/startup/repository"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

// Round 19 made this manager reachable over HTTP: until then ListModules,
// GetModuleByID, DeleteModule, HealthCheckModule and AddDependency did not exist
// at all, and the handler answered every one of those routes with a fixed
// message. It also fixed the hardcoded "default" tenant that startModuleLocked
// used to pass to the repository, so a second tenant started its modules with
// the first tenant's config.

const moduleLookupSQL = `FROM startup_modules WHERE name=\$1 AND tenant_id=\$2`

func newMockManager(t *testing.T, matcher sqlmock.QueryMatcher) (sqlmock.Sqlmock, *StartupManager) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(matcher))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewStartupManager(repository.NewRepository(sqlx.NewDb(db, "postgres")), zap.NewNop())
}

func regexpManager(t *testing.T) (sqlmock.Sqlmock, *StartupManager) {
	t.Helper()
	return newMockManager(t, sqlmock.QueryMatcherRegexp)
}

func moduleRow(add ...[]driver.Value) *sqlmock.Rows {
	rows := sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "type", "priority", "description", "config",
		"status", "error", "duration_ms", "initialized_at", "created_at", "updated_at",
	})
	now := time.Now()
	for _, r := range add {
		// created_at and updated_at are non-nullable, so a nil there makes sqlx
		// report a scan error instead of the row itself.
		if len(r) >= 12 && r[11] == nil {
			r[11] = now
		}
		if len(r) >= 13 && r[12] == nil {
			r[12] = now
		}
		rows.AddRow(r...)
	}
	return rows
}

// fakeStartup is a scriptable IStartup that records the config it received.
type fakeStartup struct {
	name      string
	priority  int
	depends   []string
	initErr   error
	healthErr error
	configs   []map[string]string
}

func (f *fakeStartup) Name() string        { return f.name }
func (f *fakeStartup) Priority() int       { return f.priority }
func (f *fakeStartup) DependsOn() []string { return f.depends }
func (f *fakeStartup) Shutdown() error     { return nil }
func (f *fakeStartup) HealthCheck() error  { return f.healthErr }
func (f *fakeStartup) Initialize(ctx context.Context, cfg map[string]string) error {
	f.configs = append(f.configs, cfg)
	return f.initErr
}

func TestParseConfigString(t *testing.T) {
	cfg, err := parseConfigString("")
	if err != nil || len(cfg) != 0 {
		t.Fatalf("empty input = %v, %v; want an empty config, no error", cfg, err)
	}

	cfg, err = parseConfigString(`{"dsn":"db://x","timeout":"30s"}`)
	if err != nil {
		t.Fatalf("parseConfigString: %v", err)
	}
	if cfg["dsn"] != "db://x" || cfg["timeout"] != "30s" {
		t.Fatalf("parsed config = %v, want the decoded key/value pairs", cfg)
	}

	if _, err = parseConfigString("{not json"); err == nil {
		t.Fatal("malformed JSON was accepted")
	}

	// The pre-fix implementation stored the whole payload under the key "raw",
	// so a module never saw its real keys.
	if _, ok := cfg["raw"]; ok {
		t.Fatalf("config still exposes the legacy %q key: %v", "raw", cfg)
	}
}

func TestErrorClassifiers(t *testing.T) {
	notFound := []error{ErrModuleNotFound, sentinel.NotFound, errors.Join(ErrModuleNotFound, nil)}
	for _, err := range notFound {
		if !IsNotFound(err) {
			t.Errorf("IsNotFound(%v) = false, want true", err)
		}
	}
	unhealthy := []error{ErrNotRunning, ErrModuleUnhealthy, errors.Join(ErrNotRunning, nil)}
	for _, err := range unhealthy {
		if !IsUnhealthy(err) {
			t.Errorf("IsUnhealthy(%v) = false, want true", err)
		}
	}
	conflict := []error{ErrDuplicateModule, ErrDuplicateDependency, ErrCircularDep}
	for _, err := range conflict {
		if !IsConflict(err) {
			t.Errorf("IsConflict(%v) = false, want true", err)
		}
	}

	if IsNotFound(nil) || IsUnhealthy(nil) || IsConflict(nil) {
		t.Fatal("a nil error classifies as every failure mode")
	}
	if IsNotFound(ErrNotRunning) || IsUnhealthy(ErrModuleNotFound) || IsConflict(ErrAlreadyStarted) {
		t.Fatal("the classifiers overlap: each error must map to exactly one class")
	}
	if IsConflict(ErrModuleNotFound) || IsUnhealthy(ErrDuplicateModule) {
		t.Fatal("an unclassified error must not be reported as unhealthy or conflicting")
	}
}

func TestClassifiersDelegateToThePackageFunctions(t *testing.T) {
	m := NewStartupManager(nil, zap.NewNop())
	for _, err := range []error{nil, ErrModuleNotFound, ErrNotRunning, ErrCircularDep,
		sentinel.NotFound, errors.New("boom")} {
		if m.IsNotFound(err) != IsNotFound(err) || m.IsUnhealthy(err) != IsUnhealthy(err) ||
			m.IsConflict(err) != IsConflict(err) {
			t.Errorf("manager classifiers disagree with the package functions for %v", err)
		}
	}
}

// -------------------------------------------------------
// Start: ordering, tenant scoping, config parsing
// -------------------------------------------------------

func TestStart_InitialisesInPriorityOrderWithTheCallerTenant(t *testing.T) {
	mock, m := regexpManager(t)
	web := &fakeStartup{name: "web", priority: 5}
	authMod := &fakeStartup{name: "auth", priority: 10}
	store := &fakeStartup{name: "store", priority: 20}
	for _, mod := range []*fakeStartup{web, authMod, store} {
		m.Register(mod)
	}

	// store and web have no persisted row: they start with an empty config.
	mock.ExpectQuery(moduleLookupSQL).WithArgs("store", "t1").WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery(moduleLookupSQL).WithArgs("auth", "t1").WillReturnRows(moduleRow([]driver.Value{
		"m-2", "t1", "auth", models.ModuleTypeAuto, 10, "", `{"dsn":"db://auth","timeout":"30s"}`,
		models.StatusPending, "", int64(0), nil, nil, nil,
	}))
	mock.ExpectQuery(moduleLookupSQL).WithArgs("web", "t1").WillReturnError(sql.ErrNoRows)

	if err := m.Start(context.Background(), "t1"); err != nil {
		t.Fatalf("Start: %v", err)
	}

	if len(store.configs) != 1 || len(store.configs[0]) != 0 {
		t.Fatalf("store config = %v, want exactly one empty config", store.configs)
	}
	if len(authMod.configs) != 1 || authMod.configs[0]["dsn"] != "db://auth" ||
		authMod.configs[0]["timeout"] != "30s" {
		t.Fatalf("auth config = %v, want the decoded startup_modules.config", authMod.configs)
	}
	if len(web.configs) != 1 {
		t.Fatalf("web config = %v, want exactly one empty config", web.configs)
	}

	// store (20) must have initialised before auth (10) and web (5).
	if got := m.GetModuleStatus("store"); got != "active" {
		t.Errorf("store status = %q, want active", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the config lookup did not use tenant t1 for every module: %v", err)
	}
}

func TestStart_FailsAtTheFirstBrokenModule(t *testing.T) {
	mock, m := regexpManager(t)
	authMod := &fakeStartup{name: "auth", priority: 10}
	web := &fakeStartup{name: "web", priority: 5, initErr: errors.New("port busy")}
	for _, mod := range []*fakeStartup{web, authMod} {
		m.Register(mod)
	}
	mock.ExpectQuery(moduleLookupSQL).WithArgs("auth", "t1").WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery(moduleLookupSQL).WithArgs("web", "t1").WillReturnError(sql.ErrNoRows)

	err := m.Start(context.Background(), "t1")
	if err == nil {
		t.Fatal("Start succeeded although a module failed to initialise")
	}
	if !strings.Contains(err.Error(), `failed to start module "web"`) {
		t.Fatalf("error = %v, want the failing module name", err)
	}
	if m.GetModuleStatus("web") != "initialized" {
		t.Fatalf("web status = %q, want initialized (i.e. not running)", m.GetModuleStatus("web"))
	}
}

func TestStart_RejectsCircularDependencies(t *testing.T) {
	mock, m := regexpManager(t)
	a := &fakeStartup{name: "a", priority: 2, depends: []string{"b"}}
	b := &fakeStartup{name: "b", priority: 1, depends: []string{"a"}}
	m.Register(a)
	m.Register(b)

	err := m.Start(context.Background(), "t1")
	if !errors.Is(err, ErrCircularDep) {
		t.Fatalf("Start err = %v, want ErrCircularDep", err)
	}
	if len(a.configs) != 0 || len(b.configs) != 0 {
		t.Fatal("a cycle was detected but modules were still initialised")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("cycle detection should not touch the repository: %v", err)
	}
}

func TestStartModule(t *testing.T) {
	mock, m := regexpManager(t)
	core := &fakeStartup{name: "core", priority: 10}
	web := &fakeStartup{name: "web", priority: 5, depends: []string{"core"}}
	m.Register(core)
	m.Register(web)

	if err := m.StartModule(context.Background(), "t1", "ghost"); !errors.Is(err, ErrModuleNotFound) {
		t.Fatalf("unknown module err = %v, want ErrModuleNotFound", err)
	}

	// core is registered but never initialised, so web's dependency is unmet.
	if err := m.StartModule(context.Background(), "t1", "web"); !errors.Is(err, ErrDependencyMissing) {
		t.Fatalf("unmet dependency err = %v, want ErrDependencyMissing", err)
	}

	mock.ExpectQuery(moduleLookupSQL).WithArgs("core", "t1").WillReturnError(sql.ErrNoRows)
	if err := m.StartModule(context.Background(), "t1", "core"); err != nil {
		t.Fatalf("StartModule(core): %v", err)
	}
	if m.GetModuleStatus("core") != "active" {
		t.Fatalf("core status = %q, want active", m.GetModuleStatus("core"))
	}

	if err := m.StartModule(context.Background(), "t1", "core"); !errors.Is(err, ErrAlreadyStarted) {
		t.Fatalf("double start err = %v, want ErrAlreadyStarted", err)
	}

	if err := m.StartModule(context.Background(), "t1", "web"); err != nil {
		t.Fatalf("StartModule(web) with core running: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// -------------------------------------------------------
// InitModule / HealthCheckModule coherence
// -------------------------------------------------------

func TestInitModule_MarksTheModuleRunning(t *testing.T) {
	mock, m := regexpManager(t)
	web := &fakeStartup{name: "web", priority: 5}
	m.Register(web)

	// A *sqlmock.Rows is consumed by its first Next() call and never rewound, so
	// every expectation needs its own value. Reusing one silently turns the later
	// lookup into sql.ErrNoRows.
	rowsOf := func() *sqlmock.Rows {
		return moduleRow([]driver.Value{
			"m-1", "t1", "web", models.ModuleTypeLazy, 5, "", `{"dsn":"db://x"}`,
			models.StatusPending, "", int64(0), nil, nil, nil,
		})
	}
	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("m-1", "t1").WillReturnRows(rowsOf())
	mock.ExpectExec(`UPDATE startup_modules SET`).WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("m-1", "t1").WillReturnRows(rowsOf())

	mod, err := m.InitModule(context.Background(), "t1", "m-1")
	if err != nil {
		t.Fatalf("InitModule: %v", err)
	}
	if mod.Status != models.StatusActive {
		t.Fatalf("status = %q, want active", mod.Status)
	}
	if mod.InitializedAt == nil {
		t.Fatal("initialized_at was not recorded")
	}
	if len(web.configs) != 1 || web.configs[0]["dsn"] != "db://x" {
		t.Fatalf("module config = %v, want the decoded row config", web.configs)
	}

	healthy, err := m.HealthCheckModule(context.Background(), "t1", "m-1")
	if !healthy || err != nil {
		t.Fatalf("HealthCheckModule = %v, %v; want true after a successful init", healthy, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestInitModule_RejectsBadConfigAndDoesNotStart(t *testing.T) {
	mock, m := regexpManager(t)
	web := &fakeStartup{name: "web", priority: 5}
	m.Register(web)

	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("m-1", "t1").WillReturnRows(
		moduleRow([]driver.Value{
			"m-1", "t1", "web", models.ModuleTypeLazy, 5, "", "{not json",
			models.StatusPending, "", int64(0), nil, nil, nil,
		}))
	mock.ExpectExec(`UPDATE startup_modules SET`).WillReturnResult(sqlmock.NewResult(1, 1))

	mod, err := m.InitModule(context.Background(), "t1", "m-1")
	if err == nil {
		t.Fatal("InitModule accepted a malformed config")
	}
	if mod == nil || mod.Status != models.StatusError || mod.Error == "" {
		t.Fatalf("row state = %+v, want status=error with the parse message", mod)
	}
	if len(web.configs) != 0 {
		t.Fatal("Initialize was called for an unparsable config")
	}
	if m.GetModuleStatus("web") == "active" {
		t.Fatal("a module with a bad config is reported as active")
	}
}

func TestInitModule_MissingRowIsNotFound(t *testing.T) {
	mock, m := regexpManager(t)
	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("nope", "t1").
		WillReturnError(sql.ErrNoRows)

	mod, err := m.InitModule(context.Background(), "t1", "nope")
	if mod != nil || !errors.Is(err, ErrModuleNotFound) {
		t.Fatalf("InitModule = %+v, %v; want nil, ErrModuleNotFound", mod, err)
	}
}

func TestInitModule_DatabaseOutageIsNotNotFound(t *testing.T) {
	mock, m := regexpManager(t)
	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("m-1", "t1").
		WillReturnError(errors.New("connection refused"))

	_, err := m.InitModule(context.Background(), "t1", "m-1")
	if errors.Is(err, ErrModuleNotFound) {
		t.Fatalf("a database outage was reported as not-found: %v", err)
	}
}

func TestHealthCheckModule(t *testing.T) {
	mock, m := regexpManager(t)
	healthy := &fakeStartup{name: "web", priority: 5}
	sick := &fakeStartup{name: "sick", priority: 4, healthErr: errors.New("probe timeout")}
	ghost := &fakeStartup{name: "ghost", priority: 3}
	m.Register(healthy)
	m.Register(sick)
	m.Register(ghost)

	row := func(id, name string) *sqlmock.Rows {
		return moduleRow([]driver.Value{
			id, "t1", name, models.ModuleTypeLazy, 5, "", "",
			models.StatusPending, "", int64(0), nil, nil, nil,
		})
	}
	byID := func(id string) *sqlmock.ExpectedQuery {
		return mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs(id, "t1")
	}

	// Before anything has started, a row cannot be healthy — regardless of
	// whether the module name even resolves to a registered implementation.
	byID("m-1").WillReturnRows(row("m-1", "web"))
	ok, err := m.HealthCheckModule(context.Background(), "t1", "m-1")
	if ok || !errors.Is(err, ErrNotRunning) {
		t.Fatalf("HealthCheckModule before Start = %v, %v; want false, ErrNotRunning", ok, err)
	}
	byID("m-9").WillReturnRows(row("m-9", "ghost"))
	ok, err = m.HealthCheckModule(context.Background(), "t1", "m-9")
	if ok || !errors.Is(err, ErrNotRunning) {
		t.Fatalf("unregistered module before Start = %v, %v; want false, ErrNotRunning", ok, err)
	}

	// Start everything for real, then check each module. Start resolves the
	// config row by name; a persisted row is what puts a name into m.running.
	mock.ExpectQuery(moduleLookupSQL).WithArgs("web", "t1").WillReturnRows(row("m-1", "web"))
	mock.ExpectQuery(moduleLookupSQL).WithArgs("sick", "t1").WillReturnRows(row("m-2", "sick"))
	mock.ExpectQuery(moduleLookupSQL).WithArgs("ghost", "t1").WillReturnRows(row("m-9", "ghost"))
	if err := m.Start(context.Background(), "t1"); err != nil {
		t.Fatalf("Start: %v", err)
	}
	// A persisted row whose name has no registered IStartup is unhealthy once
	// the manager is up: the row and the registry disagree.
	delete(m.modules, "ghost")
	byID("m-9").WillReturnRows(row("m-9", "ghost"))
	ok, err = m.HealthCheckModule(context.Background(), "t1", "m-9")
	if ok || !errors.Is(err, ErrModuleUnhealthy) {
		t.Fatalf("unregistered module = %v, %v; want false, ErrModuleUnhealthy", ok, err)
	}

	byID("m-1").WillReturnRows(row("m-1", "web"))
	ok, err = m.HealthCheckModule(context.Background(), "t1", "m-1")
	if !ok || err != nil {
		t.Fatalf("healthy module = %v, %v; want true", ok, err)
	}

	byID("m-2").WillReturnRows(row("m-2", "sick"))
	ok, err = m.HealthCheckModule(context.Background(), "t1", "m-2")
	if ok || !errors.Is(err, ErrModuleUnhealthy) {
		t.Fatalf("failing probe = %v, %v; want false, ErrModuleUnhealthy", ok, err)
	}

	// Stopped modules report not-running, not healthy.
	if err := m.Stop(context.Background()); err != nil {
		t.Fatalf("Stop: %v", err)
	}
	byID("m-1").WillReturnRows(row("m-1", "web"))
	ok, err = m.HealthCheckModule(context.Background(), "t1", "m-1")
	if ok || !errors.Is(err, ErrNotRunning) {
		t.Fatalf("stopped module = %v, %v; want false, ErrNotRunning", ok, err)
	}

	byID("nope").WillReturnError(sql.ErrNoRows)
	ok, err = m.HealthCheckModule(context.Background(), "t1", "nope")
	if ok || !errors.Is(err, ErrModuleNotFound) {
		t.Fatalf("missing row = %v, %v; want false, ErrModuleNotFound", ok, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// -------------------------------------------------------
// Dependency edges
// -------------------------------------------------------

func TestAddDependency_RecordsAnEdgeBetweenModuleNames(t *testing.T) {
	mock, m := regexpManager(t)
	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("m-1", "t1").WillReturnRows(
		moduleRow([]driver.Value{"m-1", "t1", "web", models.ModuleTypeLazy, 5, "", "", models.StatusPending, "", int64(0), nil, nil, nil}))
	mock.ExpectQuery(moduleLookupSQL).WithArgs("core", "t1").WillReturnRows(
		moduleRow([]driver.Value{"m-2", "t1", "core", models.ModuleTypeAuto, 10, "", "", models.StatusPending, "", int64(0), nil, nil, nil}))
	mock.ExpectQuery(`SELECT EXISTS\(SELECT 1 FROM startup_dependencies`).
		WithArgs("t1", "web", "core").WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	mock.ExpectExec(`INSERT INTO startup_dependencies`).
		WithArgs(sqlmock.AnyArg(), "t1", "web", "core", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	dep, err := m.AddDependency(context.Background(), "t1", "m-1", "core")
	if err != nil {
		t.Fatalf("AddDependency: %v", err)
	}
	if dep.ModuleID != "web" || dep.DependsOn != "core" {
		t.Fatalf("edge = %q -> %q, want the module names from migration 275", dep.ModuleID, dep.DependsOn)
	}
	if dep.ID == "" || dep.TenantID != "t1" || dep.CreatedAt.IsZero() {
		t.Fatalf("dependency row = %+v, want id, tenant and created_at populated", dep)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestAddDependency_RejectsSelfDuplicateAndMissingTarget(t *testing.T) {
	mock, m := regexpManager(t)
	rowsOf := func() *sqlmock.Rows {
		return moduleRow([]driver.Value{"m-1", "t1", "web", models.ModuleTypeLazy, 5, "", "", models.StatusPending, "", int64(0), nil, nil, nil})
	}

	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("m-1", "t1").WillReturnRows(rowsOf())
	if _, err := m.AddDependency(context.Background(), "t1", "m-1", "web"); !errors.Is(err, ErrCircularDep) {
		t.Fatalf("self dependency err = %v, want ErrCircularDep", err)
	}

	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("m-1", "t1").WillReturnRows(rowsOf())
	mock.ExpectQuery(moduleLookupSQL).WithArgs("core", "t1").WillReturnRows(
		moduleRow([]driver.Value{"m-2", "t1", "core", models.ModuleTypeAuto, 10, "", "", models.StatusPending, "", int64(0), nil, nil, nil}))
	mock.ExpectQuery(`SELECT EXISTS\(SELECT 1 FROM startup_dependencies`).
		WithArgs("t1", "web", "core").WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))
	if _, err := m.AddDependency(context.Background(), "t1", "m-1", "core"); !errors.Is(err, ErrDuplicateDependency) {
		t.Fatalf("duplicate edge err = %v, want ErrDuplicateDependency", err)
	}

	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("m-1", "t1").WillReturnRows(rowsOf())
	mock.ExpectQuery(moduleLookupSQL).WithArgs("ghost", "t1").WillReturnError(sql.ErrNoRows)
	if _, err := m.AddDependency(context.Background(), "t1", "m-1", "ghost"); !errors.Is(err, ErrModuleNotFound) {
		t.Fatalf("missing target err = %v, want ErrModuleNotFound", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// -------------------------------------------------------
// CRUD error mapping
// -------------------------------------------------------

func TestDeleteModule_MapsNotFoundAndOutages(t *testing.T) {
	mock, m := regexpManager(t)
	mock.ExpectExec(`DELETE FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("gone", "t1").
		WillReturnResult(sqlmock.NewResult(0, 0))
	if err := m.DeleteModule(context.Background(), "t1", "gone"); !errors.Is(err, ErrModuleNotFound) {
		t.Fatalf("deleting a missing row err = %v, want ErrModuleNotFound", err)
	}

	mock.ExpectExec(`DELETE FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("m-1", "t1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	if err := m.DeleteModule(context.Background(), "t1", "m-1"); err != nil {
		t.Fatalf("DeleteModule: %v", err)
	}

	mock.ExpectExec(`DELETE FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("m-1", "t1").
		WillReturnError(errors.New("deadlock"))
	if err := m.DeleteModule(context.Background(), "t1", "m-1"); errors.Is(err, ErrModuleNotFound) {
		t.Fatalf("a deadlock was reported as not-found: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestGetModuleByID_And_ListModules(t *testing.T) {
	mock, m := regexpManager(t)
	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("m-1", "t1").WillReturnRows(
		moduleRow([]driver.Value{"m-1", "t1", "web", models.ModuleTypeLazy, 5, "", "", models.StatusActive, "", int64(42), nil, nil, nil}))
	mod, err := m.GetModuleByID(context.Background(), "t1", "m-1")
	if err != nil || mod == nil || mod.Name != "web" {
		t.Fatalf("GetModuleByID = %+v, %v", mod, err)
	}

	mock.ExpectQuery(`FROM startup_modules WHERE tenant_id=\$1 ORDER BY priority DESC, name OFFSET \$2 LIMIT \$3`).
		WithArgs("t1", 10, 5).WillReturnRows(moduleRow())
	mock.ExpectQuery(`SELECT COUNT\(\*\) FROM startup_modules WHERE tenant_id=\$1`).WithArgs("t1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(12))
	items, total, err := m.ListModules(context.Background(), "t1", 10, 5)
	if err != nil || total != 12 {
		t.Fatalf("ListModules = %v, %d, %v", items, total, err)
	}
	if items == nil || len(items) != 0 {
		t.Fatalf("ListModules items = %v, want an empty non-nil slice", items)
	}

	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("nope", "t1").
		WillReturnError(sql.ErrNoRows)
	if _, err := m.GetModuleByID(context.Background(), "t1", "nope"); !errors.Is(err, ErrModuleNotFound) {
		t.Fatalf("missing row err = %v, want ErrModuleNotFound", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestCreateModuleRow(t *testing.T) {
	mock, m := regexpManager(t)
	mock.ExpectQuery(moduleLookupSQL).WithArgs("web", "t1").WillReturnError(sql.ErrNoRows)
	mock.ExpectExec(`INSERT INTO startup_modules \(`).
		WithArgs(sqlmock.AnyArg(), "t1", "web", models.ModuleTypeLazy, 7, "edge", `{"dsn":"db"}`,
			models.StatusPending, "", int64(0), nil, sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	mod, err := m.CreateModuleRow(context.Background(), "t1", &models.CreateModuleRequest{
		Name: "web", Type: models.ModuleTypeLazy, Priority: 7,
		Description: "edge", Config: `{"dsn":"db"}`,
	})
	if err != nil {
		t.Fatalf("CreateModuleRow: %v", err)
	}
	if mod.Name != "web" || mod.TenantID != "t1" || mod.Status != models.StatusPending || mod.ID == "" {
		t.Fatalf("created row = %+v", mod)
	}

	// The duplicate check: only a definitive no-row result may fall through.
	mock.ExpectQuery(moduleLookupSQL).WithArgs("web", "t1").WillReturnRows(
		moduleRow([]driver.Value{"m-1", "t1", "web", models.ModuleTypeAuto, 1, "", "", models.StatusActive, "", int64(0), nil, nil, nil}))
	if _, err := m.CreateModuleRow(context.Background(), "t1", &models.CreateModuleRequest{Name: "web", Type: models.ModuleTypeAuto}); !errors.Is(err, ErrDuplicateModule) {
		t.Fatalf("duplicate name err = %v, want ErrDuplicateModule", err)
	}

	// A failed duplicate check is an outage, not a name clash.
	mock.ExpectQuery(moduleLookupSQL).WithArgs("web", "t1").WillReturnError(errors.New("timeout"))
	if _, err := m.CreateModuleRow(context.Background(), "t1", &models.CreateModuleRequest{Name: "web", Type: models.ModuleTypeAuto}); errors.Is(err, ErrDuplicateModule) {
		t.Fatalf("a timeout was reported as a duplicate name: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestUpdateModuleRow(t *testing.T) {
	mock, m := regexpManager(t)
	row := moduleRow([]driver.Value{"m-1", "t1", "web", models.ModuleTypeLazy, 5, "", "", models.StatusActive, "", int64(0), nil, nil, nil})
	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("m-1", "t1").WillReturnRows(row)
	mock.ExpectExec(`UPDATE startup_modules SET`).WillReturnResult(sqlmock.NewResult(1, 1))

	prio := 9
	mod, err := m.UpdateModuleRow(context.Background(), "t1", "m-1", &models.UpdateModuleRequest{Priority: &prio})
	if err != nil || mod.Priority != 9 {
		t.Fatalf("UpdateModuleRow = %+v, %v", mod, err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestUpdateModuleRow_DatabaseOutageIsNotNotFound(t *testing.T) {
	mock, m := regexpManager(t)
	mock.ExpectQuery(`FROM startup_modules WHERE id=\$1 AND tenant_id=\$2`).WithArgs("m-1", "t1").
		WillReturnError(errors.New("connection refused"))

	if _, err := m.UpdateModuleRow(context.Background(), "t1", "m-1", &models.UpdateModuleRequest{}); errors.Is(err, ErrModuleNotFound) {
		t.Fatalf("a database outage was reported as not-found: %v", err)
	}
}

// -------------------------------------------------------
// Read-only runtime state
// -------------------------------------------------------

func TestGetModuleStatusAndProgress(t *testing.T) {
	mock, m := regexpManager(t)
	if got := m.GetModuleStatus("web"); got != "unknown" {
		t.Fatalf("unregistered module = %q, want unknown", got)
	}

	web := &fakeStartup{name: "web", priority: 5}
	m.Register(web)
	if got := m.GetModuleStatus("web"); got != "pending" {
		t.Fatalf("registered but never started = %q, want pending", got)
	}

	progress := m.GetStartupProgress()
	if progress["total"] != 1 || progress["running"] != 0 || progress["stopped"] != 1 {
		t.Fatalf("progress before Start = %v", progress)
	}
	if !progress["startedAt"].(time.Time).IsZero() {
		t.Fatalf("startedAt = %v, want the zero time before Start", progress["startedAt"])
	}
	modules := progress["modules"].([]map[string]interface{})
	if len(modules) != 1 || modules[0]["status"] != "pending" {
		t.Fatalf("modules = %v, want one pending entry", modules)
	}

	mock.ExpectQuery(moduleLookupSQL).WithArgs("web", "t1").WillReturnError(sql.ErrNoRows)
	if err := m.Start(context.Background(), "t1"); err != nil {
		t.Fatalf("Start: %v", err)
	}
	if got := m.GetModuleStatus("web"); got != "active" {
		t.Fatalf("running module = %q, want active", got)
	}
	progress = m.GetStartupProgress()
	if progress["running"] != 1 || progress["stopped"] != 0 {
		t.Fatalf("progress after Start = %v", progress)
	}
	if progress["startedAt"].(time.Time).IsZero() {
		t.Fatal("startedAt was not recorded by Start")
	}

	if err := m.Stop(context.Background()); err != nil {
		t.Fatalf("Stop: %v", err)
	}
	// Stop resets started, so the module goes back to pending rather than
	// reporting an initialisation that no longer exists.
	if got := m.GetModuleStatus("web"); got != "pending" {
		t.Fatalf("after Stop = %q, want pending", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

func TestHealthCheck(t *testing.T) {
	mock, m := regexpManager(t)
	web := &fakeStartup{name: "web", priority: 5}
	sick := &fakeStartup{name: "sick", priority: 4}
	m.Register(web)
	m.Register(sick)

	ok, err := m.HealthCheck(context.Background())
	if ok || !errors.Is(err, ErrNotRunning) {
		t.Fatalf("HealthCheck before Start = %v, %v; want false, ErrNotRunning", ok, err)
	}

	mock.ExpectQuery(moduleLookupSQL).WithArgs("web", "t1").WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery(moduleLookupSQL).WithArgs("sick", "t1").WillReturnError(sql.ErrNoRows)
	if err := m.Start(context.Background(), "t1"); err != nil {
		t.Fatalf("Start: %v", err)
	}
	ok, err = m.HealthCheck(context.Background())
	if !ok || err != nil {
		t.Fatalf("HealthCheck with everything healthy = %v, %v", ok, err)
	}

	// Break the probe after the passing check, so the failure is what is under test.
	sick.healthErr = errors.New("probe timeout")
	ok, err = m.HealthCheck(context.Background())
	if ok || err == nil || !strings.Contains(err.Error(), "sick") {
		t.Fatalf("HealthCheck with a failing probe = %v, %v; want false naming sick", ok, err)
	}

	m.mu.Lock()
	m.running["sick"] = false
	m.mu.Unlock()
	ok, err = m.HealthCheck(context.Background())
	if ok || err == nil {
		t.Fatalf("HealthCheck with a stopped module = %v, %v; want false with a reason", ok, err)
	}
	if !strings.Contains(err.Error(), "sick") {
		t.Fatalf("error = %v, want the unhealthy module named", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
