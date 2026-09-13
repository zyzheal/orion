package handler

import (
	"database/sql"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/cmdb-collector/repository"
	"orion/platform-svc-go/internal/cmdb-collector/service"
)

// Handler tests run the real RegisterRoutes wiring and send real HTTP requests
// through it, with a middleware that stands in for the JWT layer by writing
// tenant_id and roles into the Gin context.
//
// Two defects are pinned here:
//   - DeleteTarget, GetDevice and GetCollection used to reach the repository
//     without a tenant at all, so any caller holding a route name and an id
//     could read or delete another tenant's rows.
//   - a request with no tenant used to fall through into the shared
//     00000000-0000-0000-0000-000000000000 bucket; the handler now rejects it
//     with 401 before touching the database.
//
// gin.New() is used deliberately without the recovery middleware: a nil-pointer
// dereference in a handler surfaces as a crashed test binary instead of being
// converted into a 500 that looks like a normal failure path.

func init() { gin.SetMode(gin.TestMode) }

type exactMatcher struct{}

func (exactMatcher) Match(expected, actual string) error {
	normalize := func(s string) string {
		return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
	}
	if normalize(actual) == normalize(expected) {
		return nil
	}
	return fmt.Errorf("SQL mismatch\n  got:  %s\n  want: %s",
		normalize(actual), normalize(expected))
}

const (
	deleteTargetSQL  = "DELETE FROM cmdb_targets WHERE id = $1 AND tenant_id = $2"
	getDeviceSQL     = "SELECT id, device_id, name, \"type\", vendor, model, ip, serial_number, tenant_id, target_id, adapter, last_seen_at, attributes, status, metadata, created_at, updated_at FROM cmdb_devices WHERE id = $1 AND tenant_id = $2"
	getCollectionSQL = "SELECT id, collection_id, collector, device_id, target_id, tenant_id, phase, status, attribute_count, attributes, error, duration_ms, created_at FROM cmdb_collections WHERE collection_id = $1 AND tenant_id = $2"
	listTargetsSQL   = "SELECT id, name, host, port, \"type\", protocol, tenant_id, config, metadata, created_at, updated_at FROM cmdb_targets WHERE tenant_id = $1 ORDER BY created_at DESC OFFSET $2 LIMIT $3"
)

var (
	targetCols = []string{
		"id", "name", "host", "port", "type", "protocol", "tenant_id",
		"config", "metadata", "created_at", "updated_at",
	}
	deviceCols = []string{
		"id", "device_id", "name", "type", "vendor", "model", "ip", "serial_number",
		"tenant_id", "target_id", "adapter", "last_seen_at", "attributes", "status",
		"metadata", "created_at", "updated_at",
	}
	collectionCols = []string{
		"id", "collection_id", "collector", "device_id", "target_id", "tenant_id",
		"phase", "status", "attribute_count", "attributes", "error", "duration_ms",
		"created_at",
	}
)

// newRouter builds the production route tree. tenantID is "" to simulate a
// request the JWT middleware did not stamp.
func newRouter(t *testing.T, tenantID string) (sqlmock.Sqlmock, *gin.Engine) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(exactMatcher{}))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	e := gin.New()
	e.Use(func(c *gin.Context) {
		if tenantID != "" {
			c.Set("tenant_id", tenantID)
		}
		c.Set("roles", []string{"admin"})
		c.Next()
	})
	svc := service.NewService(repository.NewRepository(sqlx.NewDb(db, "postgres")), nil, nil)
	NewHandler(svc).RegisterRoutes(e.Group("/api/v1"))
	return mock, e
}

func targetRow(id, tenantID string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows(targetCols).
		AddRow(id, "web-01", "10.0.0.1", 161, "network", "snmp", tenantID,
			[]byte(`{"community":"public"}`), nil, now, now)
}

func deviceRow(id, tenantID string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows(deviceCols).
		AddRow(id, "dev-1", "web-01", "server", "dell", "r740", "10.0.0.1", "SN123",
			tenantID, nil, "snmp", nil, nil, "active", nil, now, now)
}

func collectionRow(collectionID, tenantID string) *sqlmock.Rows {
	return sqlmock.NewRows(collectionCols).
		AddRow("c-1", collectionID, "snmp", nil, "t-1", tenantID,
			"discover", "success", 3, nil, nil, 12, time.Now().UTC())
}

func request(method, target string, body string) *http.Request {
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	return req
}

// ==================== DeleteTarget ====================

func TestDeleteTarget_ForwardsCallerTenant(t *testing.T) {
	mock, e := newRouter(t, "tenant-1")
	mock.ExpectExec(deleteTargetSQL).
		WithArgs("t-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(http.MethodDelete, "/api/v1/collector/collectors/snmp/targets/t-1", ""))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "deleted") {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestDeleteTarget_ZeroRowsIs404(t *testing.T) {
	mock, e := newRouter(t, "tenant-1")
	mock.ExpectExec(deleteTargetSQL).
		WithArgs("t-foreign", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 0))

	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(http.MethodDelete, "/api/v1/collector/collectors/snmp/targets/t-foreign", ""))

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for an id unknown to the tenant, got %d: %s", w.Code, w.Body.String())
	}
}

func TestDeleteTarget_MissingTenantIs401(t *testing.T) {
	_, e := newRouter(t, "")
	// No exec expectation is registered on purpose: if the handler issued the
	// delete, sqlmock would answer an error and the endpoint would fall through
	// to 500. A 401 therefore proves the tenant check short-circuits before any
	// SQL is issued, so a tenant-less caller cannot delete by id alone.
	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(http.MethodDelete, "/api/v1/collector/collectors/snmp/targets/t-1", ""))

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "tenant_id") {
		t.Fatalf("expected a tenant error message, got: %s", w.Body.String())
	}
}

// ==================== GetDevice ====================

func TestGetDevice_ForwardsCallerTenant(t *testing.T) {
	mock, e := newRouter(t, "tenant-1")
	mock.ExpectQuery(getDeviceSQL).
		WithArgs("d-1", "tenant-1").
		WillReturnRows(deviceRow("d-1", "tenant-1"))

	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(http.MethodGet, "/api/v1/collector/devices/d-1", ""))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "web-01") {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestGetDevice_MissingTenantIs401(t *testing.T) {
	_, e := newRouter(t, "")
	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(http.MethodGet, "/api/v1/collector/devices/d-1", ""))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

// ==================== GetCollection ====================

func TestGetCollection_ForwardsCallerTenant(t *testing.T) {
	mock, e := newRouter(t, "tenant-1")
	mock.ExpectQuery(getCollectionSQL).
		WithArgs("col-1", "tenant-1").
		WillReturnRows(collectionRow("col-1", "tenant-1"))

	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(http.MethodGet, "/api/v1/collector/collections/col-1", ""))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "col-1") {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestGetCollection_ZeroRowsIs404(t *testing.T) {
	mock, e := newRouter(t, "tenant-1")
	// A collection_id that belongs to another tenant must come back from the
	// tenant-scoped WHERE clause as a miss, not as a hit.
	mock.ExpectQuery(getCollectionSQL).
		WithArgs("col-foreign", "tenant-1").
		WillReturnError(sql.ErrNoRows)

	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(http.MethodGet, "/api/v1/collector/collections/col-foreign", ""))
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

// ==================== List endpoints ====================

func TestListDevices_MissingTenantIs401(t *testing.T) {
	_, e := newRouter(t, "")
	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(http.MethodGet, "/api/v1/collector/devices?type=server", ""))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestListCollections_MissingTenantIs401(t *testing.T) {
	_, e := newRouter(t, "")
	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(http.MethodGet, "/api/v1/collector/collections", ""))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestListTargets_MissingTenantIs401(t *testing.T) {
	_, e := newRouter(t, "")
	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(http.MethodGet, "/api/v1/collector/collectors/snmp/targets", ""))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

// TestListTargets_DoesNotFilterByAdapterName pins the ListTargets fix: the
// route carries an adapter name, but cmdb_targets has no adapter column, so
// passing :name through as a target-type filter matched nothing and the
// endpoint always answered an empty page.
func TestListTargets_DoesNotFilterByAdapterName(t *testing.T) {
	mock, e := newRouter(t, "tenant-1")
	mock.ExpectQuery(listTargetsSQL).
		WithArgs("tenant-1", 0, 50).
		WillReturnRows(targetRow("t-1", "tenant-1"))

	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(http.MethodGet, "/api/v1/collector/collectors/snmp/targets", ""))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "web-01") {
		t.Fatalf("expected the target in the response, got: %s", w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "snmp") {
		t.Fatalf("expected the adapter name to be echoed as context, got: %s", w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

// ==================== Catalog / health ====================

// cmd/server wires a nil registry; an empty catalog must answer 200 with an
// empty list rather than dereferencing nil.
func TestListCollectors_EmptyCatalogIs200(t *testing.T) {
	_, e := newRouter(t, "tenant-1")
	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(http.MethodGet, "/api/v1/collector/collectors", ""))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 for an empty catalog, got %d: %s", w.Code, w.Body.String())
	}
}

func TestGetCollector_EmptyCatalogIs404(t *testing.T) {
	_, e := newRouter(t, "tenant-1")
	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(http.MethodGet, "/api/v1/collector/collectors/snmp", ""))
	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for an unknown adapter, got %d: %s", w.Code, w.Body.String())
	}
}

// The health route is registered outside the permission middleware, so it must
// serve with no role and no tenant stamp at all.
func TestHealth_DoesNotRequireAuth(t *testing.T) {
	e := gin.New()
	NewHandler(service.NewService(nil, nil, nil)).RegisterRoutes(e.Group("/api/v1"))

	w := httptest.NewRecorder()
	e.ServeHTTP(w, request(http.MethodGet, "/api/v1/collector/health", ""))
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "ok") {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
}
