package repository

import (
	"context"
	"testing"
	"time"

	"database/sql"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func TestDNDRepository_FindByUser(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewDNDRepository(sqlxDB)

	now := time.Now()
	start := now.Add(-1 * time.Hour)
	end := now.Add(1 * time.Hour)
	reason := "focus time"

	mock.ExpectQuery("SELECT \\* FROM do_not_disturb WHERE user_id=\\$1 AND tenant_id=\\$2 ORDER BY created_at DESC LIMIT 1").
		WithArgs("user-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "user_id", "start_time", "end_time", "reason", "created_at", "updated_at"}).
			AddRow("dnd-1", "tenant-1", "user-1", start, end, &reason, now, now))

	ctx := context.Background()
	result, err := repo.FindByUser(ctx, "tenant-1", "user-1")
	if err != nil {
		t.Fatalf("FindByUser failed: %v", err)
	}
	if result.UserID != "user-1" {
		t.Errorf("FindByUser UserID = %s, want user-1", result.UserID)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestDNDRepository_FindByUser_NotFound(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewDNDRepository(sqlxDB)

	mock.ExpectQuery("SELECT \\* FROM do_not_disturb WHERE user_id=\\$1 AND tenant_id=\\$2 ORDER BY created_at DESC LIMIT 1").
		WithArgs("user-1", "tenant-1").
		WillReturnError(sql.ErrNoRows)

	ctx := context.Background()
	_, err = repo.FindByUser(ctx, "tenant-1", "user-1")
	if err == nil {
		t.Error("FindByUser expected error for missing record, got nil")
	}
}

func TestDNDRepository_Upsert_Create(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewDNDRepository(sqlxDB)

	now := time.Now()
	start := now.Add(1 * time.Hour)
	end := now.Add(2 * time.Hour)
	reason := "meeting"

	mock.ExpectQuery("INSERT INTO do_not_disturb").
		WithArgs("tenant-1", "user-1", start, end, &reason).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "user_id", "start_time", "end_time", "reason", "created_at", "updated_at"}).
			AddRow("dnd-1", "tenant-1", "user-1", start, end, &reason, now, now))

	ctx := context.Background()
	result, err := repo.Upsert(ctx, "tenant-1", "user-1", start, end, &reason)
	if err != nil {
		t.Fatalf("Upsert create failed: %v", err)
	}
	if result.UserID != "user-1" {
		t.Errorf("Upsert create UserID = %s, want user-1", result.UserID)
	}
}

func TestDNDRepository_Upsert_Update(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewDNDRepository(sqlxDB)

	now := time.Now()
	start := now.Add(1 * time.Hour)
	end := now.Add(2 * time.Hour)
	reason := "updated reason"

	mock.ExpectQuery("INSERT INTO do_not_disturb").
		WithArgs("tenant-1", "user-1", start, end, &reason).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "user_id", "start_time", "end_time", "reason", "created_at", "updated_at"}).
			AddRow("dnd-1", "tenant-1", "user-1", start, end, &reason, now, now))

	ctx := context.Background()
	result, err := repo.Upsert(ctx, "tenant-1", "user-1", start, end, &reason)
	if err != nil {
		t.Fatalf("Upsert update failed: %v", err)
	}
	if result.UserID != "user-1" {
		t.Errorf("Upsert update UserID = %s, want user-1", result.UserID)
	}
}

func TestDNDRepository_DeleteByUser(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewDNDRepository(sqlxDB)

	t.Run("success", func(t *testing.T) {
		mock.ExpectExec("DELETE FROM do_not_disturb").
			WithArgs("user-1", "tenant-1").
			WillReturnResult(sqlmock.NewResult(1, 1))

		ctx := context.Background()
		ok, err := repo.DeleteByUser(ctx, "tenant-1", "user-1")
		if err != nil {
			t.Fatalf("DeleteByUser failed: %v", err)
		}
		if !ok {
			t.Error("DeleteByUser returned false, want true")
		}
	})

	t.Run("not found", func(t *testing.T) {
		mock.ExpectExec("DELETE FROM do_not_disturb").
			WithArgs("user-missing", "tenant-1").
			WillReturnResult(sqlmock.NewResult(1, 0))

		ctx := context.Background()
		ok, err := repo.DeleteByUser(ctx, "tenant-1", "user-missing")
		if err != nil {
			t.Fatalf("DeleteByUser failed: %v", err)
		}
		if ok {
			t.Error("DeleteByUser returned true for missing record, want false")
		}
	})

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestDNDRepository_FindActiveUsers(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := NewDNDRepository(sqlxDB)

	now := time.Now()

	mock.ExpectQuery("SELECT user_id FROM do_not_disturb").
		WithArgs("tenant-1", now).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}).
			AddRow("user-1").
			AddRow("user-2").
			AddRow("user-3"))

	ctx := context.Background()
	users, err := repo.FindActiveUsers(ctx, "tenant-1", now)
	if err != nil {
		t.Fatalf("FindActiveUsers failed: %v", err)
	}
	if len(users) != 3 {
		t.Errorf("FindActiveUsers count = %d, want 3", len(users))
	}
	if users[0] != "user-1" || users[1] != "user-2" || users[2] != "user-3" {
		t.Errorf("FindActiveUsers = %v, want [user-1 user-2 user-3]", users)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}
