package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/cmdb-collector/repository"
)

// Service orchestration tests.
//
// The service is the layer that decides WHICH tenant a target or device
// belongs to before it is handed to a collector adapter. Two things are
// pinned here: the (id, tenantID) lookup order passed to the repository, and
// the behaviour of a service built with a nil registry — cmd/server wires
// nil because no adapter implementations ship with this module, and before
// NewService replaced nil with an empty registry the same call crashed with
// a nil-pointer dereference instead of returning an error.

type exactMatcher struct{}

func (exactMatcher) Match(expected, actual string) error {
	normalize := func(s string) string {
		return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
	}
	if normalize(actual) == normalize(expected) {
		return nil
	}
	return fmt.Errorf("SQL mismatch\n  got:  %s\n  want: %s", normalize(actual), normalize(expected))
}

const (
	runDiscoveryTargetSQL    = "SELECT id, name, host, port, \"type\", protocol, tenant_id, config, metadata, created_at, updated_at FROM cmdb_targets WHERE id = $1 AND tenant_id = $2"
	runCollectionDeviceSQL   = "SELECT id, device_id, name, \"type\", vendor, model, ip, serial_number, tenant_id, target_id, adapter, last_seen_at, attributes, status, metadata, created_at, updated_at FROM cmdb_devices WHERE id = $1 AND tenant_id = $2"
	listTargetsTenantOnlySQL = "SELECT id, name, host, port, \"type\", protocol, tenant_id, config, metadata, created_at, updated_at FROM cmdb_targets WHERE tenant_id = $1 ORDER BY created_at DESC OFFSET $2 LIMIT $3"
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
)

func mockRepo(t *testing.T) (sqlmock.Sqlmock, *repository.Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(exactMatcher{}))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, repository.NewRepository(sqlx.NewDb(db, "postgres"))
}

// newSvc mirrors cmd/server wiring: a nil registry and nil options.
func newSvc(t *testing.T) (sqlmock.Sqlmock, *Service) {
	t.Helper()
	mock, repo := mockRepo(t)
	return mock, NewService(repo, nil, nil)
}

func svcTargetRow(id, tenantID string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows(targetCols).
		AddRow(id, "web-01", "10.0.0.1", 161, "network", "snmp", tenantID,
			[]byte(`{"community":"public"}`), nil, now, now)
}

func svcDeviceRow(id, tenantID string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows(deviceCols).
		AddRow(id, "dev-1", "web-01", "server", "dell", "r740", "10.0.0.1", "SN123",
			tenantID, nil, "snmp", nil, nil, "active", nil, now, now)
}

// ==================== RunDiscovery ====================

func TestRunDiscovery_TargetLookupIsTenantScoped(t *testing.T) {
	mock, svc := newSvc(t)
	mock.ExpectQuery(runDiscoveryTargetSQL).
		WithArgs("t-1", "tenant-1").
		WillReturnRows(svcTargetRow("t-1", "tenant-1"))

	_, err := svc.RunDiscovery(context.Background(), "tenant-1", "t-1", "snmp", nil)
	if err == nil {
		t.Fatal("expected an error for an unregistered adapter")
	}
	if !errors.Is(err, ErrCollectorNotFound) {
		t.Fatalf("expected ErrCollectorNotFound after the tenant lookup, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestRunDiscovery_ForeignTenantTargetIsRejected(t *testing.T) {
	mock, svc := newSvc(t)
	// The row returned by the driver is labelled with another tenant; the
	// service must pass the caller's tenant down so the WHERE clause filters
	// it out at the DB layer rather than trusting whatever id was supplied.
	mock.ExpectQuery(runDiscoveryTargetSQL).
		WithArgs("t-foreign", "tenant-1").
		WillReturnRows(svcTargetRow("t-foreign", "tenant-2"))

	_, err := svc.RunDiscovery(context.Background(), "tenant-1", "t-foreign", "snmp", nil)
	if err == nil {
		t.Fatal("expected the tenant-scoped lookup to resolve, then an adapter error")
	}
	if !errors.Is(err, ErrCollectorNotFound) {
		t.Fatalf("expected ErrCollectorNotFound, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestRunDiscovery_MissingTargetIsNotLookupError(t *testing.T) {
	mock, svc := newSvc(t)
	mock.ExpectQuery(runDiscoveryTargetSQL).
		WithArgs("t-missing", "tenant-1").
		WillReturnError(sql.ErrNoRows)

	_, err := svc.RunDiscovery(context.Background(), "tenant-1", "t-missing", "snmp", nil)
	if !errors.Is(err, ErrMissingTarget) {
		t.Fatalf("expected ErrMissingTarget, got %v", err)
	}
}

func TestRunDiscovery_EmptyTenantIsRejected(t *testing.T) {
	_, svc := newSvc(t)
	_, err := svc.RunDiscovery(context.Background(), "", "t-1", "snmp", nil)
	if !errors.Is(err, ErrMissingTenant) {
		t.Fatalf("expected ErrMissingTenant, got %v", err)
	}
}

func TestRunDiscovery_EmptyTargetIDIsRejected(t *testing.T) {
	_, svc := newSvc(t)
	_, err := svc.RunDiscovery(context.Background(), "tenant-1", "", "snmp", nil)
	if !errors.Is(err, ErrMissingTarget) {
		t.Fatalf("expected ErrMissingTarget, got %v", err)
	}
}

// ==================== RunCollection ====================

func TestRunCollection_DeviceLookupIsTenantScoped(t *testing.T) {
	mock, svc := newSvc(t)
	mock.ExpectQuery(runCollectionDeviceSQL).
		WithArgs("d-1", "tenant-1").
		WillReturnRows(svcDeviceRow("d-1", "tenant-1"))

	_, err := svc.RunCollection(context.Background(), "tenant-1", "d-1", "snmp", nil)
	if err == nil {
		t.Fatal("expected an error for an unregistered adapter")
	}
	if !errors.Is(err, ErrCollectorNotFound) {
		t.Fatalf("expected ErrCollectorNotFound after the tenant lookup, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestRunCollection_MissingDeviceIsNotLookupError(t *testing.T) {
	mock, svc := newSvc(t)
	mock.ExpectQuery(runCollectionDeviceSQL).
		WithArgs("d-missing", "tenant-1").
		WillReturnError(sql.ErrNoRows)

	_, err := svc.RunCollection(context.Background(), "tenant-1", "d-missing", "snmp", nil)
	if !errors.Is(err, ErrMissingDevice) {
		t.Fatalf("expected ErrMissingDevice, got %v", err)
	}
}

func TestRunCollection_EmptyTenantIsRejected(t *testing.T) {
	_, svc := newSvc(t)
	_, err := svc.RunCollection(context.Background(), "", "d-1", "snmp", nil)
	if !errors.Is(err, ErrMissingTenant) {
		t.Fatalf("expected ErrMissingTenant, got %v", err)
	}
}

// ==================== ListTargets ====================

func TestListTargets_DelegatesTenantAndType(t *testing.T) {
	mock, svc := newSvc(t)
	mock.ExpectQuery(listTargetsTenantOnlySQL).
		WithArgs("tenant-1", 0, 50).
		WillReturnRows(svcTargetRow("t-1", "tenant-1"))

	items, err := svc.ListTargets(context.Background(), "tenant-1", "", 0, 50)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 || items[0].ID != "t-1" {
		t.Fatalf("unexpected targets: %+v", items)
	}
	if items[0].Config["community"] != "public" {
		t.Fatalf("config was not decoded: %+v", items[0].Config)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestListTargets_EmptyTenantIsRejected(t *testing.T) {
	_, svc := newSvc(t)
	items, err := svc.ListTargets(context.Background(), "", "", 0, 50)
	if !errors.Is(err, ErrMissingTenant) {
		t.Fatalf("expected ErrMissingTenant, got %v", err)
	}
	if items != nil {
		t.Fatalf("expected no targets, got %+v", items)
	}
}

func TestListTargets_NilRepositoryIsEmpty(t *testing.T) {
	svc := NewService(nil, nil, nil)
	items, err := svc.ListTargets(context.Background(), "tenant-1", "", 0, 50)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if items != nil {
		t.Fatalf("expected nil from a nil repository, got %+v", items)
	}
}

// ==================== Registry lifecycle ====================

func TestNewService_NilRegistryBecomesEmptyRegistry(t *testing.T) {
	_, svc := newSvc(t)
	// Before NewService replaced a nil registry with an empty one, this call
	// dereferenced nil and crashed the process.
	items := svc.ListCollectors()
	if items == nil || len(items) != 0 {
		t.Fatalf("expected an empty catalog, got %+v", items)
	}
}

func TestNewService_NilRegistryDiscoveryAnswersError(t *testing.T) {
	mock, svc := newSvc(t)
	mock.ExpectQuery(runDiscoveryTargetSQL).
		WithArgs("t-1", "tenant-1").
		WillReturnRows(svcTargetRow("t-1", "tenant-1"))

	_, err := svc.RunDiscovery(context.Background(), "tenant-1", "t-1", "snmp", nil)
	if !errors.Is(err, ErrCollectorNotFound) {
		t.Fatalf("expected a clean ErrCollectorNotFound instead of a panic, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestNewService_DefaultsCollectorTimeout(t *testing.T) {
	_, svc := newSvc(t)
	if svc.collectorTimeout != 30*time.Second {
		t.Fatalf("collectorTimeout = %v, want 30s", svc.collectorTimeout)
	}
	svc = NewService(nil, nil, &ServiceOptions{CollectorTimeout: time.Second})
	if svc.collectorTimeout != time.Second {
		t.Fatalf("collectorTimeout = %v, want 1s", svc.collectorTimeout)
	}
}
