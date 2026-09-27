package repository

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// These three list methods used to have no LIMIT and no OFFSET at all: the
// handler parsed page and limit, the service advertised them in its interface,
// and every query returned the whole table. Nothing could tell, because the
// repository tests only exercised the constructor and the interface contract.
//
// ExpectQuery pins the exact SQL and WithArgs pins the bind order, so a bind
// where limit and offset are reversed — which silently returns a different
// page than the one asked for — fails here rather than in production.

func newMockPaginationRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

func TestListSkills_BindsLimitAndOffsetInOrder(t *testing.T) {
	mock, repo := newMockPaginationRepo(t)
	mock.ExpectQuery(`SELECT * FROM skills WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`).
		WithArgs("tenant-1", 25, 50).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}))

	if _, err := repo.ListSkills(context.Background(), "tenant-1", "", "", 50, 25); err != nil {
		t.Fatalf("ListSkills: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ListSkills bindings: %v", err)
	}
}

func TestListSkills_BindsLimitAndOffsetAfterFilters(t *testing.T) {
	mock, repo := newMockPaginationRepo(t)
	mock.ExpectQuery(`SELECT * FROM skills WHERE tenant_id = $1 AND category = $2 AND status = $3 ORDER BY created_at DESC LIMIT $4 OFFSET $5`).
		WithArgs("tenant-1", "ci", "approved", 40, 20).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}))

	if _, err := repo.ListSkills(context.Background(), "tenant-1", "ci", "approved", 20, 40); err != nil {
		t.Fatalf("ListSkills: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ListSkills bindings: %v", err)
	}
}

func TestListSkills_PaginatesAtAll(t *testing.T) {
	// A missing LIMIT / OFFSET clause would return the whole table and would
	// also leave the two bound args unbound, which ExpectQuery rejects.
	mock, repo := newMockPaginationRepo(t)
	mock.ExpectQuery(`SELECT * FROM skills WHERE tenant_id = $1 ORDER BY created_at DESC`).
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id"}))
	if _, err := repo.ListSkills(context.Background(), "tenant-1", "", "", 0, 20); err == nil {
		t.Fatalf("ListSkills without a LIMIT clause still ran: a page must not become a full-table read")
	}
}

func TestListExecutions_BindsLimitAndOffsetInOrder(t *testing.T) {
	mock, repo := newMockPaginationRepo(t)
	mock.ExpectQuery(`SELECT * FROM skill_executions WHERE tenant_id=$1 AND skill_id=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`).
		WithArgs("tenant-1", "skill-1", 25, 50).
		WillReturnRows(sqlmock.NewRows([]string{"id", "skill_id", "tenant_id"}))

	if _, err := repo.ListExecutions(context.Background(), "tenant-1", "skill-1", 50, 25); err != nil {
		t.Fatalf("ListExecutions: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ListExecutions bindings: %v", err)
	}
}

func TestListAuditLogs_BindsLimitAndOffsetInOrder(t *testing.T) {
	mock, repo := newMockPaginationRepo(t)
	mock.ExpectQuery(`SELECT * FROM skill_audit_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`).
		WithArgs("tenant-1", 25, 50).
		WillReturnRows(sqlmock.NewRows([]string{"id", "skill_id", "tenant_id"}))

	if _, err := repo.ListAuditLogs(context.Background(), "tenant-1", "", 50, 25); err != nil {
		t.Fatalf("ListAuditLogs: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ListAuditLogs bindings: %v", err)
	}
}

func TestCountSkills_CountsBehindTheSamePredicate(t *testing.T) {
	mock, repo := newMockPaginationRepo(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM skills WHERE tenant_id = $1 AND category = $2 AND status = $3`).
		WithArgs("tenant-1", "ci", "approved").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(7))

	total, err := repo.CountSkills(context.Background(), "tenant-1", "ci", "approved")
	if err != nil {
		t.Fatalf("CountSkills: %v", err)
	}
	if total != 7 {
		t.Errorf("CountSkills = %d, want 7", total)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("CountSkills bindings: %v", err)
	}
}

func TestCountAuditLogs_CountsBehindTheSamePredicate(t *testing.T) {
	mock, repo := newMockPaginationRepo(t)
	mock.ExpectQuery(`SELECT COUNT(*) FROM skill_audit_logs WHERE tenant_id=$1 AND skill_id=$2`).
		WithArgs("tenant-1", "skill-1").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

	total, err := repo.CountAuditLogs(context.Background(), "tenant-1", "skill-1")
	if err != nil {
		t.Fatalf("CountAuditLogs: %v", err)
	}
	if total != 3 {
		t.Errorf("CountAuditLogs = %d, want 3", total)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("CountAuditLogs bindings: %v", err)
	}
}
