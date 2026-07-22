package service

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"go.uber.org/zap"

	"orion/notification-svc-go/internal/notification/repository"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func TestSetDND_Success(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDNDRepository(sqlxDB)
	svc := NewDNDService(repo, zap.NewNop())

	now := time.Now()
	start := now.Add(1 * time.Hour)
	end := now.Add(2 * time.Hour)

	mock.ExpectQuery("INSERT INTO do_not_disturb").
		WithArgs("tenant-1", "user-1", start, end, nil).
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "user_id", "start_time", "end_time", "reason", "created_at", "updated_at"}).
			AddRow("dnd-1", "tenant-1", "user-1", start, end, nil, now, now))

	ctx := context.Background()
	result, err := svc.SetDND(ctx, "tenant-1", "user-1", start, end, nil)
	if err != nil {
		t.Fatalf("SetDND failed: %v", err)
	}
	if result == nil {
		t.Fatal("SetDND returned nil result")
	}
	if result.UserID != "user-1" {
		t.Errorf("SetDND UserID = %s, want user-1", result.UserID)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestSetDND_InvalidTimeRange(t *testing.T) {
	mockDB, _, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDNDRepository(sqlxDB)
	svc := NewDNDService(repo, zap.NewNop())

	now := time.Now()
	start := now.Add(2 * time.Hour)
	end := now.Add(1 * time.Hour)

	ctx := context.Background()
	_, err = svc.SetDND(ctx, "tenant-1", "user-1", start, end, nil)
	if err == nil {
		t.Error("SetDND with end < start expected error, got nil")
	}
}

func TestClearDND_Success(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDNDRepository(sqlxDB)
	svc := NewDNDService(repo, zap.NewNop())

	mock.ExpectExec("DELETE FROM do_not_disturb").
		WithArgs("user-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	ctx := context.Background()
	err = svc.ClearDND(ctx, "tenant-1", "user-1")
	if err != nil {
		t.Fatalf("ClearDND failed: %v", err)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestClearDND_NotFound(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDNDRepository(sqlxDB)
	svc := NewDNDService(repo, zap.NewNop())

	mock.ExpectExec("DELETE FROM do_not_disturb").
		WithArgs("user-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(1, 0))

	ctx := context.Background()
	err = svc.ClearDND(ctx, "tenant-1", "user-1")
	if err != ErrDNDNotFound {
		t.Errorf("ClearDND error = %v, want ErrDNDNotFound", err)
	}
}

func TestIsDndActive_Active(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDNDRepository(sqlxDB)
	svc := NewDNDService(repo, zap.NewNop())

	now := time.Now()
	start := now.Add(-1 * time.Hour)
	end := now.Add(1 * time.Hour)

	mock.ExpectQuery("SELECT \\* FROM do_not_disturb").
		WithArgs("user-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "user_id", "start_time", "end_time", "reason", "created_at", "updated_at"}).
			AddRow("dnd-1", "tenant-1", "user-1", start, end, nil, start, start))

	ctx := context.Background()
	active, err := svc.IsDndActive(ctx, "tenant-1", "user-1")
	if err != nil {
		t.Fatalf("IsDndActive failed: %v", err)
	}
	if !active {
		t.Error("IsDndActive = false, want true (currently in DND window)")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestIsDndActive_Inactive(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDNDRepository(sqlxDB)
	svc := NewDNDService(repo, zap.NewNop())

	now := time.Now()
	start := now.Add(2 * time.Hour)
	end := now.Add(3 * time.Hour)

	mock.ExpectQuery("SELECT \\* FROM do_not_disturb").
		WithArgs("user-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "user_id", "start_time", "end_time", "reason", "created_at", "updated_at"}).
			AddRow("dnd-1", "tenant-1", "user-1", start, end, nil, start, start))

	ctx := context.Background()
	active, err := svc.IsDndActive(ctx, "tenant-1", "user-1")
	if err != nil {
		t.Fatalf("IsDndActive failed: %v", err)
	}
	if active {
		t.Error("IsDndActive = true, want false (DND window not started)")
	}
}

func TestIsDndActive_Expired(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDNDRepository(sqlxDB)
	svc := NewDNDService(repo, zap.NewNop())

	now := time.Now()
	start := now.Add(-3 * time.Hour)
	end := now.Add(-1 * time.Hour)

	mock.ExpectQuery("SELECT \\* FROM do_not_disturb").
		WithArgs("user-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "user_id", "start_time", "end_time", "reason", "created_at", "updated_at"}).
			AddRow("dnd-1", "tenant-1", "user-1", start, end, nil, start, start))
	mock.ExpectExec("DELETE FROM do_not_disturb").
		WithArgs("user-1", "tenant-1").
		WillReturnResult(sqlmock.NewResult(1, 1))

	ctx := context.Background()
	active, err := svc.IsDndActive(ctx, "tenant-1", "user-1")
	if err != nil {
		t.Fatalf("IsDndActive failed: %v", err)
	}
	if active {
		t.Error("IsDndActive = true, want false (expired DND should be auto-cleared)")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestGetDndSettings_Found(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDNDRepository(sqlxDB)
	svc := NewDNDService(repo, zap.NewNop())

	now := time.Now()
	start := now.Add(1 * time.Hour)
	end := now.Add(2 * time.Hour)
	reason := "meeting"

	mock.ExpectQuery("SELECT \\* FROM do_not_disturb").
		WithArgs("user-1", "tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"id", "tenant_id", "user_id", "start_time", "end_time", "reason", "created_at", "updated_at"}).
			AddRow("dnd-1", "tenant-1", "user-1", start, end, &reason, now, now))

	ctx := context.Background()
	dnd, err := svc.GetDndSettings(ctx, "tenant-1", "user-1")
	if err != nil {
		t.Fatalf("GetDndSettings failed: %v", err)
	}
	if dnd == nil {
		t.Fatal("GetDndSettings returned nil")
	}
	if dnd.UserID != "user-1" {
		t.Errorf("GetDndSettings UserID = %s, want user-1", dnd.UserID)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}

func TestGetDndSettings_NotFound(t *testing.T) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDNDRepository(sqlxDB)
	svc := NewDNDService(repo, zap.NewNop())

	mock.ExpectQuery("SELECT \\* FROM do_not_disturb").
		WithArgs("user-1", "tenant-1").
		WillReturnError(sql.ErrNoRows)

	ctx := context.Background()
	_, err = svc.GetDndSettings(ctx, "tenant-1", "user-1")
	if err != ErrDNDNotFound {
		t.Errorf("GetDndSettings error = %v, want ErrDNDNotFound", err)
	}
}

func TestGetActiveUsers(t *testing.T) {
	mockDB, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer mockDB.Close()

	sqlxDB := sqlx.NewDb(mockDB, "sqlmock")
	repo := repository.NewDNDRepository(sqlxDB)
	svc := NewDNDService(repo, zap.NewNop())

	fixedTime := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	svc.timeNow = func() time.Time { return fixedTime }

	mock.ExpectQuery("SELECT user_id FROM do_not_disturb WHERE tenant_id=$1 AND start_time <= $2 AND end_time >= $2").
		WithArgs("tenant-1", fixedTime).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}).
			AddRow("user-1").
			AddRow("user-2").
			AddRow("user-3"))

	ctx := context.Background()
	users, err := svc.GetActiveUsers(ctx, "tenant-1")
	if err != nil {
		t.Fatalf("GetActiveUsers failed: %v", err)
	}
	if len(users) != 3 {
		t.Errorf("GetActiveUsers count = %d, want 3", len(users))
	}
	if users[0] != "user-1" || users[1] != "user-2" || users[2] != "user-3" {
		t.Errorf("GetActiveUsers = %v, want [user-1 user-2 user-3]", users)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unfulfilled expectations: %v", err)
	}
}
