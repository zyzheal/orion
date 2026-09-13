package repository

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
)

func Test_NewRepository_Nil(t *testing.T) {
	r := NewRepository(nil)
	if r == nil {
		t.Fatal("NewRepository(nil) returned nil")
	}
}

func Test_ErrNotFound_Value(t *testing.T) {
	if ErrNotFound != sql.ErrNoRows {
		t.Fatal("ErrNotFound should equal sql.ErrNoRows")
	}
}

func Test_ErrDuplicate_Message(t *testing.T) {
	if ErrDuplicate.Error() != "duplicate key" {
		t.Fatalf("ErrDuplicate.Error() = %q, want 'duplicate key'", ErrDuplicate.Error())
	}
}

func Test_ErrNotUnique_Message(t *testing.T) {
	if ErrNotUnique.Error() != "duplicate entry" {
		t.Fatalf("ErrNotUnique.Error() = %q, want 'duplicate entry'", ErrNotUnique.Error())
	}
}

func Test_ErrDuplicate_Is(t *testing.T) {
	if !errors.Is(ErrDuplicate, ErrDuplicate) {
		t.Fatal("ErrDuplicate should be Is-comparable to itself")
	}
}

func Test_ErrNotUnique_Is(t *testing.T) {
	if !errors.Is(ErrNotUnique, ErrNotUnique) {
		t.Fatal("ErrNotUnique should be Is-comparable to itself")
	}
}

// ==================== Tenant scoping (Round 21) ====================
//
// GetTarget, GetDevice and GetCollection selected by primary key alone and
// DeleteTarget deleted by primary key alone. Because every table carries a
// tenant_id column, those four statements let any caller who knew an id read —
// or remove — another tenant's target, device or collection. The tests below
// pin the tenant predicate on each statement and the (id, tenantID) argument
// order, using an exact SQL matcher so a statement that drops the predicate
// cannot satisfy its expectation.

const (
	getTargetSQL       = "SELECT id, name, host, port, \"type\", protocol, tenant_id, config, metadata, created_at, updated_at FROM cmdb_targets WHERE id = $1 AND tenant_id = $2"
	deleteTargetSQL    = "DELETE FROM cmdb_targets WHERE id = $1 AND tenant_id = $2"
	getDeviceSQL       = "SELECT id, device_id, name, \"type\", vendor, model, ip, serial_number, tenant_id, target_id, adapter, last_seen_at, attributes, status, metadata, created_at, updated_at FROM cmdb_devices WHERE id = $1 AND tenant_id = $2"
	getCollectionSQL   = "SELECT id, collection_id, collector, device_id, target_id, tenant_id, phase, status, attribute_count, attributes, error, duration_ms, created_at FROM cmdb_collections WHERE collection_id = $1 AND tenant_id = $2"
	listCollectionsSQL = "SELECT id, collection_id, collector, device_id, target_id, tenant_id, phase, status, attribute_count, attributes, error, duration_ms, created_at FROM cmdb_collections WHERE tenant_id = $1 AND collector = $2 ORDER BY created_at DESC OFFSET $3 LIMIT $4"
	listDevicesSQL     = "SELECT id, device_id, name, \"type\", vendor, model, ip, serial_number, tenant_id, target_id, adapter, last_seen_at, attributes, status, metadata, created_at, updated_at FROM cmdb_devices WHERE tenant_id = $1 AND \"type\" = $2 ORDER BY last_seen_at DESC OFFSET $3 LIMIT $4"
)

var (
	targetColumns = []string{
		"id", "name", "host", "port", "type", "protocol", "tenant_id",
		"config", "metadata", "created_at", "updated_at",
	}
	deviceColumns = []string{
		"id", "device_id", "name", "type", "vendor", "model", "ip", "serial_number",
		"tenant_id", "target_id", "adapter", "last_seen_at", "attributes", "status",
		"metadata", "created_at", "updated_at",
	}
	collectionColumns = []string{
		"id", "collection_id", "collector", "device_id", "target_id", "tenant_id",
		"phase", "status", "attribute_count", "attributes", "error", "duration_ms",
		"created_at",
	}
)

// normalizeSQL collapses whitespace so multi-line statements compare by shape
// rather than indentation.
func normalizeSQL(s string) string {
	return strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(s, " "))
}

// exactMatcher compares statements after normalizing whitespace. It is what
// makes the tenant-predicate pins below meaningful: a statement that drops the
// tenant clause differs textually and therefore fails.
type exactMatcher struct{}

func (exactMatcher) Match(expected, actual string) error {
	if normalizeSQL(actual) == normalizeSQL(expected) {
		return nil
	}
	return fmt.Errorf("SQL mismatch\n  got:  %s\n  want: %s",
		normalizeSQL(actual), normalizeSQL(expected))
}

func exactRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(exactMatcher{}))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

func targetRow(id, tenantID string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows(targetColumns).
		AddRow(id, "web-01", "10.0.0.1", 161, "network", "snmp", tenantID,
			nil, nil, now, now)
}

func deviceRow(id, tenantID string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows(deviceColumns).
		AddRow(id, "dev-1", "web-01", "server", "dell", "r740", "10.0.0.1", "SN123",
			tenantID, nil, "snmp", nil, nil, "active", nil, now, now)
}

func collectionRow(id, collectionID, tenantID string) *sqlmock.Rows {
	return sqlmock.NewRows(collectionColumns).
		AddRow(id, collectionID, "snmp", nil, "t-1", tenantID,
			"discover", "success", 3, nil, nil, 12, time.Now().UTC())
}

// ==================== GetTarget ====================

func TestGetTarget_TenantScopedLookup(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery(getTargetSQL).
		WithArgs("t-1", "tenant-1").
		WillReturnRows(targetRow("t-1", "tenant-1"))

	got, err := r.GetTarget(context.Background(), "tenant-1", "t-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != "t-1" || got.TenantID != "tenant-1" {
		t.Fatalf("unexpected target: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestGetTarget_TenantIsNotSwappableWithID(t *testing.T) {
	mock, r := exactRepo(t)
	// Deliberately wrong order (tenant, id): a call-site swap must be rejected
	// rather than silently looking the id up in the wrong tenant.
	mock.ExpectQuery(getTargetSQL).
		WithArgs("tenant-1", "t-1").
		WillReturnRows(targetRow("t-1", "tenant-1"))

	if _, err := r.GetTarget(context.Background(), "tenant-1", "t-1"); err == nil {
		t.Fatal("expected the swapped argument order to be rejected")
	}
}

func TestGetTarget_NoRowsIsNotFound(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery(getTargetSQL).
		WithArgs("t-missing", "tenant-1").
		WillReturnError(sql.ErrNoRows)

	got, err := r.GetTarget(context.Background(), "tenant-1", "t-missing")
	if got != nil {
		t.Fatalf("expected nil target, got %+v", got)
	}
	if err == nil || err != ErrNotFound {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

// ==================== DeleteTarget ====================

func TestDeleteTarget_TenantScopedDelete(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectExec(deleteTargetSQL).
		WithArgs("t-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.DeleteTarget(context.Background(), "tenant-1", "t-1"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestDeleteTarget_ZeroRowsIsNotFound(t *testing.T) {
	mock, r := exactRepo(t)
	// Zero rows means the id is unknown to this tenant. The delete must report
	// a miss instead of a success, so a foreign id cannot be "deleted" into a
	// 200 response.
	mock.ExpectExec(deleteTargetSQL).
		WithArgs("t-foreign", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 0))

	err := r.DeleteTarget(context.Background(), "tenant-1", "t-foreign")
	if err == nil || err != ErrNotFound {
		t.Fatalf("expected ErrNotFound for a zero-row delete, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestDeleteTarget_ExecErrorIsPropagated(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectExec(deleteTargetSQL).
		WithArgs("t-1", "tenant-1").
		WillReturnError(errors.New("db down"))

	if err := r.DeleteTarget(context.Background(), "tenant-1", "t-1"); err == nil {
		t.Fatal("expected the exec error to be returned")
	}
}

func TestDeleteTarget_RowsAffectedErrorIsPropagated(t *testing.T) {
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(exactMatcher{}))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	r := NewRepository(sqlx.NewDb(db, "postgres"))
	mock.ExpectExec(deleteTargetSQL).
		WithArgs("t-1", "tenant-1").
		WillReturnError(errors.New("rows affected failed"))

	if err := r.DeleteTarget(context.Background(), "tenant-1", "t-1"); err == nil {
		t.Fatal("expected the RowsAffected error to be returned")
	}
}

// ==================== GetDevice ====================

func TestGetDevice_TenantScopedLookup(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery(getDeviceSQL).
		WithArgs("d-1", "tenant-1").
		WillReturnRows(deviceRow("d-1", "tenant-1"))

	got, err := r.GetDevice(context.Background(), "tenant-1", "d-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != "d-1" || got.TenantID != "tenant-1" || got.DeviceID != "dev-1" {
		t.Fatalf("unexpected device: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestGetDevice_NoRowsIsNotFound(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery(getDeviceSQL).
		WithArgs("d-missing", "tenant-1").
		WillReturnError(sql.ErrNoRows)

	got, err := r.GetDevice(context.Background(), "tenant-1", "d-missing")
	if got != nil {
		t.Fatalf("expected nil device, got %+v", got)
	}
	if err == nil || err != ErrNotFound {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

// ==================== GetCollection ====================

func TestGetCollection_TenantScopedLookup(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery(getCollectionSQL).
		WithArgs("col-1", "tenant-1").
		WillReturnRows(collectionRow("c-1", "col-1", "tenant-1"))

	got, err := r.GetCollection(context.Background(), "tenant-1", "col-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.CollectionID != "col-1" || got.TenantID != "tenant-1" || got.AttributeCount != 3 {
		t.Fatalf("unexpected collection: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestGetCollection_NoRowsIsNotFound(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery(getCollectionSQL).
		WithArgs("col-foreign", "tenant-1").
		WillReturnError(sql.ErrNoRows)

	got, err := r.GetCollection(context.Background(), "tenant-1", "col-foreign")
	if got != nil {
		t.Fatalf("expected nil collection, got %+v", got)
	}
	if err == nil || err != ErrNotFound {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

// ==================== List predicates ====================

func TestListCollections_TenantIsFirstPredicate(t *testing.T) {
	mock, r := exactRepo(t)
	// With one filter active the offsets shift to $3/$4. A wrong arg count or
	// order here means either an unscoped list or a list filtered by the wrong
	// value.
	mock.ExpectQuery(listCollectionsSQL).
		WithArgs("tenant-1", "snmp", 0, 20).
		WillReturnRows(collectionRow("c-1", "col-1", "tenant-1"))

	items, err := r.ListCollections(context.Background(), "tenant-1", "snmp", "", "", 0, 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 || items[0].Collector != "snmp" {
		t.Fatalf("unexpected collections: %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}

func TestListDevices_TenantIsFirstPredicate(t *testing.T) {
	mock, r := exactRepo(t)
	mock.ExpectQuery(listDevicesSQL).
		WithArgs("tenant-1", "server", 0, 20).
		WillReturnRows(deviceRow("d-1", "tenant-1"))

	items, err := r.ListDevices(context.Background(), "tenant-1", "server", "", 0, 20)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 || items[0].DeviceType != "server" {
		t.Fatalf("unexpected devices: %+v", items)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected queries: %v", err)
	}
}
