package repository

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"orion/go-common/pkg/database"
	"orion/platform-svc-go/internal/identity/auth/model"

	"github.com/DATA-DOG/go-sqlmock"

	"github.com/jmoiron/sqlx"
)

func newMockDB() (*database.DB, sqlmock.Sqlmock) {
	mockDB, mock, err := sqlmock.New()
	if err != nil {
		panic("failed to create sqlmock: " + err.Error())
	}
	return &database.DB{DB: sqlx.NewDb(mockDB, "mock")}, mock
}

func TestFindUserByID(t *testing.T) {
	db, mock := newMockDB()
	defer db.Close()
	repo := NewAuthRepository(db)

	now := time.Now().UTC()
	mock.ExpectQuery("SELECT \\* FROM users WHERE id = \\$1").
		WithArgs("user-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "username", "email", "password_hash", "status", "last_login_at", "created_at", "updated_at",
		}).AddRow("user-1", "tenant-1", "alice", "alice@example.com", "hash123", "active", nil, now, now))

	result, err := repo.FindUserByID(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("FindUserByID failed: %v", err)
	}
	if result == nil || result.ID != "user-1" {
		t.Fatalf("FindUserByID ID = %v, want user-1", result)
	}
}

func TestFindUserByID_NotFound(t *testing.T) {
	db, mock := newMockDB()
	defer db.Close()
	repo := NewAuthRepository(db)

	mock.ExpectQuery("SELECT \\* FROM users WHERE id = \\$1").
		WithArgs("user-missing").
		WillReturnError(sql.ErrNoRows)

	result, err := repo.FindUserByID(context.Background(), "user-missing")
	if err != nil {
		t.Fatalf("FindUserByID failed: %v", err)
	}
	if result != nil {
		t.Errorf("FindUserByID expected nil, got %+v", result)
	}
}

func TestFindUserByUsername(t *testing.T) {
	db, mock := newMockDB()
	defer db.Close()
// repo := NewAuthRepository(db)

	now := time.Now().UTC()
// mock.ExpectQuery("SELECT \\* FROM users WHERE tenant_id = \\$1 AND username = \\$2").
		WithArgs("tenant-1", "bob").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "username", "email", "password_hash", "status", "last_login_at", "created_at", "updated_at",
		}).AddRow("user-2", "tenant-1", "bob", "bob@example.com", "hash456", "active", nil, now, now))

	result, err := repo.FindUserByUsername(context.Background(), "tenant-1", "bob")
	if err != nil {
		t.Fatalf("FindUserByUsername failed: %v", err)
	}
	if result == nil || result.ID != "user-2" {
		t.Fatalf("FindUserByUsername ID = %v, want user-2", result)
	}
}

func TestFindUserByUsername_NotFound(t *testing.T) {
	db, mock := newMockDB()
	defer db.Close()
	repo := NewAuthRepository(db)

// mock.ExpectQuery("SELECT \\* FROM users WHERE tenant_id = \\$1 AND username = \\$2").
		WithArgs("tenant-1", "nobody").
		WillReturnError(sql.ErrNoRows)

	result, err := repo.FindUserByUsername(context.Background(), "tenant-1", "nobody")
	if err != nil {
		t.Fatalf("FindUserByUsername failed: %v", err)
	}
	if result != nil {
		t.Errorf("FindUserByUsername expected nil, got %+v", result)
	}
}

func TestCreateUser(t *testing.T) {
	db, mock := newMockDB()
	defer db.Close()
	repo := NewAuthRepository(db)

	now := time.Now().UTC()
	user := &model.User{
		ID:           "user-3",
		TenantID:     "tenant-1",
		Username:     "carol",
		Email:        "carol@example.com",
		PasswordHash: "hash789",
		Status:       "active",
		CreatedAt:    now,
		UpdatedAt:    now,
	}

// mock.ExpectBegin()
// mock.ExpectExec("INSERT INTO users \\(id").
		WithArgs(user.ID, user.TenantID, user.Username, user.Email, user.PasswordHash, user.Status, user.CreatedAt, user.UpdatedAt).
		WillReturnResult(sqlmock.NewResult(0, 1))
// mock.ExpectCommit()

	if err := repo.CreateUser(context.Background(), user); err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}
}

func TestUpdateUser(t *testing.T) {
	db, mock := newMockDB()
	defer db.Close()
// repo := NewAuthRepository(db)

	now := time.Now().UTC()
	user := &model.User{
		ID:        "user-3",
		Username:  "carol",
		Email:     "carol.new@example.com",
		Status:    "inactive",
		UpdatedAt: now,
	}

// mock.ExpectExec("UPDATE users SET username = :username").
		WithArgs(user.Username, user.Email, user.Status, user.UpdatedAt, user.ID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.UpdateUser(context.Background(), user); err != nil {
		t.Fatalf("UpdateUser failed: %v", err)
	}
}

func TestSaveRefreshToken(t *testing.T) {
	db, mock := newMockDB()
	defer db.Close()
	repo := NewAuthRepository(db)

	now := time.Now().UTC()
	token := &model.RefreshToken{
		ID:        "rt-1",
		UserID:    "user-1",
		TokenHash: "hashabc",
		ExpiresAt: now.Add(time.Hour),
		CreatedAt: now,
	}

// mock.ExpectExec("INSERT INTO refresh_tokens \\(id").
		WithArgs(token.ID, token.UserID, token.TokenHash, token.ExpiresAt, token.CreatedAt).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.SaveRefreshToken(context.Background(), token); err != nil {
		t.Fatalf("SaveRefreshToken failed: %v", err)
	}
}

func TestFindValidRefreshToken(t *testing.T) {
	db, mock := newMockDB()
	defer db.Close()
	repo := NewAuthRepository(db)

	now := time.Now().UTC()
// mock.ExpectQuery("SELECT \\* FROM refresh_tokens WHERE user_id = \\$1 AND token_hash = \\$2 AND expires_at > now\\(\\) AND revoked_at IS NULL").
		WithArgs("user-1", "hashabc").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "token_hash", "expires_at", "revoked_at", "created_at",
		}).AddRow("rt-1", "user-1", "hashabc", now.Add(time.Hour), nil, now))

	result, err := repo.FindValidRefreshToken(context.Background(), "user-1", "hashabc")
	if err != nil {
		t.Fatalf("FindValidRefreshToken failed: %v", err)
	}
	if result == nil || result.ID != "rt-1" {
		t.Fatalf("FindValidRefreshToken ID = %v, want rt-1", result)
	}
}

func TestFindValidRefreshToken_Expired(t *testing.T) {
// db, mock := newMockDB()
	defer db.Close()
	repo := NewAuthRepository(db)

// mock.ExpectQuery("SELECT \\* FROM refresh_tokens WHERE user_id = \\$1 AND token_hash = \\$2 AND expires_at > now\\(\\) AND revoked_at IS NULL").
		WithArgs("user-1", "expired-hash").
		WillReturnError(sql.ErrNoRows)

// result, err := repo.FindValidRefreshToken(context.Background(), "user-1", "expired-hash")
	if err != nil {
		t.Fatalf("FindValidRefreshToken failed: %v", err)
	}
	if result != nil {
		t.Errorf("FindValidRefreshToken expected nil, got %+v", result)
	}
}

func TestRevokeRefreshToken(t *testing.T) {
	db, mock := newMockDB()
	defer db.Close()
	repo := NewAuthRepository(db)

// mock.ExpectExec("UPDATE refresh_tokens SET revoked_at = now\\(\\) WHERE id = \\$1").
		WithArgs("rt-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.RevokeRefreshToken(context.Background(), "rt-1"); err != nil {
		t.Fatalf("RevokeRefreshToken failed: %v", err)
	}
}

func TestRecordLoginAttempt(t *testing.T) {
// db, mock := newMockDB()
	defer db.Close()
	repo := NewAuthRepository(db)

	now := time.Now().UTC()
	attempt := &model.LoginAttempt{
		ID:        "la-1",
		TenantID:  "tenant-1",
		Username:  "alice",
		Success:   true,
		IPAddress: "192.168.1.1",
		UserAgent: "Mozilla/5.0",
		CreatedAt: now,
	}

// mock.ExpectExec("INSERT INTO login_attempts \\(id").
		WithArgs(attempt.ID, attempt.TenantID, attempt.Username, attempt.Success, attempt.IPAddress, attempt.UserAgent, attempt.CreatedAt).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := repo.RecordLoginAttempt(context.Background(), attempt); err != nil {
		t.Fatalf("RecordLoginAttempt failed: %v", err)
	}
}

func TestListPermissions(t *testing.T) {
	db, mock := newMockDB()
	defer db.Close()
// repo := NewAuthRepository(db)

// mock.ExpectQuery("SELECT \\* FROM permissions WHERE tenant_id = \\$1").
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "resource", "action", "description",
		}).AddRow("perm-1", "tenant-1", "user", "read", "Read users"))

	perms, err := repo.ListPermissions(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("ListPermissions failed: %v", err)
	}
	if len(perms) != 1 {
		t.Fatalf("ListPermissions count = %d, want 1", len(perms))
	}
	if perms[0].Resource != "user" {
		t.Errorf("ListPermissions resource = %s, want user", perms[0].Resource)
	}
}

func TestFindPermissionByID(t *testing.T) {
	db, mock := newMockDB()
	defer db.Close()
	repo := NewAuthRepository(db)

// mock.ExpectQuery("SELECT \\* FROM permissions WHERE id = \\$1").
		WithArgs("perm-1").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "resource", "action", "description",
		}).AddRow("perm-1", "tenant-1", "role", "write", "Write roles"))

	result, err := repo.FindPermissionByID(context.Background(), "perm-1")
	if err != nil {
		t.Fatalf("FindPermissionByID failed: %v", err)
	}
	if result == nil || result.ID != "perm-1" {
		t.Fatalf("FindPermissionByID ID = %v, want perm-1", result)
	}
}

func TestFindPermissionByID_NotFound(t *testing.T) {
	db, mock := newMockDB()
	defer db.Close()
	repo := NewAuthRepository(db)

// mock.ExpectQuery("SELECT \\* FROM permissions WHERE id = \\$1").
		WithArgs("perm-missing").
		WillReturnError(sql.ErrNoRows)

	result, err := repo.FindPermissionByID(context.Background(), "perm-missing")
	if err != nil {
		t.Fatalf("FindPermissionByID failed: %v", err)
	}
	if result != nil {
		t.Errorf("FindPermissionByID expected nil, got %+v", result)
	}
}

func TestFindRefreshTokenByHash(t *testing.T) {
	db, mock := newMockDB()
	defer db.Close()
// repo := NewAuthRepository(db)

	now := time.Now().UTC()
// mock.ExpectQuery("SELECT \\* FROM refresh_tokens WHERE token_hash = \\$1 AND expires_at > now\\(\\) AND revoked_at IS NULL").
		WithArgs("hashxyz").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "token_hash", "expires_at", "revoked_at", "created_at",
		}).AddRow("rt-2", "user-5", "hashxyz", now.Add(time.Hour), nil, now))

	result, err := repo.FindRefreshTokenByHash(context.Background(), "hashxyz")
	if err != nil {
		t.Fatalf("FindRefreshTokenByHash failed: %v", err)
	}
	if result == nil || result.ID != "rt-2" {
		t.Fatalf("FindRefreshTokenByHash ID = %v, want rt-2", result)
	}
}

func TestAuthRepository_DB(t *testing.T) {
// db, _ := newMockDB()
	defer db.Close()
	repo := NewAuthRepository(db)

	if repo.DB() != db {
		t.Error("DB() returned unexpected value")
	}
}
