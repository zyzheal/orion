package repository

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"orion/platform-svc-go/internal/alert-deduplication/models"
)

func tenantUUID() uuid.UUID {
	return uuid.MustParse("11111111-1111-1111-1111-111111111111")
}

func TestRepository_Insert(t *testing.T) {
	sqlxDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer sqlxDB.Close()
	db := sqlx.NewDb(sqlxDB, "sqlmock")
	repo := NewRepository(db)

	rec := &models.DeduplicationRecord{
		ID:          uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
		TenantID:    tenantUUID(),
		OriginalID:  uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
		DuplicateID: uuid.Nil,
		Fingerprint: "abc123",
		DedupedAt:   time.Now(),
	}

	mock.ExpectExec("INSERT INTO alert_deduplication_records").
		WithArgs(
			rec.ID, rec.TenantID, rec.OriginalID, rec.DuplicateID,
			rec.Fingerprint, rec.DedupedAt,
		).WillReturnResult(sqlmock.NewResult(0, 1))

	err = repo.Insert(context.Background(), rec)
	if err != nil {
		t.Fatalf("Insert: %v", err)
	}
	if err = mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unfulfilled expectations: %v", err)
	}
}

func TestRepository_GetByFingerprint_OK(t *testing.T) {
	sqlxDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer sqlxDB.Close()
	db := sqlx.NewDb(sqlxDB, "sqlmock")
	repo := NewRepository(db)

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT id, tenant_id, original_id, duplicate_id, fingerprint, deduped_at").
		WithArgs(tenantUUID(), "fingerprint-x").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "original_id", "duplicate_id", "fingerprint", "deduped_at",
		}).AddRow(
			uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
			tenantUUID(),
			uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
			uuid.Nil,
			"fingerprint-x",
			now,
		))

	got, err := repo.GetByFingerprint(context.Background(), tenantUUID(), "fingerprint-x")
	if err != nil {
		t.Fatalf("GetByFingerprint: %v", err)
	}
	if got.ID.String() != "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" {
		t.Fatalf("ID = %s, want aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", got.ID.String())
	}
	if got.Fingerprint != "fingerprint-x" {
		t.Fatalf("Fingerprint = %s, want fingerprint-x", got.Fingerprint)
	}
}

func TestRepository_GetByFingerprint_NotFound(t *testing.T) {
	sqlxDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer sqlxDB.Close()
	db := sqlx.NewDb(sqlxDB, "sqlmock")
	repo := NewRepository(db)

	mock.ExpectQuery("SELECT id, tenant_id, original_id, duplicate_id, fingerprint, deduped_at").
		WithArgs(tenantUUID(), "missing").
		WillReturnError(sql.ErrNoRows)

	_, err = repo.GetByFingerprint(context.Background(), tenantUUID(), "missing")
	if err == nil {
		t.Fatalf("expected NotFound, got nil")
	}
}

func TestRepository_CountActive(t *testing.T) {
	sqlxDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer sqlxDB.Close()
	db := sqlx.NewDb(sqlxDB, "sqlmock")
	repo := NewRepository(db)

	since := time.Now().UTC()
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM alert_deduplication_records").
		WithArgs(tenantUUID(), since).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(42))

	count, err := repo.CountActive(context.Background(), tenantUUID(), since)
	if err != nil {
		t.Fatalf("CountActive: %v", err)
	}
	if count != 42 {
		t.Fatalf("CountActive = %d, want 42", count)
	}
}
