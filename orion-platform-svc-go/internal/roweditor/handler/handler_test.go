package handler

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/roweditor"
	"orion/platform-svc-go/internal/roweditor/handler/models"
	"orion/platform-svc-go/internal/roweditor/repository"
	"orion/platform-svc-go/internal/roweditor/service"
)

func init() { gin.SetMode(gin.TestMode) }

// Handler tests run the real RegisterRoutes wiring and send real HTTP requests
// through it, with a middleware that stands in for the JWT layer by writing
// tenant_id and roles into the Gin context.
//
// Pinned here:
//   - POST /row-editors/register used to answer 500 for every request, because
//     ColumnSpec.Validate is a func field that encoding/json refuses to
//     marshal. Nothing was persisted and no editor survived a restart.
//   - a request the JWT middleware did not stamp used to fall through into an
//     unscoped query instead of being rejected with 401.
//   - the tenant now comes from the JWT context: a tenant_id in the request
//     body is discarded, and the SET/WHERE placeholders no longer collide.
//
// gin.New() is used deliberately without the recovery middleware, so a
// nil-pointer dereference in a handler crashes the test instead of being
// converted into a 500 that looks like a normal failure path.

const tenant = "t1"

// saveSQL is the repository's upsert. Whitespace is normalized before matching,
// so it may be written on one line.
const saveSQL = `INSERT INTO row_editor (id, tenant_id, key, value, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) ON CONFLICT (tenant_id, key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`

// persistedRequiredItems is exactly the JSON the repository stores for
// requiredItemsReq(). Required must be present — that is what survives a
// restart — and Validate must be absent — a func field makes json.Marshal fail.
const persistedRequiredItems = `{"TableName":"items","PrimaryKey":"id","Columns":[{"Name":"id","Type":"string","Nullable":false,"ReadOnly":false,"Unique":false,"Required":false},{"Name":"name","Type":"string","Nullable":false,"ReadOnly":false,"Unique":false,"Required":true}],"VersionColumn":"","SoftDelete":false}`

const editorGetSQL = `SELECT * FROM row_editor WHERE tenant_id=$1 AND key=$2`

// --- fake DB -------------------------------------------------------------

type stmtRecord struct {
	sql  string
	args []any
}

// fakeDB records every statement the editor issues and lets a test drive the
// RowsAffected result. It is the same recorder the service tests use: the
// batch paths are only reachable because BeginTxx returns TxOperations rather
// than a concrete *sqlx.Tx.
type fakeDB struct {
	mu       sync.Mutex
	stmts    []stmtRecord
	affected int64
	// getNoRows makes GetContext return sql.ErrNoRows, which the editor turns
	// into ErrRowNotFound.
	getNoRows bool
}

func (f *fakeDB) record(sqlText string, args []any) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.stmts = append(f.stmts, stmtRecord{sql: sqlText, args: append([]any(nil), args...)})
}

func (f *fakeDB) ExecContext(_ context.Context, query string, args ...any) (sql.Result, error) {
	f.record(query, args)
	return fakeResult{affected: f.affected}, nil
}

func (f *fakeDB) NamedExecContext(_ context.Context, query string, arg any) (sql.Result, error) {
	f.record(query, []any{arg})
	return fakeResult{affected: f.affected}, nil
}

func (f *fakeDB) GetContext(_ context.Context, dest any, query string, args ...any) error {
	f.record(query, args)
	if f.getNoRows {
		return sql.ErrNoRows
	}
	if row, ok := dest.(roweditor.Row); ok {
		row["id"] = "r1"
		row["name"] = "hello"
	}
	return nil
}

func (f *fakeDB) SelectContext(_ context.Context, _ any, query string, args ...any) error {
	f.record(query, args)
	return nil
}

func (f *fakeDB) BeginTxx(context.Context, *sql.TxOptions) (roweditor.TxOperations, error) {
	return f, nil
}

func (f *fakeDB) Commit() error   { return nil }
func (f *fakeDB) Rollback() error { return nil }

func (f *fakeDB) setAffected(n int64) {
	f.mu.Lock()
	f.affected = n
	f.mu.Unlock()
}

func (f *fakeDB) statements() []stmtRecord {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]stmtRecord, len(f.stmts))
	copy(out, f.stmts)
	return out
}

type fakeResult struct{ affected int64 }

func (r fakeResult) LastInsertId() (int64, error) { return 0, sql.ErrNoRows }
func (r fakeResult) RowsAffected() (int64, error) { return r.affected, nil }

// --- environment ---------------------------------------------------------

// testEnv wires the production route tree: a service over a repository that
// persists into sqlmock, and a recording fakeDB for the row operations.
type testEnv struct {
	tenant string
	raw    *sql.DB
	mock   sqlmock.Sqlmock
	db     *fakeDB
	svc    *service.Service
	e      *gin.Engine
}

// mount builds the engine. tenantID of "" simulates a request the JWT
// middleware did not stamp; roles of nil simulates an unauthenticated caller.
func mount(tenantID string, roles []string, svc *service.Service, db roweditor.DBOperations) *gin.Engine {
	e := gin.New()
	e.Use(func(c *gin.Context) {
		if tenantID != "" {
			c.Set("tenant_id", tenantID)
		}
		if roles != nil {
			c.Set("roles", roles)
		}
		c.Next()
	})
	NewHandler(svc, db).RegisterRoutes(e.Group("/api/v1"))
	return e
}

func openMockDB(t *testing.T) (*sql.DB, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		normalize := func(s string) string {
			return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
		}
		if normalize(expected) == normalize(actual) {
			return nil
		}
		return &sqlMismatch{expected: normalize(expected), actual: normalize(actual)}
	})))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db, mock
}

type sqlMismatch struct{ expected, actual string }

func (m *sqlMismatch) Error() string {
	return "sql mismatch:\n  expected: " + m.expected + "\n     actual: " + m.actual
}

func newEnv(t *testing.T, tenantID string) *testEnv {
	t.Helper()
	raw, mock := openMockDB(t)
	svc := service.NewService(repository.NewRepository(sqlx.NewDb(raw, "postgres")))
	db := &fakeDB{affected: 1}
	return &testEnv{tenant: tenantID, raw: raw, mock: mock, db: db, svc: svc, e: mount(tenantID, []string{"admin"}, svc, db)}
}

// restart simulates a process restart: a new service with an empty editor cache
// over the same database, so every editor must be reloaded from the row_editor
// table.
func (env *testEnv) restart(t *testing.T) *testEnv {
	t.Helper()
	db := &fakeDB{affected: 1}
	svc := service.NewService(repository.NewRepository(sqlx.NewDb(env.raw, "postgres")))
	return &testEnv{tenant: env.tenant, raw: env.raw, mock: env.mock, db: db, svc: svc, e: mount(env.tenant, []string{"admin"}, svc, db)}
}

// register persists an editor the way the handler does, registering the save
// expectation first.
func (env *testEnv) register(t *testing.T, req models.RowEditorSpecRequest) {
	t.Helper()
	env.mock.ExpectExec(saveSQL).
		WithArgs(sqlmock.AnyArg(), env.tenant, req.TableName, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	if err := env.svc.RegisterEditor(context.Background(), env.tenant, req.TableName, &req); err != nil {
		t.Fatalf("RegisterEditor() error = %v", err)
	}
}

// seedEditorRow makes the repository return one persisted spec, so an editor
// can be reloaded from the database instead of the cache.
func (env *testEnv) seedEditorRow(t *testing.T, name, specJSON string) {
	t.Helper()
	env.mock.ExpectQuery(editorGetSQL).
		WithArgs(env.tenant, name).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "key", "value", "created_at", "updated_at"}).
			AddRow("33333333-3333-3333-3333-333333333333", env.tenant, name, specJSON, time.Now(), time.Now()))
}

func (env *testEnv) check(t *testing.T) {
	t.Helper()
	if err := env.mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected database activity: %v", err)
	}
}

// --- requests -------------------------------------------------------------

func request(method, target, body string) *http.Request {
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func do(e *gin.Engine, method, target, body string) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(method, target, body))
	return w
}

// --- fixtures -------------------------------------------------------------

func itemsReq() models.RowEditorSpecRequest {
	return models.RowEditorSpecRequest{
		TableName: "items", PrimaryKey: "id", VersionColumn: "version",
		Columns: []models.ColumnSpec{{Name: "id"}, {Name: "name"}},
	}
}

func requiredItemsReq() models.RowEditorSpecRequest {
	return models.RowEditorSpecRequest{
		TableName: "items", PrimaryKey: "id",
		Columns: []models.ColumnSpec{{Name: "id"}, {Name: "name", IsRequired: true}},
	}
}

func TestRowEditorRoutesAreMounted(t *testing.T) {
	env := newEnv(t, tenant)
	want := map[string]bool{
		"POST /api/v1/row-editors/register":      true,
		"GET /api/v1/row-editors/:name/stats":    true,
		"POST /api/v1/rows/:editor/create":       true,
		"GET /api/v1/rows/:editor/:row_id":       true,
		"PUT /api/v1/rows/:editor":               true,
		"DELETE /api/v1/rows/:editor/:row_id":    true,
		"POST /api/v1/rows/:editor/batch-create": true,
		"POST /api/v1/rows/:editor/batch-update": true,
	}
	seen := map[string]bool{}
	for _, r := range env.e.Routes() {
		seen[r.Method+" "+r.Path] = true
	}
	for route := range want {
		if !seen[route] {
			t.Errorf("route %q is not mounted", route)
		}
	}
	if len(seen) != len(want) {
		t.Errorf("mounted %d routes, want %d: %v", len(seen), len(want), seen)
	}
}

// ==================== register ====================

func TestRegisterEditorPersistsSpecAndReturns201(t *testing.T) {
	env := newEnv(t, tenant)
	// Pinning the payload rather than AnyArg is what proves the fix: before it
	// json.Marshal rejected the struct and the handler answered 500.
	env.mock.ExpectExec(saveSQL).
		WithArgs(sqlmock.AnyArg(), tenant, "items", persistedRequiredItems).
		WillReturnResult(sqlmock.NewResult(0, 1))

	w := do(env.e, http.MethodPost, "/api/v1/row-editors/register", `{
		"table_name": "items",
		"primary_key": "id",
		"columns": [{"name": "id"}, {"name": "name", "is_required": true}]
	}`)

	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body = %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "items") {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
	env.check(t)
}

func TestRegisterEditorRejectsUnboundTableName(t *testing.T) {
	env := newEnv(t, tenant)

	w := do(env.e, http.MethodPost, "/api/v1/row-editors/register", `{
		"primary_key": "id", "columns": [{"name": "id"}]
	}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %s", w.Code, w.Body.String())
	}
	env.check(t)
}

func TestRegisterEditorRejectsInvalidTableNameWithoutWriting(t *testing.T) {
	env := newEnv(t, tenant)

	w := do(env.e, http.MethodPost, "/api/v1/row-editors/register", `{
		"table_name": "items; DROP TABLE users",
		"primary_key": "id",
		"columns": [{"name": "id"}]
	}`)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500; body = %s", w.Code, w.Body.String())
	}
	// No expectation was registered for the upsert, so a stray write fails here.
	env.check(t)
}

func TestRegisterEditorUsesQueryName(t *testing.T) {
	env := newEnv(t, tenant)
	env.mock.ExpectExec(saveSQL).
		WithArgs(sqlmock.AnyArg(), tenant, "customers", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	w := do(env.e, http.MethodPost, "/api/v1/row-editors/register?name=customers", `{
		"table_name": "items", "primary_key": "id", "columns": [{"name": "id"}]
	}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body = %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "customers") {
		t.Fatalf("name from the query string was ignored: %s", w.Body.String())
	}
	env.check(t)
}

// ==================== authorization ====================

func TestMissingTenantIsRejectedBeforeSQL(t *testing.T) {
	cases := []struct {
		name, method, target, body string
	}{
		{"register", http.MethodPost, "/api/v1/row-editors/register", `{"table_name":"items","primary_key":"id","columns":[{"name":"id"}]}`},
		{"stats", http.MethodGet, "/api/v1/row-editors/items/stats", ""},
		{"create", http.MethodPost, "/api/v1/rows/items/create", `{"row":{"id":"r1"}}`},
		{"read", http.MethodGet, "/api/v1/rows/items/r1", ""},
		{"update", http.MethodPut, "/api/v1/rows/items", `{"row_id":"r1","changes":{"name":"n"}}`},
		{"delete", http.MethodDelete, "/api/v1/rows/items/r1", ""},
		{"batch create", http.MethodPost, "/api/v1/rows/items/batch-create", `{"rows":[{"id":"r1"}]}`},
		{"batch update", http.MethodPost, "/api/v1/rows/items/batch-update", `{"row_ids":["r1"],"changes":{"name":"n"}}`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// No tenant is stamped: every SQL helper silently drops an empty
			// tenant id, so letting the request through would have produced an
			// unscoped query across all tenants.
			env := newEnv(t, "")

			w := do(env.e, tc.method, tc.target, tc.body)
			if w.Code != http.StatusUnauthorized {
				t.Fatalf("%s status = %d, want 401; body = %s", tc.name, w.Code, w.Body.String())
			}
			if !strings.Contains(w.Body.String(), "tenant_id required") {
				t.Fatalf("%s body = %s", tc.name, w.Body.String())
			}
			if n := len(env.db.statements()); n != 0 {
				t.Fatalf("%s reached the database %d times", tc.name, n)
			}
			// No expectation was registered, so any persistence attempt fails here.
			env.check(t)
		})
	}
}

func TestMissingRoleIsForbidden(t *testing.T) {
	raw, mock := openMockDB(t)
	svc := service.NewService(repository.NewRepository(sqlx.NewDb(raw, "postgres")))
	db := &fakeDB{affected: 1}
	e := mount(tenant, nil, svc, db)

	w := do(e, http.MethodPost, "/api/v1/row-editors/register", `{
		"table_name": "items", "primary_key": "id", "columns": [{"name": "id"}]
	}`)
	if w.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403; body = %s", w.Code, w.Body.String())
	}
	if len(db.statements()) != 0 {
		t.Fatalf("a rejected request must not touch the database, got %d statements", len(db.statements()))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected database activity: %v", err)
	}
}

// ==================== create ====================

func TestCreateRowIgnoresBodyTenant(t *testing.T) {
	env := newEnv(t, tenant)
	env.register(t, itemsReq())

	w := do(env.e, http.MethodPost, "/api/v1/rows/items/create", `{
		"row": {"id": "r1", "name": "n", "tenant_id": "attacker"}
	}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body = %s", w.Code, w.Body.String())
	}
	recs := env.db.statements()
	if len(recs) != 1 {
		t.Fatalf("expected 1 statement, got %d", len(recs))
	}
	wantSQL := "INSERT INTO items (id, name, tenant_id) VALUES (:id, :name, :tenant_id)"
	if recs[0].sql != wantSQL {
		t.Fatalf("insert SQL = %q\n  want %q", recs[0].sql, wantSQL)
	}
	args, ok := recs[0].args[0].(map[string]any)
	if !ok {
		t.Fatalf("insert arg is %T", recs[0].args[0])
	}
	if args["tenant_id"] != tenant {
		t.Fatalf("insert tenant = %v, want %v (the JWT value, not the body value)", args["tenant_id"], tenant)
	}
	if _, leaked := args["attacker"]; leaked {
		t.Fatal("the body tenant id leaked into the insert")
	}
	env.check(t)
}

func TestBatchCreateIgnoresBodyTenant(t *testing.T) {
	env := newEnv(t, tenant)
	env.register(t, itemsReq())

	w := do(env.e, http.MethodPost, "/api/v1/rows/items/batch-create", `{
		"rows": [{"id": "r1", "name": "a", "tenant_id": "attacker"}, {"id": "r2", "name": "b"}]
	}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body = %s", w.Code, w.Body.String())
	}
	recs := env.db.statements()
	if len(recs) != 2 {
		t.Fatalf("expected 2 inserts, got %d", len(recs))
	}
	for i, rec := range recs {
		args, ok := rec.args[0].(map[string]any)
		if !ok {
			t.Fatalf("insert %d arg is %T", i, rec.args[0])
		}
		if args["tenant_id"] != tenant {
			t.Fatalf("insert %d tenant = %v, want %v", i, args["tenant_id"], tenant)
		}
	}
	env.check(t)
}

func TestCreateRowMissingRequiredColumnIs400(t *testing.T) {
	env := newEnv(t, tenant)
	env.register(t, requiredItemsReq())

	w := do(env.e, http.MethodPost, "/api/v1/rows/items/create", `{"row": {"id": "r1"}}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %s", w.Code, w.Body.String())
	}
	if n := len(env.db.statements()); n != 0 {
		t.Fatalf("a rejected create must not reach the database, got %d statements", n)
	}
	env.check(t)
}

func TestCreateRowReadOnlyColumnIs400(t *testing.T) {
	env := newEnv(t, tenant)
	env.register(t, models.RowEditorSpecRequest{
		TableName: "items", PrimaryKey: "id",
		Columns: []models.ColumnSpec{{Name: "id"}, {Name: "status", ReadOnly: true}},
	})

	w := do(env.e, http.MethodPost, "/api/v1/rows/items/create", `{"row": {"id": "r1", "status": "active"}}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %s", w.Code, w.Body.String())
	}
	env.check(t)
}

// ==================== read ====================

func TestReadRowBindsTenantAndReturnsRow(t *testing.T) {
	env := newEnv(t, tenant)
	env.register(t, itemsReq())

	w := do(env.e, http.MethodGet, "/api/v1/rows/items/r1", "")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", w.Code, w.Body.String())
	}
	recs := env.db.statements()
	if len(recs) != 1 {
		t.Fatalf("expected 1 statement, got %d", len(recs))
	}
	wantSQL := "SELECT * FROM items WHERE id=$1 AND tenant_id=$2 AND status!='deleted'"
	if recs[0].sql != wantSQL {
		t.Fatalf("select SQL = %q\n  want %q", recs[0].sql, wantSQL)
	}
	if len(recs[0].args) != 2 || recs[0].args[0] != "r1" || recs[0].args[1] != tenant {
		t.Fatalf("select args = %v, want [r1 %s]", recs[0].args, tenant)
	}
	if !strings.Contains(w.Body.String(), "hello") {
		t.Fatalf("the row was not returned: %s", w.Body.String())
	}
	env.check(t)
}

func TestReadRowMissingIs404(t *testing.T) {
	env := newEnv(t, tenant)
	env.register(t, itemsReq())
	env.db.getNoRows = true

	w := do(env.e, http.MethodGet, "/api/v1/rows/items/r1", "")
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404; body = %s", w.Code, w.Body.String())
	}
	env.check(t)
}

// ==================== update ====================

func TestUpdateRowBindsSetAndWherePlaceholders(t *testing.T) {
	env := newEnv(t, tenant)
	env.register(t, itemsReq())

	// "abc" is shorter than 8 characters: the service used to derive the tenant
	// from RowID[:8], which panicked here.
	w := do(env.e, http.MethodPut, "/api/v1/rows/items", `{
		"row_id": "abc", "changes": {"name": "new"}, "version": 3
	}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", w.Code, w.Body.String())
	}
	recs := env.db.statements()
	if len(recs) != 1 {
		t.Fatalf("expected 1 statement, got %d", len(recs))
	}
	wantSQL := "UPDATE items SET name=$1, updated_at=now(), version=version+1 WHERE id=$2 AND tenant_id=$3 AND version=$4 AND status!='deleted'"
	if recs[0].sql != wantSQL {
		t.Fatalf("update SQL = %q\n  want %q", recs[0].sql, wantSQL)
	}
	wantArgs := []any{"new", "abc", tenant, int64(3)}
	if len(recs[0].args) != len(wantArgs) {
		t.Fatalf("update args = %v, want %v", recs[0].args, wantArgs)
	}
	for i := range wantArgs {
		if recs[0].args[i] != wantArgs[i] {
			t.Fatalf("update arg %d = %v, want %v", i, recs[0].args[i], wantArgs[i])
		}
	}
	if !strings.Contains(w.Body.String(), `"affected":1`) {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
	env.check(t)
}

func TestUpdateRowConflictIs409(t *testing.T) {
	env := newEnv(t, tenant)
	env.register(t, itemsReq())
	env.db.setAffected(0)

	w := do(env.e, http.MethodPut, "/api/v1/rows/items", `{
		"row_id": "r1", "changes": {"name": "new"}, "version": 3
	}`)
	if w.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409; body = %s", w.Code, w.Body.String())
	}
	env.check(t)
}

func TestUpdateRowMissingIs404(t *testing.T) {
	env := newEnv(t, tenant)
	env.register(t, itemsReq())
	env.db.setAffected(0)

	w := do(env.e, http.MethodPut, "/api/v1/rows/items", `{"row_id": "r1", "changes": {"name": "new"}}`)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404; body = %s", w.Code, w.Body.String())
	}
	env.check(t)
}

func TestUpdateRowNoChangesIs400(t *testing.T) {
	env := newEnv(t, tenant)
	env.register(t, itemsReq())

	w := do(env.e, http.MethodPut, "/api/v1/rows/items", `{"row_id": "r1"}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %s", w.Code, w.Body.String())
	}
	if n := len(env.db.statements()); n != 0 {
		t.Fatalf("an empty update must not reach the database, got %d statements", n)
	}
	env.check(t)
}

func TestUpdateRowReadOnlyColumnIs400(t *testing.T) {
	env := newEnv(t, tenant)
	env.register(t, models.RowEditorSpecRequest{
		TableName: "items", PrimaryKey: "id",
		Columns: []models.ColumnSpec{{Name: "id"}, {Name: "name"}, {Name: "status", ReadOnly: true}},
	})

	w := do(env.e, http.MethodPut, "/api/v1/rows/items", `{"row_id": "r1", "changes": {"status": "ok"}}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body = %s", w.Code, w.Body.String())
	}
	env.check(t)
}

// ==================== delete ====================

func TestDeleteRowUsesSpecSoftDelete(t *testing.T) {
	cases := []struct {
		soft    bool
		wantSQL string
	}{
		{true, "UPDATE items SET status='deleted', updated_at=now() WHERE id=$1 AND tenant_id=$2 AND status!='deleted'"},
		{false, "DELETE FROM items WHERE id=$1 AND tenant_id=$2 AND status!='deleted'"},
	}
	for _, tc := range cases {
		t.Run(tc.wantSQL, func(t *testing.T) {
			env := newEnv(t, tenant)
			req := itemsReq()
			req.SoftDelete = tc.soft
			env.register(t, req)

			w := do(env.e, http.MethodDelete, "/api/v1/rows/items/r1", "")
			if w.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200; body = %s", w.Code, w.Body.String())
			}
			recs := env.db.statements()
			if len(recs) != 1 {
				t.Fatalf("expected 1 statement, got %d", len(recs))
			}
			if recs[0].sql != tc.wantSQL {
				t.Fatalf("delete SQL = %q\n  want %q", recs[0].sql, tc.wantSQL)
			}
			if len(recs[0].args) != 2 || recs[0].args[0] != "r1" || recs[0].args[1] != tenant {
				t.Fatalf("delete args = %v", recs[0].args)
			}
			env.check(t)
		})
	}
}

func TestDeleteRowMissingIs404(t *testing.T) {
	env := newEnv(t, tenant)
	env.register(t, itemsReq())
	env.db.setAffected(0)

	w := do(env.e, http.MethodDelete, "/api/v1/rows/items/r1", "")
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404; body = %s", w.Code, w.Body.String())
	}
	env.check(t)
}

// ==================== batch update ====================

func TestBatchUpdateBumpsVersionOncePerStatement(t *testing.T) {
	env := newEnv(t, tenant)
	env.register(t, itemsReq())

	w := do(env.e, http.MethodPost, "/api/v1/rows/items/batch-update", `{
		"row_ids": ["r1", "r2"], "changes": {"name": "bulk"}, "version": 1
	}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", w.Code, w.Body.String())
	}
	recs := env.db.statements()
	if len(recs) != 2 {
		t.Fatalf("expected 2 statements, got %d", len(recs))
	}
	wantSQL := "UPDATE items SET name=$1, updated_at=now(), version=version+1 WHERE id=$2 AND tenant_id=$3 AND version=$4 AND status!='deleted'"
	for i, rec := range recs {
		if rec.sql != wantSQL {
			t.Fatalf("batch statement %d SQL = %q\n  want %q", i, rec.sql, wantSQL)
		}
		// The increment belongs to the statement, not to the row: appending it
		// inside the loop bumped the version once per row of the batch.
		if n := strings.Count(rec.sql, "version=version+1"); n != 1 {
			t.Fatalf("batch statement %d increments the version %d times", i, n)
		}
		wantArgs := []any{"bulk", []string{"r1", "r2"}[i], tenant, int64(1)}
		if len(rec.args) != len(wantArgs) || rec.args[0] != wantArgs[0] || rec.args[1] != wantArgs[1] || rec.args[2] != wantArgs[2] || rec.args[3] != wantArgs[3] {
			t.Fatalf("batch statement %d args = %v, want %v", i, rec.args, wantArgs)
		}
	}
	if !strings.Contains(w.Body.String(), `"affected":2`) {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
	env.check(t)
}

// ==================== stats ====================

func TestStatsReturnsEditorShape(t *testing.T) {
	env := newEnv(t, tenant)
	env.register(t, models.RowEditorSpecRequest{
		TableName: "items", PrimaryKey: "id",
		Columns: []models.ColumnSpec{{Name: "id"}, {Name: "name", ReadOnly: true}},
	})

	w := do(env.e, http.MethodGet, "/api/v1/row-editors/items/stats", "")
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body = %s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	for _, want := range []string{`"table_name":"items"`, `"primary_key":"id"`, `"columns":2`, `"read_only_columns":["name"]`} {
		if !strings.Contains(body, want) {
			t.Fatalf("body missing %s: %s", want, body)
		}
	}
	env.check(t)
}

// ==================== unknown editor ====================

func TestUnknownEditorIs404(t *testing.T) {
	env := newEnv(t, tenant)
	env.mock.ExpectQuery(editorGetSQL).
		WithArgs(tenant, "ghost").
		WillReturnError(sql.ErrNoRows)

	w := do(env.e, http.MethodGet, "/api/v1/row-editors/ghost/stats", "")
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404; body = %s", w.Code, w.Body.String())
	}
	env.check(t)
}

func TestCorruptEditorSpecIs500(t *testing.T) {
	env := newEnv(t, tenant)
	env.mock.ExpectQuery(editorGetSQL).
		WithArgs(tenant, "ghost").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "key", "value", "created_at", "updated_at"}).
			AddRow("44444444-4444-4444-4444-444444444444", tenant, "ghost", "{not json", time.Now(), time.Now()))

	w := do(env.e, http.MethodPost, "/api/v1/rows/ghost/create", `{"row": {"id": "r1"}}`)
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500; body = %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "corrupt spec") {
		t.Fatalf("the corruption was not surfaced: %s", w.Body.String())
	}
	if n := len(env.db.statements()); n != 0 {
		t.Fatalf("a corrupt spec must not reach the row table, got %d statements", n)
	}
	env.check(t)
}

// ==================== restart ====================

func TestEditorSurvivesRestart(t *testing.T) {
	// Before the fix nothing was ever persisted, so this whole path was
	// unreachable: every editor vanished on restart.
	env := newEnv(t, tenant)
	env.mock.ExpectExec(saveSQL).
		WithArgs(sqlmock.AnyArg(), tenant, "items", persistedRequiredItems).
		WillReturnResult(sqlmock.NewResult(0, 1))
	if w := do(env.e, http.MethodPost, "/api/v1/row-editors/register", `{
		"table_name": "items", "primary_key": "id",
		"columns": [{"name": "id"}, {"name": "name", "is_required": true}]
	}`); w.Code != http.StatusCreated {
		t.Fatalf("register status = %d, want 201; body = %s", w.Code, w.Body.String())
	}

	// Restart, then load the spec back out of the database.
	after := env.restart(t)
	after.seedEditorRow(t, "items", persistedRequiredItems)

	// The required rule must still be enforced after the restart. Omitting the
	// column entirely is the bypass the validator used to miss.
	w := do(after.e, http.MethodPost, "/api/v1/rows/items/create", `{"row": {"id": "r1"}}`)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 after restart; body = %s", w.Code, w.Body.String())
	}
	if n := len(after.db.statements()); n != 0 {
		t.Fatalf("a rejected create must not reach the database, got %d statements", n)
	}

	// A complete row is accepted and stamped with the caller's tenant.
	w = do(after.e, http.MethodPost, "/api/v1/rows/items/create", `{"row": {"id": "r1", "name": "n"}}`)
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201 after restart; body = %s", w.Code, w.Body.String())
	}
	recs := after.db.statements()
	if len(recs) != 1 {
		t.Fatalf("expected 1 insert, got %d", len(recs))
	}
	args, ok := recs[0].args[0].(map[string]any)
	if !ok {
		t.Fatalf("insert arg is %T", recs[0].args[0])
	}
	if args["tenant_id"] != tenant {
		t.Fatalf("insert tenant = %v, want %v", args["tenant_id"], tenant)
	}
	after.check(t)
}

func TestEditorIsNotSharedAcrossTenants(t *testing.T) {
	// Tenant A registers "users"; tenant B must not see it, and tenant B
	// registering the same name must not clobber tenant A's editor.
	env := newEnv(t, "tenant-a")
	env.mock.ExpectExec(saveSQL).
		WithArgs(sqlmock.AnyArg(), "tenant-a", "users", sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	if err := env.svc.RegisterEditor(context.Background(), "tenant-a", "users", &models.RowEditorSpecRequest{
		TableName: "tenant_a_users", PrimaryKey: "id",
		Columns: []models.ColumnSpec{{Name: "id"}},
	}); err != nil {
		t.Fatalf("RegisterEditor() error = %v", err)
	}

	// A second process (or a fresh cache) for tenant B over the same database.
	other := env.restart(t)
	other.tenant = "tenant-b"
	other.e = mount("tenant-b", []string{"admin"}, other.svc, other.db)
	// The lookup must be scoped to tenant B. WithArgs pins the argument, so a
	// regression to a bare key lookup fails here instead of returning tenant A's
	// editor.
	other.mock.ExpectQuery(editorGetSQL).
		WithArgs("tenant-b", "users").
		WillReturnError(sql.ErrNoRows)

	w := do(other.e, http.MethodGet, "/api/v1/row-editors/users/stats", "")
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404; tenant B must not read tenant A's editor: %s", w.Code, w.Body.String())
	}
	// The lookup must be scoped to tenant B, not tenant A.
	other.check(t)
}
