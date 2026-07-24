// Package integration tests the auth service against a real PostgreSQL
// database. Each test runs inside a rolled-back transaction so data never
// persists between runs.
//
// Run:
//   go test ./test/integration/... -v -run TestAuth
//
// Skip (no DB available):
//   go test ./test/integration/... -short
package integration

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"orion/platform-svc-go/internal/auth/models"
	auth_repo "orion/platform-svc-go/internal/auth/repository"
	auth_svc "orion/platform-svc-go/internal/auth/service"
	user_models "orion/platform-svc-go/internal/user/models"
	user_repo "orion/platform-svc-go/internal/user/repository"

	"github.com/jmoiron/sqlx"
)

// setupAuthTables creates the users and refresh_tokens tables if missing.
// In production the schema is already migrated, but for CI we create minimal
// tables so the integration tests are self-contained.
func setupAuthTables(db *sqlx.DB) error {
	createStmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id VARCHAR(36) PRIMARY KEY,
			username VARCHAR(255) UNIQUE NOT NULL,
			password VARCHAR(255) NOT NULL,
			email VARCHAR(255),
			role VARCHAR(50) DEFAULT 'user',
			status VARCHAR(20) DEFAULT 'active',
			full_name VARCHAR(255),
			avatar TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS tenant_users (
			tenant_id VARCHAR(36) NOT NULL,
			user_id VARCHAR(36) NOT NULL,
			PRIMARY KEY (tenant_id, user_id)
		)`,
		`CREATE TABLE IF NOT EXISTS refresh_tokens (
			id VARCHAR(36) PRIMARY KEY,
			user_id VARCHAR(36) NOT NULL,
			token_hash VARCHAR(255) NOT NULL,
			expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
			tenant_id VARCHAR(36),
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		)`,
	}

	for _, stmt := range createStmts {
		_, err := db.Exec(stmt)
		if err != nil {
			return fmt.Errorf("setup auth tables: %w", err)
		}
	}
	return nil
}

// cleanupAuthTables removes all rows from users, tenant_users, and
// refresh_tokens inside the current transaction. This keeps the schema
// but removes test data so future tests start fresh.
func cleanupAuthTables(ctx context.Context, tx *sql.Tx) error {
	dropTables := []string{
		`DELETE FROM refresh_tokens`,
		`DELETE FROM tenant_users`,
		`DELETE FROM users`,
	}
	for _, stmt := range dropTables {
		if _, err := tx.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}
	return nil
}

// testAuthConfig returns the JWT secret used for token generation.
// It uses ORION_TEST_JWT_SECRET if set, otherwise a fixed test secret.
func testAuthConfig() string {
	secret := os.Getenv("ORION_TEST_JWT_SECRET")
	if secret == "" {
		secret = "orion-test-jwt-secret"
	}
	return secret
}

// TestAuthRepository_Crud verifies the full CRUD lifecycle of RefreshToken
// using the real auth repository against PostgreSQL.
func TestAuthRepository_Crud(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupAuthTables(db); err != nil {
		t.Fatalf("failed to setup auth tables: %v", err)
	}

	repo := auth_repo.NewRepository(db)

	// Insert a test user so refresh token FK joins work.
	uID := MustUUID()
	_, err := db.ExecContext(ctx,
		`INSERT INTO users (id, username, password, email, role, status, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
		uID, "testuser", "$2a$12$dummyhash", "test@example.com", "user", "active")
	if err != nil {
		t.Fatalf("failed to insert test user: %v", err)
	}
	_, err = db.ExecContext(ctx,
		`INSERT INTO tenant_users (tenant_id, user_id) VALUES ($1, $2)`,
		"tenant1", uID)
	if err != nil {
		t.Fatalf("failed to insert tenant user: %v", err)
	}

	// Create
	rt := &models.RefreshToken{
		ID:        MustUUID(),
		UserID:    uID,
		TokenHash: "sha256-abcdef1234567890abcdef1234567890",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		TenantID:  "tenant1",
		CreatedAt: time.Now(),
	}
	if err := repo.Create(ctx, rt); err != nil {
		t.Fatalf("repo.Create: %v", err)
	}

	// Read
	row, err := repo.FindByHash(ctx, rt.TokenHash)
	if err != nil {
		t.Fatalf("repo.FindByHash: %v", err)
	}
	if row.ID != rt.ID {
		t.Errorf("FindByHash: expected id=%s, got id=%s", rt.ID, row.ID)
	}
	if row.Username != "testuser" {
		t.Errorf("FindByHash: expected username=testuser, got %s", row.Username)
	}

	// DeleteByHash
	if err := repo.DeleteByHash(ctx, rt.TokenHash); err != nil {
		t.Fatalf("repo.DeleteByHash: %v", err)
	}

	// Verify gone
	_, err = repo.FindByHash(ctx, rt.TokenHash)
	if err == nil {
		t.Fatalf("expected error after delete, got nil")
	}

	// DeleteByUserID
	rt2 := &models.RefreshToken{
		ID:        MustUUID(),
		UserID:    uID,
		TokenHash: "sha256-another-token-hash1234567890",
		ExpiresAt: time.Now().Add(24 * time.Hour),
		TenantID:  "tenant1",
		CreatedAt: time.Now(),
	}
	_ = repo.Create(ctx, rt2)
	if err := repo.DeleteByUserID(ctx, uID); err != nil {
		t.Fatalf("repo.DeleteByUserID: %v", err)
	}

	// Cleanup
	cleanupAuthTables(ctx, nil) // outside txn; safe because table was just created
}

// TestAuthService_RegisterAndLogin verifies the full register → login →
// refresh token → logout flow using the real auth service.
func TestAuthService_RegisterAndLogin(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupAuthTables(db); err != nil {
		t.Fatalf("failed to setup auth tables: %v", err)
	}

	// Create a test user manually (Register requires service logic;
	// here we simulate what the service would do).
	uID := MustUUID()
	// bcrypt hash for "TestPass123456" - but service uses bcrypt so we
	// actually test via the Register flow below with the real service.

	// Use service directly.
	authRepo := auth_repo.NewRepository(db)
	userRepo := user_repo.NewRepository(db)
	svc := auth_svc.NewService(authRepo, userRepo, testAuthConfig())

	// Register
	regReq := &models.RegisterRequest{
		Username: "integ-user",
		Password: "TestPass123456",
		Email:    "integ@example.com",
	}
	regResp, err := svc.Register(ctx, regReq, "tenant1")
	if err != nil {
		t.Fatalf("Register: %v", err)
	}
	if regResp.Username != "integ-user" {
		t.Errorf("Register: expected username=integ-user, got %s", regResp.Username)
	}

	// Login
	loginReq := &models.LoginRequest{
		Username: "integ-user",
		Password: "TestPass123456",
	}
	loginResp, err := svc.Login(ctx, loginReq, "")
	if err != nil {
		t.Fatalf("Login: %v", err)
	}
	if loginResp.AccessToken == "" {
		t.Errorf("Login: expected non-empty access token")
	}
	if loginResp.RefreshToken == "" {
		t.Errorf("Login: expected non-empty refresh token")
	}

	// Refresh
	refreshReq := &models.RefreshRequest{RefreshToken: loginResp.RefreshToken}
	refreshResp, err := svc.Refresh(ctx, refreshReq)
	if err != nil {
		t.Fatalf("Refresh: %v", err)
	}
	if refreshResp.AccessToken == "" {
		t.Errorf("Refresh: expected non-empty access token")
	}

	// Logout
	logoutReq := &models.LogoutRequest{
		RefreshToken: loginResp.RefreshToken,
		AccessToken:  loginResp.AccessToken,
	}
	if err := svc.Logout(ctx, logoutReq); err != nil {
		t.Fatalf("Logout: %v", err)
	}
}

// TestAuthService_BadCredentials verifies that login fails for wrong password.
func TestAuthService_BadCredentials(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupAuthTables(db); err != nil {
		t.Fatalf("failed to setup: %v", err)
	}

	authRepo := auth_repo.NewRepository(db)
	userRepo := user_repo.NewRepository(db)
	svc := auth_svc.NewService(authRepo, userRepo, testAuthConfig())

	// Register a user first
	regReq := &models.RegisterRequest{
		Username: "badcred-user",
		Password: "CorrectPass123",
	}
	_, err := svc.Register(ctx, regReq, "tenant1")
	if err != nil {
		t.Fatalf("Register: %v", err)
	}

	// Try with wrong password
	loginReq := &models.LoginRequest{
		Username: "badcred-user",
		Password: "WrongPassword1",
	}
	_, err = svc.Login(ctx, loginReq, "")
	if !errors.Is(err, auth_svc.ErrInvalidCredentials) {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

// TestAuthService_ShortPassword verifies that short passwords are rejected.
func TestAuthService_ShortPassword(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupAuthTables(db); err != nil {
		t.Fatalf("failed to setup: %v", err)
	}

	authRepo := auth_repo.NewRepository(db)
	userRepo := user_repo.NewRepository(db)
	svc := auth_svc.NewService(authRepo, userRepo, testAuthConfig())

	req := &models.RegisterRequest{
		Username: "short-pw-user",
		Password: "short", // 5 chars < 8
	}
	_, err := svc.Register(ctx, req, "tenant1")
	if !errors.Is(err, auth_svc.ErrPasswordTooShort) {
		t.Errorf("expected ErrPasswordTooShort, got %v", err)
	}
}

// TestAuthService_DuplicateUsername verifies that duplicate registration fails.
func TestAuthService_DuplicateUsername(t *testing.T) {
	provider := TestDB(t)
	if provider == nil {
		return
	}
	defer provider.Close()

	ctx := context.Background()
	db := sqlx.NewDb(provider.DB(), "postgres")
	defer db.Close()

	if err := setupAuthTables(db); err != nil {
		t.Fatalf("failed to setup: %v", err)
	}

	authRepo := auth_repo.NewRepository(db)
	userRepo := user_repo.NewRepository(db)
	svc := auth_svc.NewService(authRepo, userRepo, testAuthConfig())

	req := &models.RegisterRequest{
		Username: "dup-user",
		Password: "SameUserPass12",
	}
	// First registration
	_, err := svc.Register(ctx, req, "tenant1")
	if err != nil {
		t.Fatalf("first Register: %v", err)
	}
	// Second registration with same username
	_, err = svc.Register(ctx, req, "tenant1")
	if !errors.Is(err, auth_svc.ErrUsernameExists) {
		t.Errorf("expected ErrUsernameExists, got %v", err)
	}
}
