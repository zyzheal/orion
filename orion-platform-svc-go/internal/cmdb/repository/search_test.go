package repository

import (
	"database/sql/driver"
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// columnsCI is the column list for cmdb_cis SELECT *.
var columnsCI = []string{
	"id", "ci_id", "name", "ci_type", "status", "description",
	"tenant_id", "created_by", "environment", "tags", "created_at", "updated_at",
}

// makeCiRow returns the 12 driver.Values for a cmdb_cis row.
func makeCiRow(id, ciID, name, ciType, status, tenantID, createdBy, env, tags string) []driver.Value {
	now := time.Now().UTC()
	return []driver.Value{
		id, ciID, name, ciType, status, sql.NullString{Valid: false},
		tenantID, createdBy, env, tags, now, now,
	}
}

func TestRepository_SearchCIs_ReturnsResults(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()
	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewRepository(sqlxDB)
	ctx := context.Background()
	tenant := "tenant-1"

	mock.ExpectQuery("SELECT \\* FROM cmdb_cis").
		WithArgs(tenant, "web:*", "web:*", 20, 0).
		WillReturnRows(sqlmock.NewRows(columnsCI).
			AddRow(makeCiRow("ci-1", "ci-web-1", "Web Server", "Server", "active", tenant, "admin", "prod", "[]")...))

	items, err := repo.SearchCIs(ctx, tenant, "web", "", 20, 0)
	if err != nil {
		t.Fatalf("SearchCIs returned error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 result, got %d", len(items))
	}
	if items[0].Name != "Web Server" {
		t.Errorf("expected name 'Web Server', got %q", items[0].Name)
	}
}

func TestRepository_SearchCIs_DomainFilter(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()
	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewRepository(sqlxDB)
	ctx := context.Background()
	tenant := "tenant-1"

	mock.ExpectQuery("SELECT \\* FROM cmdb_cis").
		WithArgs(tenant, "app:*", "Application", "app:*", 20, 0).
		WillReturnRows(sqlmock.NewRows(columnsCI).
			AddRow(makeCiRow("ci-2", "ci-app-1", "My App", "Application", "active", tenant, "admin", "dev", "[]")...))

	items, err := repo.SearchCIs(ctx, tenant, "app", "Application", 20, 0)
	if err != nil {
		t.Fatalf("SearchCIs returned error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 result, got %d", len(items))
	}
	if items[0].CIType != "Application" {
		t.Errorf("expected ciType 'Application', got %q", items[0].CIType)
	}
}

func TestRepository_SearchCIs_NoResults(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()
	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewRepository(sqlxDB)
	ctx := context.Background()
	tenant := "tenant-1"

	mock.ExpectQuery("SELECT \\* FROM cmdb_cis").
		WithArgs(tenant, "nonexistent:*", "nonexistent:*", 20, 0).
		WillReturnRows(sqlmock.NewRows(columnsCI))

	items, err := repo.SearchCIs(ctx, tenant, "nonexistent", "", 20, 0)
	if err != nil {
		t.Fatalf("SearchCIs returned error: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("expected 0 results, got %d", len(items))
	}
}

func TestRepository_SearchCIs_EmptyQuery(t *testing.T) {
	mockDB, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()
	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewRepository(sqlxDB)
	ctx := context.Background()

	items, err := repo.SearchCIs(ctx, "tenant-1", "", "", 20, 0)
	if err != nil {
		t.Fatalf("SearchCIs returned error: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("expected 0 results for empty query, got %d", len(items))
	}
}

func TestRepository_SearchCIs_DefaultLimit(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()
	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewRepository(sqlxDB)
	ctx := context.Background()
	tenant := "tenant-1"

	mock.ExpectQuery("SELECT \\* FROM cmdb_cis").
		WithArgs(tenant, "db:*", "db:*", 20, 0).
		WillReturnRows(sqlmock.NewRows(columnsCI).
			AddRow(makeCiRow("ci-3", "ci-db-1", "Database", "Database", "active", tenant, "admin", "prod", "[]")...))

	items, err := repo.SearchCIs(ctx, tenant, "db", "", 0, 0)
	if err != nil {
		t.Fatalf("SearchCIs returned error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 result, got %d", len(items))
	}
}

func TestRepository_SearchCIs_DefaultOffset(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()
	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewRepository(sqlxDB)
	ctx := context.Background()
	tenant := "tenant-1"

	mock.ExpectQuery("SELECT \\* FROM cmdb_cis").
		WithArgs(tenant, "db:*", "db:*", 5, 0).
		WillReturnRows(sqlmock.NewRows(columnsCI))

	_, err = repo.SearchCIs(ctx, tenant, "db", "", 5, -1)
	if err != nil {
		t.Fatalf("SearchCIs returned error: %v", err)
	}
}

func TestRepository_SearchCIs_DBError(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()
	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewRepository(sqlxDB)
	ctx := context.Background()

	mock.ExpectQuery("SELECT \\* FROM cmdb_cis").
		WillReturnError(context.DeadlineExceeded)

	_, err = repo.SearchCIs(ctx, "tenant-1", "test", "", 20, 0)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
}

func TestRepository_SearchCIs_Pagination(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()
	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewRepository(sqlxDB)
	ctx := context.Background()
	tenant := "tenant-1"

	rows := sqlmock.NewRows(columnsCI)
	for i := 0; i < 3; i++ {
		rows.AddRow(makeCiRow("ci-"+string(rune('A'+i)), "ci-"+string(rune('A'+i)),
			"Server "+string(rune('A'+i)), "Server", "active", tenant, "admin", "prod", "[]")...)
	}
	mock.ExpectQuery("SELECT \\* FROM cmdb_cis").
		WithArgs(tenant, "server:*", "server:*", 3, 0).
		WillReturnRows(rows)

	items, err := repo.SearchCIs(ctx, tenant, "server", "", 3, 0)
	if err != nil {
		t.Fatalf("SearchCIs returned error: %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("expected 3 results, got %d", len(items))
	}
}

func TestRepository_SearchCIs_CustomOffset(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()
	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewRepository(sqlxDB)
	ctx := context.Background()
	tenant := "tenant-1"

	mock.ExpectQuery("SELECT \\* FROM cmdb_cis").
		WithArgs(tenant, "host:*", "host:*", 10, 10).
		WillReturnRows(sqlmock.NewRows(columnsCI).
			AddRow(makeCiRow("ci-10", "ci-host-10", "Host 10", "Host", "active", tenant, "admin", "prod", "[]")...))

	items, err := repo.SearchCIs(ctx, tenant, "host", "", 10, 10)
	if err != nil {
		t.Fatalf("SearchCIs returned error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 result, got %d", len(items))
	}
}
